/** The local-only marker used to avoid repeating the swipe discovery hint. */
export const TRACK_SWIPE_HINT_STORAGE_KEY = "cs-duolingo:track-swipe-hint-seen";

export interface TrackHintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Storage is optional because private browsing and embedded webviews can make
 * localStorage unavailable. The navigator should still be usable in either
 * case, so storage failures are treated as an unread hint.
 */
export function hasSeenTrackSwipeHint(
  storage: TrackHintStorage | null | undefined,
): boolean {
  try {
    return storage?.getItem(TRACK_SWIPE_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTrackSwipeHintSeen(
  storage: TrackHintStorage | null | undefined,
): void {
  try {
    storage?.setItem(TRACK_SWIPE_HINT_STORAGE_KEY, "1");
  } catch {
    // The hint is a convenience only. A blocked storage API must not block
    // track navigation or make the learning page fail to render.
  }
}

export type SwipeDirection = "previous" | "next";

/**
 * Classify a mostly-horizontal pointer movement. Vertical movement wins over
 * horizontal movement so a normal page scroll never changes the track.
 */
export function swipeDirection(
  deltaX: number,
  deltaY: number,
  threshold = 48,
): SwipeDirection | null {
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) <= Math.abs(deltaY)
  ) {
    return null;
  }
  return deltaX < 0 ? "next" : "previous";
}
