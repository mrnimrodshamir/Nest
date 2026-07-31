// Node's native ESM loader (used by `node --test --experimental-strip-types`)
// requires explicit file extensions on every relative import and doesn't
// probe for them — unlike tsc/Metro, which resolve `./foo` to `./foo.ts`
// automatically. Source files under src/ are written extensionless (correct
// for the app's real build via Metro), so this loader — used only by the
// `npm test` script, never by the app itself — retries a failed
// extensionless relative resolution by appending `.ts` before giving up.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
    if (isRelative && !hasExtension) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
