/** Create Activity location picker — map lifecycle and gesture arbitration.
 *
 *  Deliberately a SEPARATE module from `discoveryScreenState`. The Discovery
 *  map is physically validated as working and must not change; this map fails
 *  for a different reason and so gets its own state machine rather than a
 *  shared one that could regress Discovery.
 *
 *  The difference that matters: Discovery's MapView is a direct child of the
 *  screen with no scrolling ancestor. This one is 220pt tall inside the
 *  activity form's ScrollView, so the two pan gesture recognisers compete for
 *  the same drag — which is what "the map freezes" actually is. The map is not
 *  frozen; the ScrollView is winning the gesture.
 */

/** While a finger is down on the map, the surrounding form must not scroll.
 *
 *  Without this, iOS hands a vertical drag to the ScrollView and the map never
 *  sees it: the form slides, the map appears dead, and releasing does nothing.
 *  Horizontal drags happen to work, which is exactly the "sometimes it pans,
 *  sometimes it doesn't" behaviour reported from the device.
 *
 *  The lock is released on touch end and on touch cancel — cancel matters,
 *  because a drag that travels far enough for the parent to steal it ends as a
 *  cancel, and a lock that only cleared on a clean end would leave the form
 *  permanently unscrollable. */
export function formScrollEnabledDuringMapTouch(isTouchingMap: boolean): boolean {
  return !isTouchingMap;
}

/** A fresh native map responder after every completed away-and-back cycle,
 *  mirroring the pattern proven on Discovery in Build 40.
 *
 *  The picker is reached and left repeatedly inside one activity draft — pick a
 *  spot, go back to fix the date, return to change the spot — and each of those
 *  returns can otherwise reuse a stale native view. Reliability is preferred
 *  over preserving the camera: remounting costs the user their zoom level,
 *  which is a far smaller problem than a map that will not move. */
export function nextLocationPickerMapGeneration(
  generation: number,
  hasBlurredSinceLastFocus: boolean,
): number {
  return hasBlurredSinceLastFocus ? generation + 1 : generation;
}

/** Foregrounding the app re-attaches the map for the same reason Discovery
 *  does: iOS can return a suspended MapKit view that renders but ignores
 *  touches. */
export function shouldRemountPickerMapForAppState(previous: string, next: string): boolean {
  return previous !== 'active' && next === 'active';
}

/** Reverse geocoding is a convenience that fills in the location name; the
 *  coordinates the parent chose are already committed by the time this is
 *  asked.
 *
 *  So it is deliberately deferred until the finger is off the map. Resolving
 *  mid-gesture flips a loading flag, which re-renders the form under the
 *  user's finger and can interrupt the drag being tracked. */
export function shouldResolveLocationName(isTouchingMap: boolean): boolean {
  return !isTouchingMap;
}

/** Whether a settled region is a real move worth reacting to.
 *
 *  `onRegionChangeComplete` also fires for the initial layout and for the
 *  programmatic `animateToRegion` after picking a search result. Treating
 *  those as user pans re-triggers reverse geocoding and overwrites the name the
 *  search result just supplied — which is why a picked place could revert to a
 *  street address on its own. */
export function isMeaningfulRegionChange(
  previous: { latitude: number; longitude: number } | null,
  next: { latitude: number; longitude: number },
  /** ~11 metres at the equator. Below this the map has not really moved and
   *  the change is layout noise or float drift. */
  epsilon = 0.0001,
): boolean {
  if (!previous) return false;
  return (
    Math.abs(previous.latitude - next.latitude) > epsilon ||
    Math.abs(previous.longitude - next.longitude) > epsilon
  );
}
