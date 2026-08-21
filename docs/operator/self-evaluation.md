# Controlled-run self-evaluation

## Deterministic detection

The operator deterministically measured provider run freshness/completeness, zero-result and archive spikes, cron presence/duplication, active Event validity, lifecycle/date errors, exact duplicate occurrence keys, metadata coverage, URL reachability, city-coordinate conflicts, RLS/grants on the control plane, forbidden columns in `public_profiles`, digest idempotency indexes, scoring deductions, prioritization, and artifact redaction.

## Reasoning and research

Human/agent judgment was needed to assess source overlap and net-new value, distinguish an intentionally parked Tel Aviv Port integration from a fresh outage, judge potentially adult-only or cancellation-labelled content, and rank official Tel Aviv sources whose pages have different structures and cadences.

## Safe autonomy

Read-only audits, regression tests, diagnostics, secret-safe reports, URL checks, source research, and control-plane artifact persistence can safely become automated. Deterministic parser fixes may also run autonomously when behavior is unambiguous and focused regression coverage exists.

## Human approval remains required

Provider/city enablement, cron creation, production content correction, category/relevance policy changes, UI/notification behavior, and localization policy remain Yellow. Destructive data/RLS changes, RSVP or user deletion, global dedupe changes, force pushes, releases, and App Store actions remain Red.

## Wasted work and scheduling safeguards

An early cron check matched providers only by provider-name text and produced false missing-cron findings; the final monitor also matches the registered schedule and detects duplicate jobs. An early city check treated coordinates outside configured city polygons as definitely wrong; the final audit treats them as unknown unless another configured city positively matches. Scheduled URL verification is therefore bounded to a rotating batch of 50 links per Daily run. Future improvements remain dedicated non-production A/B security principals, trend baselines for provider counts, a versioned known-exception registry, and approval-expiry rules.
