/** The running build's identity, for beta troubleshooting.
 *
 *  Read from the native bundle at runtime (Info.plist CFBundleShortVersionString
 *  and CFBundleVersion), never from app.json. The build number is assigned by
 *  EAS at build time under `appVersionSource: remote`, so it does not exist in
 *  any file in this repo — a hardcoded value would be a guess, and a wrong one
 *  is worse than none when the whole point is telling two builds apart.
 */
export function formatAppVersion(
  appName: string,
  version: string | null,
  build: string | null,
): string | null {
  if (!version) return null;
  return build ? `${appName} ${version} (${build})` : `${appName} ${version}`;
}
