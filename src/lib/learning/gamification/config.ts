/** XP and goal values are policy, so keep them in one configuration module. */
export const XP_PER_CORRECT_ANSWER = 10;
export const DEFAULT_DAILY_GOAL = 20;
export const DEFAULT_REVIEW_LIMIT = 20;

export function localDateFor(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid study date");
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Compare local calendar dates without depending on UTC offsets. */
export function calendarDayDistance(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}
