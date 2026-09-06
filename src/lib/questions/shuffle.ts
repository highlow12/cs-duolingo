/** Return a shuffled copy without ever mutating content owned by a question. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    const target = Math.floor(
      (Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0) *
        (index + 1),
    );
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

/**
 * Shuffle a copy and, where possible, avoid repeating the immediately prior
 * order.  The fallback swap makes deterministic test random sources useful
 * while preserving the source array.
 */
export function shuffleDistinct<T>(
  items: readonly T[],
  random: () => number = Math.random,
  previous?: readonly T[] | null,
): T[] {
  const shuffled = shuffle(items, random);
  if (
    previous &&
    shuffled.length > 1 &&
    shuffled.length === previous.length &&
    shuffled.every((item, index) => item === previous[index])
  ) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}
