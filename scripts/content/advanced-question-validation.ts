const ITEM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ADVANCED_QUESTION_TYPES = [
  "graph-path",
  "interactive-simulation",
] as const;

export type AdvancedQuestionType = (typeof ADVANCED_QUESTION_TYPES)[number];

export const ADVANCED_FIELDS_BY_TYPE: Record<AdvancedQuestionType, string[]> = {
  "graph-path": [
    "nodes",
    "edges",
    "directed",
    "startNodeId",
    "goalNodeId",
    "acceptedPaths",
  ],
  "interactive-simulation": [
    "states",
    "actions",
    "transitions",
    "initialStateId",
    "goalStateIds",
    "maxSteps",
    "canonicalActionIds",
  ],
};

export const ADVANCED_REQUIRED_BY_TYPE: Record<AdvancedQuestionType, string[]> = {
  "graph-path": [...ADVANCED_FIELDS_BY_TYPE["graph-path"]],
  "interactive-simulation": [
    ...ADVANCED_FIELDS_BY_TYPE["interactive-simulation"],
  ],
};

export function isAdvancedQuestionType(
  type: string,
): type is AdvancedQuestionType {
  return (ADVANCED_QUESTION_TYPES as readonly string[]).includes(type);
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fields(
  value: Record<string, unknown>,
  allowed: string[],
  required: string[],
  at: string,
  errors: string[],
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) errors.push(`${at}.${key}: 정의되지 않은 필드입니다.`);
  for (const key of required)
    if (!(key in value)) errors.push(`${at}.${key}: 필수 필드입니다.`);
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function itemId(value: unknown, at: string, errors: string[]): value is string {
  if (typeof value !== "string" || !ITEM_ID.test(value)) {
    errors.push(`${at}: 올바른 ID가 아닙니다.`);
    return false;
  }
  return true;
}

function stringIds(
  value: unknown,
  at: string,
  errors: string[],
  options: { nonEmpty?: boolean; known?: Set<string> } = {},
): string[] {
  if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) {
    errors.push(`${at}: ${options.nonEmpty ? "하나 이상의 " : ""}ID 배열이어야 합니다.`);
    return [];
  }
  const ids: string[] = [];
  value.forEach((entry, index) => {
    if (itemId(entry, `${at}[${index}]`, errors)) {
      ids.push(entry);
      if (options.known && !options.known.has(entry))
        errors.push(`${at}[${index}]: 존재하지 않는 ID ${entry}`);
    }
  });
  for (const duplicate of duplicateValues(ids))
    errors.push(`${at}: 중복 ID ${duplicate}`);
  return ids;
}

interface GraphShape {
  directed: boolean;
  nodes: Set<string>;
  edges: Array<{ fromId: string; toId: string }>;
  startNodeId: string;
  goalNodeId: string;
}

function edgeAllowed(
  graph: GraphShape,
  fromId: string,
  toId: string,
): boolean {
  return graph.edges.some(
    (edge) =>
      (edge.fromId === fromId && edge.toId === toId) ||
      (!graph.directed && edge.fromId === toId && edge.toId === fromId),
  );
}

function validateGraphPath(
  value: Record<string, unknown>,
  at: string,
  errors: string[],
): void {
  const nodeIds: string[] = [];
  if (!Array.isArray(value.nodes) || value.nodes.length < 2)
    errors.push(`${at}.nodes: 두 개 이상의 node가 필요합니다.`);
  else
    value.nodes.forEach((node, index) => {
      const here = `${at}.nodes[${index}]`;
      if (!object(node)) return void errors.push(`${here}: 객체여야 합니다.`);
      fields(node, ["id", "label", "x", "y"], ["id", "label", "x", "y"], here, errors);
      if (itemId(node.id, `${here}.id`, errors)) nodeIds.push(node.id);
      if (!text(node.label)) errors.push(`${here}.label: 비어 있지 않은 문자열이어야 합니다.`);
      if (typeof node.x !== "number" || !Number.isFinite(node.x) || node.x < 0 || node.x > 100)
        errors.push(`${here}.x: 0 ~ 100 숫자여야 합니다.`);
      if (typeof node.y !== "number" || !Number.isFinite(node.y) || node.y < 0 || node.y > 100)
        errors.push(`${here}.y: 0 ~ 100 숫자여야 합니다.`);
    });
  for (const duplicate of duplicateValues(nodeIds))
    errors.push(`${at}.nodes: 중복 ID ${duplicate}`);
  const knownNodes = new Set(nodeIds);

  const edges: Array<{ fromId: string; toId: string }> = [];
  const edgeKeys: string[] = [];
  if (!Array.isArray(value.edges) || value.edges.length === 0)
    errors.push(`${at}.edges: 하나 이상의 edge가 필요합니다.`);
  else
    value.edges.forEach((edge, index) => {
      const here = `${at}.edges[${index}]`;
      if (!object(edge)) return void errors.push(`${here}: 객체여야 합니다.`);
      fields(edge, ["fromId", "toId"], ["fromId", "toId"], here, errors);
      const fromId = itemId(edge.fromId, `${here}.fromId`, errors) ? edge.fromId : "";
      const toId = itemId(edge.toId, `${here}.toId`, errors) ? edge.toId : "";
      if (fromId && !knownNodes.has(fromId))
        errors.push(`${here}.fromId: 존재하지 않는 node ID입니다.`);
      if (toId && !knownNodes.has(toId))
        errors.push(`${here}.toId: 존재하지 않는 node ID입니다.`);
      if (fromId && toId) {
        edges.push({ fromId, toId });
        const key = value.directed === false
          ? [fromId, toId].sort().join("\u0000")
          : `${fromId}\u0000${toId}`;
        edgeKeys.push(key);
      }
    });
  for (const duplicate of duplicateValues(edgeKeys))
    errors.push(`${at}.edges: 중복 edge ${duplicate.replace("\u0000", " → ")}`);

  if (typeof value.directed !== "boolean")
    errors.push(`${at}.directed: boolean이어야 합니다.`);
  const startNodeId = itemId(value.startNodeId, `${at}.startNodeId`, errors)
    ? value.startNodeId
    : "";
  const goalNodeId = itemId(value.goalNodeId, `${at}.goalNodeId`, errors)
    ? value.goalNodeId
    : "";
  if (startNodeId && !knownNodes.has(startNodeId))
    errors.push(`${at}.startNodeId: 존재하지 않는 node ID입니다.`);
  if (goalNodeId && !knownNodes.has(goalNodeId))
    errors.push(`${at}.goalNodeId: 존재하지 않는 node ID입니다.`);
  if (startNodeId && startNodeId === goalNodeId)
    errors.push(`${at}: startNodeId와 goalNodeId는 달라야 합니다.`);

  if (!Array.isArray(value.acceptedPaths) || value.acceptedPaths.length === 0) {
    errors.push(`${at}.acceptedPaths: 하나 이상의 정답 경로가 필요합니다.`);
    return;
  }
  const graph: GraphShape = {
    directed: value.directed === true,
    nodes: knownNodes,
    edges,
    startNodeId,
    goalNodeId,
  };
  const pathKeys: string[] = [];
  value.acceptedPaths.forEach((path, index) => {
    const here = `${at}.acceptedPaths[${index}]`;
    if (!Array.isArray(path) || path.length < 2) {
      errors.push(`${here}: 시작과 목표를 포함한 두 개 이상의 node ID가 필요합니다.`);
      return;
    }
    const ids = stringIds(path, here, errors, { known: knownNodes });
    if (ids.length !== path.length) return;
    pathKeys.push(ids.join("\u0000"));
    if (ids[0] !== startNodeId)
      errors.push(`${here}: 첫 node는 startNodeId여야 합니다.`);
    if (ids.at(-1) !== goalNodeId)
      errors.push(`${here}: 마지막 node는 goalNodeId여야 합니다.`);
    for (let step = 1; step < ids.length; step += 1)
      if (!edgeAllowed(graph, ids[step - 1], ids[step]))
        errors.push(`${here}: ${ids[step - 1]} → ${ids[step]} 간선이 없습니다.`);
  });
  for (const duplicate of duplicateValues(pathKeys))
    errors.push(`${at}.acceptedPaths: 중복 경로 ${duplicate}`);
}

function simulate(
  initialStateId: string,
  transitions: Array<{ fromStateId: string; actionId: string; toStateId: string }>,
  actionIds: string[],
): { valid: boolean; stateId: string } {
  let stateId = initialStateId;
  for (const actionId of actionIds) {
    const transition = transitions.find(
      (candidate) => candidate.fromStateId === stateId && candidate.actionId === actionId,
    );
    if (!transition) return { valid: false, stateId };
    stateId = transition.toStateId;
  }
  return { valid: true, stateId };
}

function validateInteractiveSimulation(
  value: Record<string, unknown>,
  at: string,
  errors: string[],
): void {
  const stateIds: string[] = [];
  if (!Array.isArray(value.states) || value.states.length < 2)
    errors.push(`${at}.states: 두 개 이상의 state가 필요합니다.`);
  else
    value.states.forEach((state, index) => {
      const here = `${at}.states[${index}]`;
      if (!object(state)) return void errors.push(`${here}: 객체여야 합니다.`);
      fields(state, ["id", "label"], ["id", "label"], here, errors);
      if (itemId(state.id, `${here}.id`, errors)) stateIds.push(state.id);
      if (!text(state.label)) errors.push(`${here}.label: 비어 있지 않은 문자열이어야 합니다.`);
    });
  for (const duplicate of duplicateValues(stateIds))
    errors.push(`${at}.states: 중복 ID ${duplicate}`);
  const knownStates = new Set(stateIds);

  const actionIds: string[] = [];
  if (!Array.isArray(value.actions) || value.actions.length === 0)
    errors.push(`${at}.actions: 하나 이상의 action이 필요합니다.`);
  else
    value.actions.forEach((action, index) => {
      const here = `${at}.actions[${index}]`;
      if (!object(action)) return void errors.push(`${here}: 객체여야 합니다.`);
      fields(action, ["id", "label"], ["id", "label"], here, errors);
      if (itemId(action.id, `${here}.id`, errors)) actionIds.push(action.id);
      if (!text(action.label)) errors.push(`${here}.label: 비어 있지 않은 문자열이어야 합니다.`);
    });
  for (const duplicate of duplicateValues(actionIds))
    errors.push(`${at}.actions: 중복 ID ${duplicate}`);
  const knownActions = new Set(actionIds);

  const transitions: Array<{
    fromStateId: string;
    actionId: string;
    toStateId: string;
  }> = [];
  const transitionKeys: string[] = [];
  if (!Array.isArray(value.transitions) || value.transitions.length === 0)
    errors.push(`${at}.transitions: 하나 이상의 transition이 필요합니다.`);
  else
    value.transitions.forEach((transition, index) => {
      const here = `${at}.transitions[${index}]`;
      if (!object(transition)) return void errors.push(`${here}: 객체여야 합니다.`);
      fields(
        transition,
        ["fromStateId", "actionId", "toStateId"],
        ["fromStateId", "actionId", "toStateId"],
        here,
        errors,
      );
      const fromStateId = itemId(transition.fromStateId, `${here}.fromStateId`, errors)
        ? transition.fromStateId
        : "";
      const actionId = itemId(transition.actionId, `${here}.actionId`, errors)
        ? transition.actionId
        : "";
      const toStateId = itemId(transition.toStateId, `${here}.toStateId`, errors)
        ? transition.toStateId
        : "";
      if (fromStateId && !knownStates.has(fromStateId))
        errors.push(`${here}.fromStateId: 존재하지 않는 state ID입니다.`);
      if (toStateId && !knownStates.has(toStateId))
        errors.push(`${here}.toStateId: 존재하지 않는 state ID입니다.`);
      if (actionId && !knownActions.has(actionId))
        errors.push(`${here}.actionId: 존재하지 않는 action ID입니다.`);
      if (fromStateId && actionId && toStateId) {
        transitions.push({ fromStateId, actionId, toStateId });
        transitionKeys.push(`${fromStateId}\u0000${actionId}`);
      }
    });
  for (const duplicate of duplicateValues(transitionKeys))
    errors.push(`${at}.transitions: 같은 state/action 전이는 하나만 허용됩니다: ${duplicate}`);

  const initialStateId = itemId(value.initialStateId, `${at}.initialStateId`, errors)
    ? value.initialStateId
    : "";
  if (initialStateId && !knownStates.has(initialStateId))
    errors.push(`${at}.initialStateId: 존재하지 않는 state ID입니다.`);
  const goalStateIds = stringIds(value.goalStateIds, `${at}.goalStateIds`, errors, {
    nonEmpty: true,
    known: knownStates,
  });
  if (initialStateId && goalStateIds.includes(initialStateId))
    errors.push(`${at}: initialStateId는 goalStateIds에 포함될 수 없습니다.`);

  if (!Number.isInteger(value.maxSteps) || (value.maxSteps as number) < 1 || (value.maxSteps as number) > 50)
    errors.push(`${at}.maxSteps: 1 ~ 50 정수여야 합니다.`);
  const canonicalActionIds = stringIds(
    value.canonicalActionIds,
    `${at}.canonicalActionIds`,
    errors,
    { nonEmpty: true, known: knownActions },
  );
  if (Number.isInteger(value.maxSteps) && canonicalActionIds.length > (value.maxSteps as number))
    errors.push(`${at}.canonicalActionIds: maxSteps를 초과할 수 없습니다.`);
  if (initialStateId && canonicalActionIds.length) {
    const result = simulate(initialStateId, transitions, canonicalActionIds);
    if (!result.valid)
      errors.push(`${at}.canonicalActionIds: 실행할 수 없는 action 순서입니다.`);
    else if (!goalStateIds.includes(result.stateId))
      errors.push(`${at}.canonicalActionIds: goal state에 도달해야 합니다.`);
  }
}

export function validateAdvancedQuestion(
  value: Record<string, unknown>,
  type: AdvancedQuestionType,
  at: string,
  errors: string[],
): void {
  if (type === "graph-path") validateGraphPath(value, at, errors);
  else validateInteractiveSimulation(value, at, errors);
}
