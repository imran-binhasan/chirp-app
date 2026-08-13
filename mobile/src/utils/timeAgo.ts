const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative timestamp for feed rows ("5m", "3h", "2d").
 *
 * Reads the clock via Date.now() rather than `new Date()` so tests can freeze
 * time without patching the Date constructor.
 */
export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (seconds < MINUTE) return `${Math.max(0, seconds)}s`;
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h`;
  return `${Math.floor(seconds / DAY)}d`;
}
