/**
 * Version auto-updater for KeepCode CLI.
 *
 * • On startup: silently checks npm for a newer version and shows a banner.
 * • `keepcode update` command: installs the latest version via npm.
 */

const PKG_NAME    = 'keepcode';
const NPM_REGISTRY = `https://registry.npmjs.org/${PKG_NAME}/latest`;

/** Compare two semver strings; returns true if remote > local */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

/**
 * Check npm for a newer version.
 * Returns the latest version string if an update is available, null otherwise.
 * Never throws — failures are silently swallowed.
 */
export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  try {
    // 3-second timeout so startup is not delayed
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(NPM_REGISTRY, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json() as { version?: string };
    const latest = data.version;
    if (!latest || !isNewer(currentVersion, latest)) return null;
    return latest;
  } catch {
    return null;
  }
}

/**
 * Print the update-available banner to stdout.
 */
export function printUpdateBanner(current: string, latest: string): void {
  const line = '─'.repeat(58);
  console.log(`\n  \x1b[33m┌${line}┐\x1b[0m`);
  console.log(`  \x1b[33m│\x1b[0m  \x1b[1mUpdate available\x1b[0m  ${current} → \x1b[32m${latest}\x1b[0m${' '.repeat(Math.max(0, 38 - current.length - latest.length))}  \x1b[33m│\x1b[0m`);
  console.log(`  \x1b[33m│\x1b[0m  Run: \x1b[36mnpm update -g keepcode\x1b[0m${' '.repeat(34)}  \x1b[33m│\x1b[0m`);
  console.log(`  \x1b[33m└${line}┘\x1b[0m\n`);
}

/**
 * Run the update by executing: npm update -g keepcode
 * Returns { success, message }.
 */
export async function applyUpdate(): Promise<{ success: boolean; message: string }> {
  const { execSync } = await import('child_process');
  try {
    execSync('npm update -g keepcode', { stdio: 'inherit' });
    return { success: true, message: 'KeepCode updated successfully!' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Update failed: ${msg}` };
  }
}
