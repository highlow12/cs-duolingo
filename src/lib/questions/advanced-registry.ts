import type { QuestionDefinition } from "./registry";
import type {
  GraphPathQuestion,
  InteractiveSimulationQuestion,
  QuestionType,
  ValidationFailure,
  ValidationResult,
} from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE_FIELDS = [
  "schemaVersion",
  "id",
  "lessonId",
  "revision",
  "type",
  "prompt",
  "explanation",
  "tags",
  "difficulty",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(...errors: string[]): ValidationFailure {
  return { valid: false, errors };
}

function valid<T>(value: T): ValidationResult<T> {
  return { valid: true, value };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function unknownFields(
  candidate: Record<string, unknown>,
  allowed: string[],
  path: string,
): string[] {
  return Object.keys(candidate)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}.${key}: 정의되지 않은 필드입니다.`);
}

function validateBlocks(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0)
    return [`${path}: 하나 이상의 Content Block이 필요합니다.`];
  const errors: string[] = [];
  value.forEach((block, index) => {
    const at = `${path}[${index}]`;
    if (!isObject(block) || typeof block.type !== "string") {
      errors.push(`${at}: Content Block 객체와 type이 필요합니다.`);
      return;
    }
    if (block.type === "text" && !nonEmptyString(block.text))
      errors.push(`${at}.text: 비어 있을 수 없습니다.`);
    else if (block.type === "markdown" && !nonEmptyString(block.markdown))
      errors.push(`${at}.markdown: 비어 있을 수 없습니다.`);
    else if (block.type === "code") {
      if (!nonEmptyString(block.language))
        errors.push(`${at}.language: 비어 있을 수 없습니다.`);
      if (!nonEmptyString(block.code)) errors.push(`${at}.code: 비어 있을 수 없습니다.`);
    } else if (block.type === "image") {
      if (!nonEmptyString(block.src)) errors.push(`${at}.src: 비어 있을 수 없습니다.`);
      if (!nonEmptyString(block.alt)) errors.push(`${at}.alt: 비어 있을 수 없습니다.`);
    } else if (block.type === "diagram") {
      if (!nonEmptyString(block.diagramType))
        errors.push(`${at}.diagramType: 비어 있을 수 없습니다.`);
      if (!nonEmptyString(block.alt)) errors.push(`${at}.alt: 비어 있을 수 없습니다.`);
    } else if (!["text", "markdown", "code", "image", "diagram"].includes(block.type)) {
      errors.push(`${at}.type: 지원하지 않는 Content Block입니다.`);
    }
  });
  return errors;
}

function validateBase(
  value: unknown,
  type: QuestionType,
  fields: string[],
): string[] {
  if (!isObject(value)) return ["문제가 객체가 아닙니다."];
  const errors = unknownFields(value, [...BASE_FIELDS, ...fields], "question");
  if (value.schemaVersion !== 1) errors.push("question.schemaVersion: 1이어야 합니다.");
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id))
    errors.push("question.id: 올바른 ID 형식이 아닙니다.");
  if (typeof value.lessonId !== "string" || !ID_PATTERN.test(value.lessonId))
    errors.push("question.lessonId: 올바른 ID 형식이 아닙니다.");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1)
    errors.push("question.revision: 1 이상의 정수여야 합니다.");
  if (value.type !== type) errors.push(`question.type: ${type}이어야 합니다.`);
  errors.push(...validateBlocks(value.prompt, "question.prompt"));
  if (value.explanation !== undefined)
    errors.push(...validateBlocks(value.explanation, "question.explanation"));
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags)) errors.push("question.tags: 배열이어야 합니다.");
    else {
      const tags = value.tags.filter((tag): tag is string => typeof tag === "string");
      if (tags.length !== value.tags.length || tags.some((tag) => !ID_PATTERN.test(tag)))
        errors.push("question.tags: 모든 값이 올바른 ID여야 합니다.");
      if (duplicateValues(tags).length) errors.push("question.tags: 중복 값이 있습니다.");
    }
  }
  if (
    value.difficulty !== undefined &&
    (!Number.isInteger(value.difficulty) ||
      (value.difficulty as number) < 1 ||
      (value.difficulty as number) > 5)
  )
    errors.push("question.difficulty: 1에서 5 사이의 정수여야 합니다.");
  return errors;
}

function edgeAllowed(
  question: Pick<GraphPathQuestion, "edges" | "directed">,
  fromId: string,
  toId: string,
): boolean {
  return question.edges.some(
    (edge) =>
      (edge.fromId === fromId && edge.toId === toId) ||
      (!question.directed && edge.fromId === toId && edge.toId === fromId),
  );
}

function validatePath(
  question: Pick<
    GraphPathQuestion,
    "nodes" | "edges" | "directed" | "startNodeId" | "goalNodeId"
  >,
  path: unknown,
  at: string,
): string[] {
  if (!Array.isArray(path) || path.length < 2)
    return [`${at}: 시작과 도착을 포함한 두 개 이상의 node ID가 필요합니다.`];
  if (path.some((id) => typeof id !== "string"))
    return [`${at}: node ID 문자열 배열이어야 합니다.`];
  const nodeIds = path as string[];
  const errors: string[] = [];
  const known = new Set(question.nodes.map((node) => node.id));
  if (nodeIds[0] !== question.startNodeId)
    errors.push(`${at}: 첫 node는 startNodeId여야 합니다.`);
  if (nodeIds.at(-1) !== question.goalNodeId)
    errors.push(`${at}: 마지막 node는 goalNodeId여야 합니다.`);
  if (nodeIds.some((id) => !known.has(id)))
    errors.push(`${at}: 존재하지 않는 node ID가 있습니다.`);
  if (duplicateValues(nodeIds).length)
    errors.push(`${at}: 같은 node를 두 번 방문할 수 없습니다.`);
  for (let index = 1; index < nodeIds.length; index += 1) {
    if (!edgeAllowed(question, nodeIds[index - 1], nodeIds[index]))
      errors.push(`${at}: ${nodeIds[index - 1]} → ${nodeIds[index]} 간선이 없습니다.`);
  }
  return errors;
}

function validateGraphPathQuestion(
  value: unknown,
): ValidationResult<GraphPathQuestion> {
  const errors = validateBase(value, "graph-path", [
    "nodes",
    "edges",
    "directed",
    "startNodeId",
    "goalNodeId",
    "acceptedPaths",
  ]);
  if (!isObject(value)) return invalid(...errors);

  const nodeIds: string[] = [];
  if (!Array.isArray(value.nodes) || value.nodes.length < 2)
    errors.push("question.nodes: 두 개 이상의 node가 필요합니다.");
  else
    value.nodes.forEach((node, index) => {
      const at = `question.nodes[${index}]`;
      if (!isObject(node)) return void errors.push(`${at}: 객체여야 합니다.`);
      errors.push(...unknownFields(node, ["id", "label", "x", "y"], at));
      if (typeof node.id !== "string" || !ITEM_ID_PATTERN.test(node.id))
        errors.push(`${at}.id: 올바른 node ID가 아닙니다.`);
      else nodeIds.push(node.id);
      if (!nonEmptyString(node.label)) errors.push(`${at}.label: 비어 있을 수 없습니다.`);
      if (typeof node.x !== "number" || !Number.isFinite(node.x) || node.x < 0 || node.x > 100)
        errors.push(`${at}.x: 0에서 100 사이 숫자여야 합니다.`);
      if (typeof node.y !== "number" || !Number.isFinite(node.y) || node.y < 0 || node.y > 100)
        errors.push(`${at}.y: 0에서 100 사이 숫자여야 합니다.`);
    });
  if (duplicateValues(nodeIds).length) errors.push("question.nodes: 중복 ID가 있습니다.");

  const edgeKeys: string[] = [];
  if (!Array.isArray(value.edges) || value.edges.length === 0)
    errors.push("question.edges: 하나 이상의 edge가 필요합니다.");
  else
    value.edges.forEach((edge, index) => {
      const at = `question.edges[${index}]`;
      if (!isObject(edge)) return void errors.push(`${at}: 객체여야 합니다.`);
      errors.push(...unknownFields(edge, ["fromId", "toId"], at));
      if (typeof edge.fromId !== "string" || !nodeIds.includes(edge.fromId))
        errors.push(`${at}.fromId: 존재하는 node ID여야 합니다.`);
      if (typeof edge.toId !== "string" || !nodeIds.includes(edge.toId))
        errors.push(`${at}.toId: 존재하는 node ID여야 합니다.`);
      if (typeof edge.fromId === "string" && typeof edge.toId === "string")
        edgeKeys.push(`${edge.fromId}\u0000${edge.toId}`);
    });
  if (duplicateValues(edgeKeys).length) errors.push("question.edges: 중복 edge가 있습니다.");
  if (typeof value.directed !== "boolean") errors.push("question.directed: boolean이어야 합니다.");
  if (typeof value.startNodeId !== "string" || !nodeIds.includes(value.startNodeId))
    errors.push("question.startNodeId: 존재하는 node ID여야 합니다.");
  if (typeof value.goalNodeId !== "string" || !nodeIds.includes(value.goalNodeId))
    errors.push("question.goalNodeId: 존재하는 node ID여야 합니다.");
  if (value.startNodeId === value.goalNodeId)
    errors.push("question: startNodeId와 goalNodeId는 달라야 합니다.");

  if (!Array.isArray(value.acceptedPaths) || value.acceptedPaths.length === 0)
    errors.push("question.acceptedPaths: 하나 이상의 정답 경로가 필요합니다.");
  else if (
    typeof value.directed === "boolean" &&
    typeof value.startNodeId === "string" &&
    typeof value.goalNodeId === "string"
  ) {
    const partial = value as unknown as GraphPathQuestion;
    value.acceptedPaths.forEach((path, index) =>
      errors.push(...validatePath(partial, path, `question.acceptedPaths[${index}]`)),
    );
    const pathKeys = value.acceptedPaths
      .filter((path): path is string[] => Array.isArray(path) && path.every((id) => typeof id === "string"))
      .map((path) => path.join("\u0000"));
    if (duplicateValues(pathKeys).length)
      errors.push("question.acceptedPaths: 중복 경로가 있습니다.");
  }

  return errors.length ? invalid(...errors) : valid(value as unknown as GraphPathQuestion);
}

function samePath(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export const graphPathDefinition: QuestionDefinition<"graph-path"> = {
  type: "graph-path",
  validateQuestion: validateGraphPathQuestion,
  validateAnswer(question, value) {
    if (!isObject(value) || value.type !== "graph-path")
      return invalid("answer.type: graph-path여야 합니다.");
    const errors = validatePath(question, value.nodeIds, "answer.nodeIds");
    return errors.length ? invalid(...errors) : valid(value as never);
  },
  evaluate(question, answer) {
    const correct = question.acceptedPaths.some((path) => samePath(path, answer.nodeIds));
    return { correct, score: correct ? 1 : 0 };
  },
  canonicalAnswer(question) {
    return { type: "graph-path", nodeIds: [...question.acceptedPaths[0]] };
  },
};

function simulate(
  question: Pick<InteractiveSimulationQuestion, "transitions" | "initialStateId">,
  actionIds: string[],
): { stateId: string; valid: boolean } {
  let stateId = question.initialStateId;
  for (const actionId of actionIds) {
    const transition = question.transitions.find(
      (candidate) => candidate.fromStateId === stateId && candidate.actionId === actionId,
    );
    if (!transition) return { stateId, valid: false };
    stateId = transition.toStateId;
  }
  return { stateId, valid: true };
}

function validateInteractiveSimulationQuestion(
  value: unknown,
): ValidationResult<InteractiveSimulationQuestion> {
  const errors = validateBase(value, "interactive-simulation", [
    "states",
    "actions",
    "transitions",
    "initialStateId",
    "goalStateIds",
    "maxSteps",
    "canonicalActionIds",
  ]);
  if (!isObject(value)) return invalid(...errors);

  const stateIds: string[] = [];
  if (!Array.isArray(value.states) || value.states.length < 2)
    errors.push("question.states: 두 개 이상의 state가 필요합니다.");
  else
    value.states.forEach((state, index) => {
      const at = `question.states[${index}]`;
      if (!isObject(state)) return void errors.push(`${at}: 객체여야 합니다.`);
      errors.push(...unknownFields(state, ["id", "label"], at));
      if (typeof state.id !== "string" || !ITEM_ID_PATTERN.test(state.id))
        errors.push(`${at}.id: 올바른 state ID가 아닙니다.`);
      else stateIds.push(state.id);
      if (!nonEmptyString(state.label)) errors.push(`${at}.label: 비어 있을 수 없습니다.`);
    });
  if (duplicateValues(stateIds).length) errors.push("question.states: 중복 ID가 있습니다.");

  const actionIds: string[] = [];
  if (!Array.isArray(value.actions) || value.actions.length === 0)
    errors.push("question.actions: 하나 이상의 action이 필요합니다.");
  else
    value.actions.forEach((action, index) => {
      const at = `question.actions[${index}]`;
      if (!isObject(action)) return void errors.push(`${at}: 객체여야 합니다.`);
      errors.push(...unknownFields(action, ["id", "label"], at));
      if (typeof action.id !== "string" || !ITEM_ID_PATTERN.test(action.id))
        errors.push(`${at}.id: 올바른 action ID가 아닙니다.`);
      else actionIds.push(action.id);
      if (!nonEmptyString(action.label)) errors.push(`${at}.label: 비어 있을 수 없습니다.`);
    });
  if (duplicateValues(actionIds).length) errors.push("question.actions: 중복 ID가 있습니다.");

  const transitionKeys: string[] = [];
  if (!Array.isArray(value.transitions) || value.transitions.length === 0)
    errors.push("question.transitions: 하나 이상의 transition이 필요합니다.");
  else
    value.transitions.forEach((transition, index) => {
      const at = `question.transitions[${index}]`;
      if (!isObject(transition)) return void errors.push(`${at}: 객체여야 합니다.`);
      errors.push(
        ...unknownFields(transition, ["fromStateId", "actionId", "toStateId"], at),
      );
      if (typeof transition.fromStateId !== "string" || !stateIds.includes(transition.fromStateId))
        errors.push(`${at}.fromStateId: 존재하는 state ID여야 합니다.`);
      if (typeof transition.toStateId !== "string" || !stateIds.includes(transition.toStateId))
        errors.push(`${at}.toStateId: 존재하는 state ID여야 합니다.`);
      if (typeof transition.actionId !== "string" || !actionIds.includes(transition.actionId))
        errors.push(`${at}.actionId: 존재하는 action ID여야 합니다.`);
      if (typeof transition.fromStateId === "string" && typeof transition.actionId === "string")
        transitionKeys.push(`${transition.fromStateId}\u0000${transition.actionId}`);
    });
  if (duplicateValues(transitionKeys).length)
    errors.push("question.transitions: 같은 state와 action 조합은 하나만 허용됩니다.");

  if (typeof value.initialStateId !== "string" || !stateIds.includes(value.initialStateId))
    errors.push("question.initialStateId: 존재하는 state ID여야 합니다.");
  const goals = Array.isArray(value.goalStateIds)
    ? value.goalStateIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!Array.isArray(value.goalStateIds) || goals.length === 0)
    errors.push("question.goalStateIds: 하나 이상의 state ID가 필요합니다.");
  if (goals.length !== (Array.isArray(value.goalStateIds) ? value.goalStateIds.length : 0))
    errors.push("question.goalStateIds: 문자열 배열이어야 합니다.");
  if (duplicateValues(goals).length) errors.push("question.goalStateIds: 중복 ID가 있습니다.");
  if (goals.some((id) => !stateIds.includes(id)))
    errors.push("question.goalStateIds: 존재하지 않는 state ID가 있습니다.");
  if (typeof value.initialStateId === "string" && goals.includes(value.initialStateId))
    errors.push("question: initialStateId는 goalStateIds에 포함될 수 없습니다.");

  if (!Number.isInteger(value.maxSteps) || (value.maxSteps as number) < 1 || (value.maxSteps as number) > 50)
    errors.push("question.maxSteps: 1에서 50 사이의 정수여야 합니다.");
  const canonical = Array.isArray(value.canonicalActionIds)
    ? value.canonicalActionIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!Array.isArray(value.canonicalActionIds) || canonical.length === 0)
    errors.push("question.canonicalActionIds: 하나 이상의 action ID가 필요합니다.");
  if (canonical.length !== (Array.isArray(value.canonicalActionIds) ? value.canonicalActionIds.length : 0))
    errors.push("question.canonicalActionIds: 문자열 배열이어야 합니다.");
  if (canonical.some((id) => !actionIds.includes(id)))
    errors.push("question.canonicalActionIds: 존재하지 않는 action ID가 있습니다.");
  if (Number.isInteger(value.maxSteps) && canonical.length > (value.maxSteps as number))
    errors.push("question.canonicalActionIds: maxSteps를 초과할 수 없습니다.");
  if (
    typeof value.initialStateId === "string" &&
    Array.isArray(value.transitions) &&
    canonical.length > 0
  ) {
    const simulation = simulate(value as unknown as InteractiveSimulationQuestion, canonical);
    if (!simulation.valid)
      errors.push("question.canonicalActionIds: 실행할 수 없는 action 순서입니다.");
    else if (!goals.includes(simulation.stateId))
      errors.push("question.canonicalActionIds: goal state에 도달해야 합니다.");
  }

  return errors.length
    ? invalid(...errors)
    : valid(value as unknown as InteractiveSimulationQuestion);
}

export const interactiveSimulationDefinition: QuestionDefinition<"interactive-simulation"> = {
  type: "interactive-simulation",
  validateQuestion: validateInteractiveSimulationQuestion,
  validateAnswer(question, value) {
    if (!isObject(value) || value.type !== "interactive-simulation")
      return invalid("answer.type: interactive-simulation이어야 합니다.");
    if (!Array.isArray(value.actionIds) || value.actionIds.length === 0)
      return invalid("answer.actionIds: 하나 이상의 action ID가 필요합니다.");
    if (value.actionIds.some((id) => typeof id !== "string"))
      return invalid("answer.actionIds: 문자열 배열이어야 합니다.");
    const actionIds = value.actionIds as string[];
    if (actionIds.length > question.maxSteps)
      return invalid("answer.actionIds: maxSteps를 초과할 수 없습니다.");
    if (actionIds.some((id) => !question.actions.some((action) => action.id === id)))
      return invalid("answer.actionIds: 존재하지 않는 action ID가 있습니다.");
    if (!simulate(question, actionIds).valid)
      return invalid("answer.actionIds: 현재 state에서 실행할 수 없는 action이 있습니다.");
    return valid(value as never);
  },
  evaluate(question, answer) {
    const simulation = simulate(question, answer.actionIds);
    const correct = simulation.valid && question.goalStateIds.includes(simulation.stateId);
    return { correct, score: correct ? 1 : 0 };
  },
  canonicalAnswer(question) {
    return {
      type: "interactive-simulation",
      actionIds: [...question.canonicalActionIds],
    };
  },
};
