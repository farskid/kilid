/**
 * Best-effort macOS detection, overridable everywhere it matters via options.
 * Evaluated lazily so the library stays importable in non-DOM environments.
 */
export function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}
