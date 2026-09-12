import { describe, expect, it } from "vitest";
import { compileContent } from "../../scripts/content/compiler";
import { loadSourceContent } from "../../scripts/content/model";
import {
  missingPrerequisites,
  lessonStatus,
  visibleTracks,
} from "../../src/lib/curriculum/progress";
import {
  hasSeenTrackSwipeHint,
  markTrackSwipeHintSeen,
  swipeDirection,
  TRACK_SWIPE_HINT_STORAGE_KEY,
} from "../../src/lib/application/track-navigation";
import type { Curriculum, Lesson } from "../../src/lib/content/types";
import type { LessonState } from "../../src/lib/learning/domain/states";
const curriculum: Curriculum = {
  schemaVersion: 1,
  tracks: [],
  nodes: [
    { lesson: "root", requires: [] },
    { lesson: "branch", requires: ["root", "other"] },
  ],
};
const lesson = { id: "branch" } as Lesson;
const completed = (id: string) =>
  ({ lessonId: id, status: "completed" }) as LessonState;
describe("curriculum prerequisites", () => {
  it("requires every prerequisite and rejects absent nodes", () => {
    expect(
      missingPrerequisites("branch", curriculum, [completed("root")]),
    ).toEqual(["other"]);
    expect(missingPrerequisites("unknown", curriculum, [])).toEqual([
      "unknown",
    ]);
  });
  it("unlocks branches after completion and keeps completed lessons open", () => {
    expect(lessonStatus(lesson, curriculum, [])).toBe("locked");
    expect(
      lessonStatus(lesson, curriculum, [completed("root"), completed("other")]),
    ).toBe("available");
    expect(lessonStatus(lesson, curriculum, [completed("branch")])).toBe(
      "completed",
    );
  });
});

describe("visible learning tracks", () => {
  const tracksCurriculum: Curriculum = {
    schemaVersion: 1,
    tracks: [
      { id: "later", revision: 1, title: "Later", order: 40 },
      {
        id: "computer-architecture",
        revision: 1,
        title: "컴퓨터 구조",
        order: 20,
      },
      { id: "python", revision: 1, title: "Python 기초", order: 10 },
      { id: "discrete-math", revision: 1, title: "이산수학", order: 30 },
      { id: "empty", revision: 1, title: "Empty", order: 0 },
    ],
    nodes: [
      { lesson: "python-root", requires: [] },
      { lesson: "architecture-root", requires: [] },
      { lesson: "math-root", requires: [] },
      { lesson: "later-lesson", requires: ["python-root"] },
      { lesson: "locked-lesson", requires: ["missing"] },
    ],
  };
  const lessons = [
    { id: "python-root", track: "python" },
    { id: "architecture-root", track: "computer-architecture" },
    { id: "math-root", track: "discrete-math" },
    { id: "later-lesson", track: "later" },
    { id: "locked-lesson", track: "computer-architecture" },
  ] as Lesson[];

  it("shows the three initial tracks and omits locked or empty tracks", () => {
    expect(
      visibleTracks(tracksCurriculum, lessons, []).map((track) => track.id),
    ).toEqual(["python", "computer-architecture", "discrete-math"]);
    expect(
      visibleTracks(tracksCurriculum, lessons, [completed("math-root")]).map(
        (track) => track.id,
      ),
    ).toEqual(["python", "computer-architecture", "discrete-math"]);
    expect(
      visibleTracks(tracksCurriculum, lessons, [completed("python-root")]).map(
        (track) => track.id,
      ),
    ).toEqual(["python", "computer-architecture", "discrete-math", "later"]);
  });

  it("ships Python, computer architecture, and discrete math as root tracks", async () => {
    const compiled = compileContent(await loadSourceContent(process.cwd()));
    const lessons = [...compiled.lessons.values()] as Lesson[];
    expect(
      visibleTracks(compiled.curriculum as Curriculum, lessons, []).map(
        (track) => track.id,
      ),
    ).toEqual(["python", "computer-architecture", "discrete-math"]);
  });
});

describe("track swipe discovery state", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };

  it("persists the one-time hint and tolerates unavailable storage", () => {
    expect(hasSeenTrackSwipeHint(storage)).toBe(false);
    markTrackSwipeHintSeen(storage);
    expect(values.get(TRACK_SWIPE_HINT_STORAGE_KEY)).toBe("1");
    expect(hasSeenTrackSwipeHint(storage)).toBe(true);
    expect(hasSeenTrackSwipeHint(null)).toBe(false);
    expect(() => markTrackSwipeHintSeen(null)).not.toThrow();
    const unavailableStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };
    expect(hasSeenTrackSwipeHint(unavailableStorage)).toBe(false);
    expect(() => markTrackSwipeHintSeen(unavailableStorage)).not.toThrow();
  });

  it("recognizes horizontal swipes but ignores short or vertical movement", () => {
    expect(swipeDirection(-60, 10)).toBe("next");
    expect(swipeDirection(60, 10)).toBe("previous");
    expect(swipeDirection(-60, 80)).toBeNull();
    expect(swipeDirection(-30, 0)).toBeNull();
  });
});
