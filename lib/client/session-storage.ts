/** Read an app-owned session value, migrating a prior namespace by its known suffix.
 * Callers validate the payload before adopting it; newer values always win.
 */
export function readAppSession(suffix: string, accepts: (raw: string) => boolean): string | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.sessionStorage;
    const key = `retropilot:${suffix}`;
    const current = storage.getItem(key);
    if (current != null) return current;
    for (let i = 0; i < storage.length; i++) {
      const previous = storage.key(i);
      if (!previous || previous.startsWith("retropilot:") || !previous.endsWith(`:${suffix}`)) continue;
      const value = storage.getItem(previous);
      if (value == null) continue;
      try {
        if (!accepts(value)) continue;
        storage.setItem(key, value);
        storage.removeItem(previous);
        return value;
      } catch { /* Skip malformed or unrelated data. */ }
    }
  } catch { /* Storage may be unavailable; the app still works in memory. */ }
  return null;
}
