import { describe, expect, it } from "vitest";
import { validateAdvancedQuestion } from "../../scripts/content/advanced-question-validation";

function errorsFor(
  type: "graph-path" | "interactive-simulation",
  value: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  validateAdvancedQuestion(value, type, "question", errors);
  return errors;
}

describe("advanced question source validation", () => {
  it("accepts a valid graph path and rejects a path across a missing edge", () => {
    const valid = {
      nodes: [
        { id: "a", label: "A", x: 10, y: 50 },
        { id: "b", label: "B", x: 90, y: 50 },
      ],
      edges: [{ fromId: "a", toId: "b" }],
      directed: true,
      startNodeId: "a",
      goalNodeId: "b",
      acceptedPaths: [["a", "b"]],
    };

    expect(errorsFor("graph-path", valid)).toEqual([]);
    expect(
      errorsFor("graph-path", {
        ...valid,
        edges: [{ fromId: "b", toId: "a" }],
      }),
    ).toContain("question.acceptedPaths[0]: a → b 간선이 없습니다.");
  });

  it("allows the same action to be repeated when state transitions permit it", () => {
    const question = {
      states: [
        { id: "count-zero", label: "0" },
        { id: "count-one", label: "1" },
        { id: "count-two", label: "2" },
      ],
      actions: [{ id: "inc", label: "증가" }],
      transitions: [
        { fromStateId: "count-zero", actionId: "inc", toStateId: "count-one" },
        { fromStateId: "count-one", actionId: "inc", toStateId: "count-two" },
      ],
      initialStateId: "count-zero",
      goalStateIds: ["count-two"],
      maxSteps: 2,
      canonicalActionIds: ["inc", "inc"],
    };

    expect(errorsFor("interactive-simulation", question)).toEqual([]);
  });

  it("rejects nondeterministic state/action transitions", () => {
    const question = {
      states: [
        { id: "idle", label: "대기" },
        { id: "left", label: "왼쪽" },
        { id: "right", label: "오른쪽" },
      ],
      actions: [{ id: "go", label: "이동" }],
      transitions: [
        { fromStateId: "idle", actionId: "go", toStateId: "left" },
        { fromStateId: "idle", actionId: "go", toStateId: "right" },
      ],
      initialStateId: "idle",
      goalStateIds: ["left"],
      maxSteps: 1,
      canonicalActionIds: ["go"],
    };

    expect(errorsFor("interactive-simulation", question).some((error) =>
      error.includes("같은 state/action 전이는 하나만 허용됩니다"),
    )).toBe(true);
  });
});
