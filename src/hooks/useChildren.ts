import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Child, ChildSex } from '@/types/child';
import { currentAppLocale, translate } from '@/i18n';

interface ChildRow {
  id: string;
  name: string;
  birthdate: string | null;
  avatar_url: string | null;
  is_default: boolean;
  sex: ChildSex | null;
}

function mapChild(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    birthdate: row.birthdate,
    avatarUrl: row.avatar_url,
    isDefault: row.is_default,
    sex: row.sex,
  };
}

export interface AddChildInput {
  name: string;
  birthdate: string | null;
  avatarUrl?: string | null;
  sex?: ChildSex | null;
}

interface UseChildrenResult {
  children: Child[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addChild: (input: AddChildInput) => Promise<string | null>;
  updateChild: (id: string, input: AddChildInput) => Promise<string | null>;
  removeChild: (id: string) => Promise<string | null>;
  setDefaultChild: (id: string) => Promise<string | null>;
}

/** A parent's children, each a separate record (not repeated profile
 *  fields) so they can add, edit, and remove them independently. Exactly one
 *  is marked default (enforced by a DB partial unique index) — used
 *  wherever the app needs "the" child, e.g. age-matching on Discover. */
export function useChildren(profileId: string | null): UseChildrenResult {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setChildren([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('children')
      .select('id, name, birthdate, avatar_url, is_default, sex')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });
    if (fetchError) {
      setError(translate(currentAppLocale(), 'error.childrenLoad'));
    } else {
      setChildren((data ?? []).map(mapChild));
    }
    setIsLoading(false);
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const addChild = useCallback(
    async (input: AddChildInput) => {
      if (!profileId) return 'Not signed in.';
      const makeDefault = children.length === 0;
      const { error: insertError } = await supabase.from('children').insert({
        profile_id: profileId,
        name: input.name,
        birthdate: input.birthdate,
        avatar_url: input.avatarUrl ?? null,
        sex: input.sex ?? null,
        is_default: makeDefault,
      });
      if (insertError) {
        console.log('[Children] add failed', insertError.message);
        return "Couldn't add your child. Please try again.";
      }
      await load();
      return null;
    },
    [profileId, children.length, load],
  );

  const updateChild = useCallback(
    async (id: string, input: AddChildInput) => {
      const { error: updateError } = await supabase
        .from('children')
        .update({
          name: input.name,
          birthdate: input.birthdate,
          avatar_url: input.avatarUrl ?? null,
          sex: input.sex ?? null,
        })
        .eq('id', id);
      if (updateError) {
        console.log('[Children] update failed', updateError.message);
        return "Couldn't save your changes. Please try again.";
      }
      await load();
      return null;
    },
    [load],
  );

  const removeChild = useCallback(
    async (id: string) => {
      const removingDefault = children.find((c) => c.id === id)?.isDefault ?? false;
      const { error: deleteError } = await supabase.from('children').delete().eq('id', id);
      if (deleteError) {
        console.log('[Children] remove failed', deleteError.message);
        return "Couldn't remove this child. Please try again.";
      }
      // Keep exactly one default whenever possible — promote the oldest
      // remaining child rather than leaving the parent with none set.
      if (removingDefault) {
        const remaining = children.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          await supabase.from('children').update({ is_default: true }).eq('id', remaining[0].id);
        }
      }
      await load();
      return null;
    },
    [children, load],
  );

  const setDefaultChild = useCallback(
    async (id: string) => {
      if (!profileId) return 'Not signed in.';
      // Two-step clear-then-set avoids tripping the one-default partial
      // unique index while the update is in flight.
      const { error: clearError } = await supabase
        .from('children')
        .update({ is_default: false })
        .eq('profile_id', profileId);
      if (clearError) {
        console.log('[Children] set default failed', clearError.message);
        return "Couldn't update your default child. Please try again.";
      }
      const { error: setError2 } = await supabase.from('children').update({ is_default: true }).eq('id', id);
      if (setError2) {
        console.log('[Children] set default failed', setError2.message);
        return "Couldn't update your default child. Please try again.";
      }
      await load();
      return null;
    },
    [profileId, load],
  );

  return { children, isLoading, error, refresh: load, addChild, updateChild, removeChild, setDefaultChild };
}
