import type {
  DiscoveryContentKey,
  DiscoveryContentSelection,
  DiscoverySelection,
} from '@/types/discovery';
import { toggleDiscoveryContent } from '@/utils/discoveryPresentation';

/** The slice of DiscoverScreen state that a content-type toggle may touch.
 *  Deliberately does NOT include `region`: extracting it this way makes it
 *  structurally impossible for a selection change to move the map camera,
 *  which is the behaviour the screen-level tests need to pin. */
export interface DiscoverySelectionState {
  selection: DiscoveryContentSelection;
  selectedItem: DiscoverySelection;
}

export interface DiscoverySelectionChange extends DiscoverySelectionState {
  /** True when the change was refused because it would have emptied the
   *  selection; the caller shows the "keep one type" notice. */
  prevented: boolean;
  /** Content types whose cached data must be re-fetched. Always empty: hiding
   *  and re-showing a type is a pure visibility change over data already held,
   *  so it must never trigger a network round trip. */
  refetch: readonly DiscoveryContentKey[];
}

const NO_REFETCH: readonly DiscoveryContentKey[] = Object.freeze([]);

/** Applies a content-type toggle.
 *
 *  Two rules are enforced here rather than in the component:
 *   - at least one content type stays selected;
 *   - hiding a type drops any selected item OF that type, so a marker that is
 *     no longer on the map cannot stay highlighted. */
export function applyContentSelectionChange(
  state: DiscoverySelectionState,
  key: DiscoveryContentKey,
): DiscoverySelectionChange {
  const result = toggleDiscoveryContent(state.selection, key);
  if (result.prevented) {
    return { ...state, prevented: true, refetch: NO_REFETCH };
  }

  const wasVisible = state.selection[key];
  const itemType = key === 'activities' ? 'activity' : key === 'places' ? 'place' : 'event';
  const selectedItem =
    wasVisible && state.selectedItem?.type === itemType ? null : state.selectedItem;

  return { selection: result.selection, selectedItem, prevented: false, refetch: NO_REFETCH };
}

/** Restores every content type. Always valid, so it can never be prevented. */
export function resetContentSelection(): DiscoveryContentSelection {
  return { activities: true, places: true, events: true };
}
