# Apple Maps place search Edge Function

This function is the only component that knows Apple Maps Server API endpoints
or credentials. It signs ES256 authorization JWTs with the Web Crypto API built
into Deno, so no signing dependency is added to the mobile bundle or function.

Required server-only secrets:

- `APPLE_MAPS_TEAM_ID`
- `APPLE_MAPS_KEY_ID`
- `APPLE_MAPS_PRIVATE_KEY`

The function requires a valid Supabase bearer token and consumes the
database-backed `consume_place_search_rate_limit()` allowance before calling
Apple. It never returns credentials, Apple access tokens, or raw upstream
errors. The current mobile picker is intentionally not connected until Stage 2.

