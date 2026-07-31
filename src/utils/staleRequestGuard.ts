/** A tiny, framework-free helper for the "only the most recent async
 *  request may write its result" pattern used everywhere this app debounces
 *  search/geocoding (usePlaceSearch, LocationPicker's reverse-geocode).
 *  Pulled out on its own so the guarding logic itself is unit-testable
 *  without spinning up a React hook. */
export interface RequestGuard {
  /** Call when starting a new request — returns a token for that request. */
  next(): number;
  /** Call when a request resolves — true only if no newer request has
   *  started since this one's token was issued. */
  isCurrent(token: number): boolean;
  /** Invalidates any in-flight request without starting a new one (e.g.
   *  the query was cleared). */
  invalidate(): void;
}

export function createRequestGuard(): RequestGuard {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (token: number) => token === current,
    invalidate: () => {
      current += 1;
    },
  };
}
