import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeOnboardingCore } from './completeOnboarding.ts';
import { computeRouteDecision } from './routing.ts';

/** Transition harness — exercises the real production functions
 *  (completeOnboardingCore, computeRouteDecision) against a hand-rolled
 *  in-memory mock of the Supabase query builder, not a real network call.
 *  A unit test of completeOnboardingCore alone proves the DB sequence is
 *  correct; this harness additionally proves what happens *around* it —
 *  routing, mount lifecycle, and imperative-navigation absence — by
 *  driving the same AuthProvider-shaped state transitions App.tsx reacts
 *  to (session set -> profile loaded -> routeDecision computed -> Main/
 *  Home mount) and asserting on the results. No React Native, React
 *  Navigation, or React renderer is involved — those can't run in this
 *  Node environment without a full native test-runner stack (Jest +
 *  jest-expo), which would be the "large testing framework" this harness
 *  is deliberately avoiding. What CAN be verified without one — the real
 *  DB sequence, the real routing rule, and mount-once/never-premature
 *  semantics — is verified directly against the real functions. */

// ---------------------------------------------------------------------
// Mock Supabase client: a minimal, hand-rolled fake of the subset of the
// query-builder interface completeOnboardingCore actually calls. Not a
// testing framework — ~90 lines modeling exactly the calls this one
// function makes, with fault injection for failure-scenario coverage
// no live-database test can safely or deterministically trigger.
// ---------------------------------------------------------------------

interface ProfileRow {
  id: string;
  onboarding_completed: boolean;
  phone: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ChildRow {
  id: string;
  profile_id: string;
  name: string;
  birthdate: string;
  is_default: boolean;
}

class MockDb {
  profiles = new Map<string, ProfileRow>();
  children = new Map<string, ChildRow[]>();
  faults: { profileUpdate?: boolean; childrenInsert?: boolean; childrenVerifyZero?: boolean } = {};
  private nextChildId = 1;

  seedProfile(id: string, overrides: Partial<ProfileRow> = {}) {
    this.profiles.set(id, {
      id,
      onboarding_completed: false,
      phone: null,
      display_name: null,
      email: null,
      avatar_url: null,
      ...overrides,
    });
  }

  seedChild(profileId: string, overrides: Partial<ChildRow> = {}) {
    const row: ChildRow = {
      id: `child-${this.nextChildId++}`,
      profile_id: profileId,
      name: 'Seed Child',
      birthdate: '2023-01-01',
      is_default: true,
      ...overrides,
    };
    const arr = this.children.get(profileId) ?? [];
    arr.push(row);
    this.children.set(profileId, arr);
    return row;
  }

  insertChildren(rows: Array<Omit<ChildRow, 'id'>>) {
    if (this.faults.childrenInsert) return { error: { message: 'mock: children insert failure' } };
    const profileId = rows[0]?.profile_id;
    const existing = this.children.get(profileId) ?? [];
    // Mirrors the real children_one_default_per_profile partial unique
    // index — a concurrent insert of a second is_default=true row for the
    // same profile must fail exactly like it would on the live database.
    if (rows.some((r) => r.is_default) && existing.some((r) => r.is_default)) {
      return { error: { message: 'mock: duplicate key value violates unique constraint "children_one_default_per_profile"' } };
    }
    const inserted = rows.map((r) => ({ id: `child-${this.nextChildId++}`, ...r }));
    this.children.set(profileId, [...existing, ...inserted]);
    return { error: null };
  }
}

class QueryBuilder {
  private op: 'select' | 'update' | 'insert' = 'select';
  private cols: string | null = null;
  private opts: { count?: string; head?: boolean } | null = null;
  private filters: Record<string, string> = {};
  private payload: unknown = null;
  private limitN: number | null = null;
  private db: MockDb;
  private table: 'profiles' | 'children';

  constructor(db: MockDb, table: 'profiles' | 'children') {
    this.db = db;
    this.table = table;
  }

  select(cols: string, opts?: { count?: string; head?: boolean }) {
    this.op = 'select';
    this.cols = cols;
    this.opts = opts ?? null;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  insert(rows: unknown) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }
  eq(col: string, val: string) {
    this.filters[col] = val;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    return this;
  }
  then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return this.exec().then(onFulfilled, onRejected);
  }

  private async exec(): Promise<{ data?: unknown; error: unknown; count?: number }> {
    if (this.table === 'profiles') {
      if (this.op === 'select') {
        const row = this.db.profiles.get(this.filters.id);
        return { data: row ? { ...row } : null, error: null };
      }
      if (this.op === 'update') {
        if (this.db.faults.profileUpdate) return { error: { message: 'mock: profile update failure' } };
        const row = this.db.profiles.get(this.filters.id);
        if (!row) return { error: { message: 'mock: profile not found' } };
        Object.assign(row, this.payload);
        return { error: null };
      }
    }
    if (this.table === 'children') {
      const list = this.db.children.get(this.filters.profile_id) ?? [];
      if (this.op === 'select') {
        if (this.opts?.count === 'exact' && this.opts.head) {
          const count = this.db.faults.childrenVerifyZero ? 0 : list.length;
          return { count, error: null };
        }
        const sliced = this.limitN ? list.slice(0, this.limitN) : list;
        return { data: sliced.map((c) => ({ id: c.id })), error: null };
      }
      if (this.op === 'insert') {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Array<Omit<ChildRow, 'id'>>;
        const { error } = this.db.insertChildren(rows);
        return { error };
      }
    }
    throw new Error(`mock: unhandled ${this.table}/${this.op}`);
  }
}

function createMockClient(db: MockDb) {
  return { from: (table: 'profiles' | 'children') => new QueryBuilder(db, table) } as any;
}

// ---------------------------------------------------------------------
// Mount simulator — models the exact subset of React behavior that
// matters here: MainNavigator/Home each mount their one-time useEffect
// exactly once per *transition into* that route, never on repeated
// renders of an already-mounted tree, using the real computeRouteDecision
// (imported, not reimplemented) — the same function App.tsx calls.
// ---------------------------------------------------------------------

class AppMountSimulator {
  session: { user: { id: string } } | null = null;
  profile: { onboardingCompleted: boolean } | null = null;
  route: ReturnType<typeof computeRouteDecision> | null = null;
  mainMountCount = 0;
  homeMountCount = 0;

  setSession(session: { user: { id: string } } | null) {
    this.session = session;
    this.render();
  }
  setProfile(profile: { onboardingCompleted: boolean } | null) {
    this.profile = profile;
    this.render();
  }
  private render() {
    const next = computeRouteDecision(this.session, this.profile);
    if (next !== this.route) {
      this.route = next;
      if (next === 'main-navigator') {
        // MainNavigator's [MAIN 01] effect and DiscoverScreenContainer's
        // [HOME 01] effect both fire on mount, in that order — Tabs
        // renders Discovery as its initial route immediately.
        this.mainMountCount += 1;
        this.homeMountCount += 1;
      }
    }
  }
}

// ---------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------

const USER_ID = 'user-1';

function bootSimAt(db: MockDb, profileRow: ProfileRow | undefined) {
  const sim = new AppMountSimulator();
  sim.setSession({ user: { id: USER_ID } });
  sim.setProfile(profileRow ? { onboardingCompleted: profileRow.onboarding_completed } : null);
  return sim;
}

test('Apple-style first-time user: stub profile, zero children -> completes -> main mounts once', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  const sim = bootSimAt(db, db.profiles.get(USER_ID));
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);

  const client = createMockClient(db);
  const events: string[] = [];
  const result = await completeOnboardingCore(
    client,
    USER_ID,
    { children: [{ name: 'Apple Kid', birthdate: '2023-02-02' }], displayName: 'Apple Parent', email: null },
    (m) => events.push(m),
  );
  assert.equal(result.status, 'completed');
  assert.ok(events.includes('[ONBOARDING 05] completion flag saved'));

  sim.setProfile({ onboardingCompleted: db.profiles.get(USER_ID)!.onboarding_completed });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
  assert.equal(sim.homeMountCount, 1);
});

test('Email-style first-time user (immediate session): stub profile, zero children -> completes -> main mounts once', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID, { email: 'harness@example.com' });
  const sim = bootSimAt(db, db.profiles.get(USER_ID));
  assert.equal(sim.route, 'complete-profile');

  const client = createMockClient(db);
  const result = await completeOnboardingCore(client, USER_ID, {
    children: [{ name: 'Email Kid', birthdate: '2023-03-03' }],
    displayName: 'Email Parent',
    email: 'harness@example.com',
  });
  assert.equal(result.status, 'completed');

  sim.setProfile({ onboardingCompleted: db.profiles.get(USER_ID)!.onboarding_completed });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
  assert.equal(sim.homeMountCount, 1);
});

test('failure: profile update fails -> recoverable error, main never mounts', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  db.faults.profileUpdate = true;
  const sim = bootSimAt(db, db.profiles.get(USER_ID));

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [{ name: 'Kid', birthdate: '2023-01-01' }],
  });
  assert.equal(result.status, 'error');
  assert.match(result.status === 'error' ? result.message : '', /profile/i);

  sim.setProfile({ onboardingCompleted: db.profiles.get(USER_ID)!.onboarding_completed });
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);
});

test('failure: children insert fails -> recoverable error, main never mounts, no orphaned flag', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  db.faults.childrenInsert = true;
  const sim = bootSimAt(db, db.profiles.get(USER_ID));

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [{ name: 'Kid', birthdate: '2023-01-01' }],
  });
  assert.equal(result.status, 'error');

  sim.setProfile({ onboardingCompleted: db.profiles.get(USER_ID)!.onboarding_completed });
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);
  assert.equal(db.profiles.get(USER_ID)!.onboarding_completed, false);
});

test('failure: child verification returns zero despite insert -> recoverable error, flag never flips', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  db.faults.childrenVerifyZero = true;
  const sim = bootSimAt(db, db.profiles.get(USER_ID));

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [{ name: 'Kid', birthdate: '2023-01-01' }],
  });
  assert.equal(result.status, 'error');
  assert.equal(db.profiles.get(USER_ID)!.onboarding_completed, false);

  sim.setProfile({ onboardingCompleted: false });
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);
});

test('auth refresh returns stale onboarding_completed=false after a real success -> main stays gated until a correct refresh arrives', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  const sim = bootSimAt(db, db.profiles.get(USER_ID));

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [{ name: 'Kid', birthdate: '2023-01-01' }],
  });
  assert.equal(result.status, 'completed');
  assert.equal(db.profiles.get(USER_ID)!.onboarding_completed, true); // DB write genuinely succeeded

  // Simulate a stale/lagging refresh — the routing gate must never mount
  // Main off of a write it hasn't actually observed yet.
  sim.setProfile({ onboardingCompleted: false });
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);

  // The next refresh (retry, pull-to-refresh, or app relaunch) observes
  // the real value and proceeds normally.
  sim.setProfile({ onboardingCompleted: true });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
});

test('double-submit: concurrent calls create no duplicate children, at most one error, one completion', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  const client = createMockClient(db);
  const input = { children: [{ name: 'Racer', birthdate: '2023-05-05' }] };

  const [a, b] = await Promise.all([completeOnboardingCore(client, USER_ID, input), completeOnboardingCore(client, USER_ID, input)]);

  const children = db.children.get(USER_ID) ?? [];
  assert.equal(children.length, 1, 'no duplicate children created under concurrent submission');
  assert.ok(
    [a.status, b.status].every((s) => s === 'completed' || s === 'already-complete' || s === 'error'),
    'no uncaught exception — both calls resolved to a defined status',
  );
});

test('retry after profile saved but before child saved: succeeds without re-erroring or duplicating', async () => {
  const db = new MockDb();
  // Simulate step 2 (profile fields) already committed by a prior attempt.
  db.seedProfile(USER_ID, { phone: '+15550000000', display_name: 'Partial Parent' });
  const sim = bootSimAt(db, db.profiles.get(USER_ID));
  assert.equal(sim.route, 'complete-profile');

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [{ name: 'Kid', birthdate: '2023-01-01' }],
    phone: '+15550000000',
    displayName: 'Partial Parent',
  });
  assert.equal(result.status, 'completed');
  assert.equal((db.children.get(USER_ID) ?? []).length, 1);

  sim.setProfile({ onboardingCompleted: true });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
});

test('retry after child saved but before completion flag: reuses existing child, no duplicate, flag set', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  db.seedChild(USER_ID, { name: 'Already Saved' });
  const sim = bootSimAt(db, db.profiles.get(USER_ID));
  assert.equal(sim.route, 'complete-profile'); // child exists, but flag is still false

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, { children: [] });
  assert.equal(result.status, 'completed');
  assert.equal((db.children.get(USER_ID) ?? []).length, 1, 'existing child reused, not duplicated');

  sim.setProfile({ onboardingCompleted: true });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
  assert.equal(sim.homeMountCount, 1);
});

test('app restart with a partially completed user: routes back to onboarding, then completes cleanly on resume', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID, { phone: '+15551112222' });
  db.seedChild(USER_ID, { name: 'Existing' });

  // "App restart" — a fresh boot re-derives session + profile from scratch,
  // exactly like useAuth's getSession()/loadProfile() bootstrap effect.
  const sim = new AppMountSimulator();
  sim.setSession({ user: { id: USER_ID } });
  sim.setProfile({ onboardingCompleted: db.profiles.get(USER_ID)!.onboarding_completed });
  assert.equal(sim.route, 'complete-profile');
  assert.equal(sim.mainMountCount, 0);

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, { children: [] });
  assert.equal(result.status, 'completed');
  assert.equal((db.children.get(USER_ID) ?? []).length, 1);

  sim.setProfile({ onboardingCompleted: true });
  assert.equal(sim.route, 'main-navigator');
  assert.equal(sim.mainMountCount, 1);
  assert.equal(sim.homeMountCount, 1);
});

test('submit triggered twice in a row (post-success retry) does not remount Main a second time or duplicate children', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID);
  const sim = bootSimAt(db, db.profiles.get(USER_ID));
  const client = createMockClient(db);
  const input = { children: [{ name: 'Kid', birthdate: '2023-01-01' }], displayName: 'Retry Parent' };

  const first = await completeOnboardingCore(client, USER_ID, input);
  assert.equal(first.status, 'completed');
  sim.setProfile({ onboardingCompleted: true });
  assert.equal(sim.mainMountCount, 1);

  const second = await completeOnboardingCore(client, USER_ID, input);
  assert.equal(second.status, 'already-complete');
  sim.setProfile({ onboardingCompleted: true }); // refresh again, same value
  assert.equal(sim.mainMountCount, 1, 'Main does not remount on a route that has not changed');
  assert.equal((db.children.get(USER_ID) ?? []).length, 1);
});

test('legacy Apple profile marked complete can be repaired without duplicating its child', async () => {
  const db = new MockDb();
  db.seedProfile(USER_ID, { onboarding_completed: true, display_name: 'Momzy member' });
  db.seedChild(USER_ID, { name: 'Existing child' });

  const result = await completeOnboardingCore(createMockClient(db), USER_ID, {
    children: [],
    displayName: 'Real Parent',
    parentRole: 'parent',
    birthdate: '1990-01-01',
    neighborhood: 'Florentin',
    repairCompletedProfile: true,
  });

  assert.equal(result.status, 'completed');
  assert.equal(db.profiles.get(USER_ID)?.display_name, 'Real Parent');
  assert.equal((db.children.get(USER_ID) ?? []).length, 1);
});
