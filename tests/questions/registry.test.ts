import { describe, expect, it } from "vitest";
import {
  evaluateQuestion,
  questionPlugins,
} from "../../src/lib/questions/registry";
import type {
  CodeCompletionQuestion,
  CodeOutputQuestion,
  FillBlankQuestion,
  GraphPathQuestion,
  InteractiveSimulationQuestion,
  MatchingQuestion,
  MultiSelectQuestion,
  OrderingQuestion,
  SingleChoiceQuestion,
} from "../../src/lib/questions/types";

const prompt = [{ type: "text" as const, text: "test" }];
const option = (id: string) => ({ id, content: prompt });

function result(question: unknown, answer: unknown) {
  const outcome = evaluateQuestion(question, answer);
  expect(outcome.status).toBe("evaluated");
  if (outcome.status === "error") throw new Error(outcome.error.message);
  return outcome.result;
}

describe("question registry", () => {
  it("registers all nine question types", () => {
    expect(questionPlugins.size).toBe(9);
  });

  it("evaluates single-choice and fill-blank", () => {
    const single: SingleChoiceQuestion = {
      schemaVersion: 1,
      id: "test.single-choice",
      lessonId: "test",
      revision: 1,
      type: "single-choice",
      prompt,
      options: [option("a"), option("b")],
      correctOptionId: "b",
      shuffleOptions: false,
    };
    expect(
      result(single, { type: "single-choice", optionId: "b" }).correct,
    ).toBe(true);
    expect(
      result(single, { type: "single-choice", optionId: "a" }).correct,
    ).toBe(false);

    const fill: FillBlankQuestion = {
      schemaVersion: 1,
      id: "test.fill-blank",
      lessonId: "test",
      revision: 1,
      type: "fill-blank",
      prompt,
      choices: ["a b", "답", "wrong"],
      acceptedAnswers: ["a b", "답"],
    };
    expect(
      result(fill, { type: "fill-blank", value: "  a\n b  " }).correct,
    ).toBe(true);
    expect(result(fill, { type: "fill-blank", value: "wrong" }).correct).toBe(
      false,
    );
  });

  it("compares multi-select answers as sets", () => {
    const question: MultiSelectQuestion = {
      schemaVersion: 1,
      id: "test.multi-select",
      lessonId: "test",
      revision: 1,
      type: "multi-select",
      prompt,
      options: [option("a"), option("b"), option("c")],
      correctOptionIds: ["a", "c"],
      shuffleOptions: false,
    };
    expect(
      result(question, { type: "multi-select", optionIds: ["c", "a"] }).correct,
    ).toBe(true);
    expect(
      result(question, { type: "multi-select", optionIds: ["a", "b"] }).correct,
    ).toBe(false);
  });

  it("requires the exact ordering", () => {
    const question: OrderingQuestion = {
      schemaVersion: 1,
      id: "test.ordering",
      lessonId: "test",
      revision: 1,
      type: "ordering",
      prompt,
      items: [option("first"), option("second"), option("third")],
      correctOrder: ["first", "second", "third"],
    };
    expect(
      result(question, {
        type: "ordering",
        orderedItemIds: ["first", "second", "third"],
      }).correct,
    ).toBe(true);
    expect(
      result(question, {
        type: "ordering",
        orderedItemIds: ["second", "first", "third"],
      }).correct,
    ).toBe(false);
  });

  it("compares matching pairs without depending on pair order", () => {
    const question: MatchingQuestion = {
      schemaVersion: 1,
      id: "test.matching",
      lessonId: "test",
      revision: 1,
      type: "matching",
      prompt,
      leftItems: [option("left-a"), option("left-b")],
      rightItems: [option("right-a"), option("right-b")],
      correctPairs: [
        { leftId: "left-a", rightId: "right-a" },
        { leftId: "left-b", rightId: "right-b" },
      ],
    };
    expect(
      result(question, {
        type: "matching",
        pairs: [
          { leftId: "left-b", rightId: "right-b" },
          { leftId: "left-a", rightId: "right-a" },
        ],
      }).correct,
    ).toBe(true);
    expect(
      result(question, {
        type: "matching",
        pairs: [
          { leftId: "left-a", rightId: "right-b" },
          { leftId: "left-b", rightId: "right-a" },
        ],
      }).correct,
    ).toBe(false);
  });

  it("normalizes code output while preserving meaningful indentation", () => {
    const question: CodeOutputQuestion = {
      schemaVersion: 1,
      id: "test.code-output",
      lessonId: "test",
      revision: 1,
      type: "code-output",
      prompt,
      language: "python",
      code: "print(1)",
      choices: ["one\ntwo", "two\none", ""],
      acceptedOutputs: ["one\ntwo"],
    };
    expect(
      result(question, { type: "code-output", value: "one  \r\ntwo\n" })
        .correct,
    ).toBe(true);
    expect(
      result(question, { type: "code-output", value: "two\none" }).correct,
    ).toBe(false);
  });

  it("evaluates every code-completion blank", () => {
    const question: CodeCompletionQuestion = {
      schemaVersion: 1,
      id: "test.code-completion",
      lessonId: "test",
      revision: 1,
      type: "code-completion",
      prompt,
      language: "python",
      template: "x = {{blank:value}}",
      blanks: [
        {
          id: "value",
          choices: ["1 + 2", "1 - 2"],
          acceptedAnswers: ["1 + 2"],
        },
      ],
    };
    expect(
      result(question, {
        type: "code-completion",
        values: { value: "  1   +  2 " },
      }).correct,
    ).toBe(true);
    expect(
      result(question, { type: "code-completion", values: { value: "1 - 2" } })
        .correct,
    ).toBe(false);
  });

  it("evaluates graph paths while rejecting impossible moves", () => {
    const question: GraphPathQuestion = {
      schemaVersion: 1,
      id: "test.graph-path",
      lessonId: "test",
      revision: 1,
      type: "graph-path",
      prompt,
      directed: true,
      nodes: [
        { id: "a", label: "A", x: 10, y: 50 },
        { id: "b", label: "B", x: 40, y: 20 },
        { id: "c", label: "C", x: 40, y: 80 },
        { id: "d", label: "D", x: 85, y: 50 },
      ],
      edges: [
        { fromId: "a", toId: "b" },
        { fromId: "b", toId: "d" },
        { fromId: "a", toId: "c" },
        { fromId: "c", toId: "d" },
      ],
      startNodeId: "a",
      goalNodeId: "d",
      acceptedPaths: [["a", "b", "d"]],
    };

    expect(
      result(question, { type: "graph-path", nodeIds: ["a", "b", "d"] })
        .correct,
    ).toBe(true);
    expect(
      result(question, { type: "graph-path", nodeIds: ["a", "c", "d"] })
        .correct,
    ).toBe(false);

    expect(
      evaluateQuestion(question, { type: "graph-path", nodeIds: ["a", "d"] }),
    ).toMatchObject({ status: "error", error: { code: "invalid-answer" } });
  });

  it("evaluates deterministic interactive simulations by reached state", () => {
    const question: InteractiveSimulationQuestion = {
      schemaVersion: 1,
      id: "test.interactive-simulation",
      lessonId: "test",
      revision: 1,
      type: "interactive-simulation",
      prompt,
      states: [
        { id: "idle", label: "대기" },
        { id: "running", label: "실행 중" },
        { id: "done", label: "완료" },
      ],
      actions: [
        { id: "start", label: "시작" },
        { id: "finish", label: "완료" },
        { id: "abort", label: "중단" },
      ],
      transitions: [
        { fromStateId: "idle", actionId: "start", toStateId: "running" },
        { fromStateId: "running", actionId: "finish", toStateId: "done" },
        { fromStateId: "running", actionId: "abort", toStateId: "idle" },
      ],
      initialStateId: "idle",
      goalStateIds: ["done"],
      maxSteps: 3,
      canonicalActionIds: ["start", "finish"],
    };

    expect(
      result(question, {
        type: "interactive-simulation",
        actionIds: ["start", "finish"],
      }).correct,
    ).toBe(true);
    expect(
      result(question, {
        type: "interactive-simulation",
        actionIds: ["start"],
      }).correct,
    ).toBe(false);
    expect(
      evaluateQuestion(question, {
        type: "interactive-simulation",
        actionIds: ["finish"],
      }),
    ).toMatchObject({ status: "error", error: { code: "invalid-answer" } });
  });

  it("only accepts values offered by the question choices", () => {
    const fill: FillBlankQuestion = {
      schemaVersion: 1,
      id: "test.fill-blank-choices",
      lessonId: "test",
      revision: 1,
      type: "fill-blank",
      prompt,
      choices: ["yes", "no"],
      acceptedAnswers: ["yes"],
    };
    const outcome = evaluateQuestion(fill, {
      type: "fill-blank",
      value: "outside",
    });
    expect(outcome).toMatchObject({
      status: "error",
      error: { code: "invalid-answer" },
    });

    const invalidQuestion = {
      ...fill,
      choices: ["yes", " yes "],
    };
    const invalid = evaluateQuestion(invalidQuestion, {
      type: "fill-blank",
      value: "yes",
    });
    expect(invalid).toMatchObject({
      status: "error",
      error: { code: "invalid-question" },
    });
  });
});
