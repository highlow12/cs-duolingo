import { describe, expect, it } from "vitest";
import { evaluateQuestion } from "../../src/lib/questions/registry";
import type {
  FillBlankQuestion,
  SingleChoiceQuestion,
} from "../../src/lib/questions/types";

const prompt = [{ type: "text" as const, text: "test" }];

describe("question registry", () => {
  it("evaluates a single-choice question", () => {
    const question: SingleChoiceQuestion = {
      id: "test.single-choice",
      revision: 1,
      type: "single-choice",
      prompt,
      options: [
        { id: "a", content: prompt },
        { id: "b", content: prompt },
      ],
      correctOptionId: "b",
    };

    expect(evaluateQuestion(question, { optionId: "b" }).correct).toBe(true);
    expect(evaluateQuestion(question, { optionId: "a" }).correct).toBe(false);
  });

  it("normalizes fill-blank answers", () => {
    const question: FillBlankQuestion = {
      id: "test.fill-blank",
      revision: 1,
      type: "fill-blank",
      prompt,
      answer: "answer",
      acceptedAnswers: ["답"],
    };

    expect(evaluateQuestion(question, { value: " Answer " }).correct).toBe(
      true,
    );
    expect(evaluateQuestion(question, { value: "wrong" }).correct).toBe(false);
  });
});
