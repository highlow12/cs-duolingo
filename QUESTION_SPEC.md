# CS 듀오링고 Question Engine 상세 명세 v1

> 이 문서는 검증된 Question 콘텐츠를 앱에서 표시하고 평가하는 런타임 계약을 정의한다. 작성 YAML과 generated Question 구조는 `CONTENT_SPEC.md`, 상위 아키텍처와 도메인 경계는 `SYSTEM_SPEC.md`를 따른다.

## 1. 목적과 범위

Question Engine은 다음 책임을 가진다.

- Question type에 맞는 Plugin 조회
- Question과 UserAnswer의 런타임 검증
- 답안 선택 UI 렌더링
- 명시적 제출과 최대 두 번의 시도 관리
- UI와 분리된 순수 evaluator 실행
- feedback, 정답, explanation 표시 상태 관리
- 유효한 시도 결과를 Lesson 또는 Review에 전달
- 문제 풀이 중 접근성 보장

v1은 다음 7개 type을 지원한다.

```text
single-choice
multi-select
fill-blank
ordering
matching
code-output
code-completion
```

`single-choice`와 `fill-blank`를 먼저 구현해 공통 구조를 검증한 뒤 같은 계약으로 나머지 5개 type을 구현한다.

다음 항목은 이 명세의 범위가 아니다.

- StudyEvent 저장과 FSRS 반영 정책
- Lesson 완료 상태와 session 영속화
- 힌트
- 부분 점수
- 문제별 정답·오답 feedback 문구
- Python 또는 사용자 코드 실행
- Question별 전용 animation

## 2. 설계 원칙

### 2.1 책임 분리

```text
Question Host
├─ Plugin Registry 조회
├─ 시도와 시간 관리
├─ evaluator 호출
├─ 공통 feedback과 explanation
└─ attempt 전달
        │
        └─ Plugin Renderer
           ├─ type별 답안 선택
           └─ UserAnswer 제출 요청

Pure Plugin Definition
├─ validateQuestion
├─ validateAnswer
├─ evaluate
└─ canonicalAnswer
```

- Plugin Renderer는 답안을 구성하지만 채점하지 않는다.
- evaluator는 Svelte component, browser API, storage에 의존하지 않는다.
- Question Host는 type별 정답 규칙을 알지 않는다.
- Lesson과 Review는 동일한 Question Host를 사용한다.
- UI는 StudyEvent나 Dexie를 직접 생성하거나 호출하지 않는다.

### 2.2 유효한 평가와 시스템 오류 분리

사용자가 틀린 답을 제출한 것은 정상 평가다. Question과 Answer의 type이 다르거나 존재하지 않는 option ID가 들어온 것은 내부 형식 오류다.

내부 형식 오류를 오답으로 기록하면 학습 기록이 오염되므로 두 결과를 별도로 표현한다.

### 2.3 한 문제 최대 두 번 제출

- 첫 제출이 정답이면 문제를 완료한다.
- 첫 제출이 오답이면 정답을 공개하지 않고 한 번의 재시도를 필수로 제공한다.
- 두 번째 제출은 정오답과 관계없이 문제를 완료한다.
- 두 번의 유효한 제출은 각각 별도 attempt로 상위 계층에 전달한다.
- 평가 형식 오류는 attempt를 소비하지 않는다.

## 3. 런타임 Question 타입

generated Question은 `CONTENT_SPEC.md`의 schema를 그대로 사용하고 source 위치에서 유도한 `lessonId`를 추가한다.

```ts
interface QuestionBase {
  schemaVersion: 1;
  id: string;
  lessonId: string;
  revision: number;
  type: QuestionType;
  prompt: ContentBlock[];
  explanation?: ContentBlock[];
  tags?: string[];
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

type QuestionType =
  | "single-choice"
  | "multi-select"
  | "fill-blank"
  | "ordering"
  | "matching"
  | "code-output"
  | "code-completion";
```

각 Question type의 type-specific 필드는 `CONTENT_SPEC.md` Section 11을 따른다. 런타임은 이전 source 형식의 alias를 지원하지 않는다.

예를 들어 다음 필드는 v1 런타임 계약이 아니다.

```text
fill-blank.answer
matching.pairs
code-output.answer
code-completion.code
code-completion.answer
```

이전 콘텐츠는 Builder에서 현재 generated 계약으로 migration해야 한다.

## 4. UserAnswer 타입

모든 답안은 Question과 같은 `type` discriminator를 가진다. Question ID는 호출자가 이미 Question과 Answer를 함께 전달하므로 답안에 중복하지 않는다.

```ts
interface SingleChoiceAnswer {
  type: "single-choice";
  optionId: string;
}

interface MultiSelectAnswer {
  type: "multi-select";
  optionIds: string[];
}

interface FillBlankAnswer {
  type: "fill-blank";
  value: string;
}

interface OrderingAnswer {
  type: "ordering";
  orderedItemIds: string[];
}

interface MatchingAnswerPair {
  leftId: string;
  rightId: string;
}

interface MatchingAnswer {
  type: "matching";
  pairs: MatchingAnswerPair[];
}

interface CodeOutputAnswer {
  type: "code-output";
  value: string;
}

interface CodeCompletionAnswer {
  type: "code-completion";
  values: Record<string, string>;
}

type UserAnswer =
  | SingleChoiceAnswer
  | MultiSelectAnswer
  | FillBlankAnswer
  | OrderingAnswer
  | MatchingAnswer
  | CodeOutputAnswer
  | CodeCompletionAnswer;

interface QuestionByType {
  "single-choice": SingleChoiceQuestion;
  "multi-select": MultiSelectQuestion;
  "fill-blank": FillBlankQuestion;
  ordering: OrderingQuestion;
  matching: MatchingQuestion;
  "code-output": CodeOutputQuestion;
  "code-completion": CodeCompletionQuestion;
}

interface AnswerByType {
  "single-choice": SingleChoiceAnswer;
  "multi-select": MultiSelectAnswer;
  "fill-blank": FillBlankAnswer;
  ordering: OrderingAnswer;
  matching: MatchingAnswer;
  "code-output": CodeOutputAnswer;
  "code-completion": CodeCompletionAnswer;
}

type QuestionOf<T extends QuestionType> = QuestionByType[T];
type AnswerOf<T extends QuestionType> = AnswerByType[T];
```

답안은 제출 시점의 snapshot이다. Renderer의 mutable state를 그대로 외부에 노출하지 않는다.

`FillBlankAnswer.value`와 `CodeOutputAnswer.value`의 문자열 구조는 유지하지만, 값은 사용자가 선택한 `choices` 항목이다. `CodeCompletionAnswer.values`도 각 blank에서 사용자가 선택한 문자열을 blank ID에 매핑한 값이다. 세 유형의 답안은 항상 choices에서 선택한다.

## 5. 평가 계약

### 5.1 평가 결과

```ts
interface EvaluationResult {
  correct: boolean;
  score: 0 | 1;
}

type EvaluationErrorCode =
  | "unregistered-question-type"
  | "invalid-question"
  | "answer-type-mismatch"
  | "invalid-answer";

interface EvaluationError {
  code: EvaluationErrorCode;
  message: string;
  details?: string[];
}

type EvaluationOutcome =
  | { status: "evaluated"; result: EvaluationResult }
  | { status: "error"; error: EvaluationError };
```

규칙은 다음과 같다.

- `correct: true`이면 `score: 1`, `correct: false`이면 `score: 0`이다.
- evaluator는 사용자 표시용 feedback 문자열을 반환하지 않는다.
- evaluator는 hints, duration, attempt number를 계산하지 않는다.
- evaluator는 예상 가능한 형식 오류에 throw하지 않고 `status: 'error'`를 반환한다.
- 프로그래밍 오류와 복구할 수 없는 invariant 위반은 throw할 수 있으며 Question Host의 error boundary가 처리한다.

### 5.2 평가 함수

```ts
function evaluateQuestion(
  question: Question,
  answer: UserAnswer,
): EvaluationOutcome;
```

평가 순서는 다음과 같다.

1. `question.type`에 등록된 Plugin 조회
2. Question runtime validation
3. `question.type === answer.type` 확인
4. type별 Answer validation
5. 순수 evaluator 실행
6. `EvaluationOutcome` 반환

Question 또는 Answer validation이 실패하면 evaluator를 실행하지 않는다.

### 5.3 유형별 Answer validation과 평가

#### single-choice

- `optionId`는 Question options에 존재해야 한다.
- `optionId === correctOptionId`일 때 정답이다.

#### multi-select

- `optionIds`는 중복이 없어야 한다.
- 모든 ID가 Question options에 존재해야 한다.
- 빈 배열은 Renderer에서 제출할 수 없고 evaluator에서도 invalid answer다.
- 제출 집합과 `correctOptionIds` 집합이 같을 때 정답이다. 배열 순서는 무시한다.

#### fill-blank

- `value`는 Question의 `choices` 중 하나를 선택한 문자열이어야 한다.
- `value`가 정규화 후 `choices`에 없으면 invalid answer다.
- `CONTENT_SPEC.md` Section 10.1의 일반 문자열 정규화를 적용한다.
- 정규화된 값이 `acceptedAnswers` 중 하나와 같을 때 정답이다.

#### ordering

- `orderedItemIds`는 Question의 모든 item ID를 정확히 한 번 포함해야 한다.
- 배열 길이, 중복, 누락, 알 수 없는 ID가 있으면 invalid answer다.
- `correctOrder`와 위치별로 모두 같을 때 정답이다.

#### matching

- 제출 pair는 모든 left와 right ID를 정확히 한 번 사용해야 한다.
- 중복, 누락, 알 수 없는 ID가 있으면 invalid answer다.
- 제출 pair 집합과 `correctPairs` 집합이 같을 때 정답이다. pair 배열 순서는 무시한다.

#### code-output

- `value`는 Question의 `choices` 중 하나를 선택한 문자열이어야 한다. 빈 출력은 빈 문자열 선택지로 표현할 수 있다.
- `value`가 출력 정규화 후 `choices`에 없으면 invalid answer다.
- `CONTENT_SPEC.md` Section 10.2의 출력 정규화를 적용한다.
- 정규화된 값이 `acceptedOutputs` 중 하나와 같을 때 정답이다.
- Question의 Python 코드를 실행하지 않는다.

#### code-completion

- `values` key는 Question의 모든 blank ID와 정확히 같아야 한다.
- 각 값은 해당 blank의 `choices` 중 하나를 선택한 문자열이어야 한다.
- 각 값이 정규화 후 해당 blank의 `choices`에 없으면 invalid answer다.
- 각 blank가 해당 `acceptedAnswers` 중 하나와 일치하고 모든 blank가 맞을 때 정답이다.
- 완성된 Python 코드를 실행하지 않는다.

## 6. Plugin 계약

### 6.1 Pure definition

각 type의 검증과 평가는 browser와 Svelte를 import하지 않는 모듈에 둔다.

```ts
interface ValidationSuccess<T> {
  valid: true;
  value: T;
}

interface ValidationFailure {
  valid: false;
  errors: string[];
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

interface QuestionDefinition<T extends QuestionType> {
  type: T;
  validateQuestion(value: unknown): ValidationResult<QuestionOf<T>>;
  validateAnswer(
    question: QuestionOf<T>,
    value: unknown,
  ): ValidationResult<AnswerOf<T>>;
  evaluate(question: QuestionOf<T>, answer: AnswerOf<T>): EvaluationResult;
  canonicalAnswer(question: QuestionOf<T>): CanonicalAnswerOf<T>;
}
```

`canonicalAnswer`는 정답 공개용 구조화 데이터를 반환한다. 문자열 답안이 여러 개이면 source 배열의 첫 항목을 대표 정답으로 사용한다.

### 6.2 Renderer 계약

Plugin Renderer는 type별 선택 UI만 담당한다.

```ts
import type { Component } from "svelte";

interface QuestionRendererProps<T extends QuestionType> {
  question: QuestionOf<T>;
  disabled: boolean;
  attemptKey: number;
  reveal: CanonicalAnswerOf<T> | null;
  onAnswerChange: (answer: AnswerOf<T> | null) => void;
}

type QuestionRendererComponent<T extends QuestionType> = Component<
  QuestionRendererProps<T>
>;
```

- `onAnswerChange(null)`은 아직 제출 가능한 완성 답안이 없음을 뜻한다.
- Renderer는 submit button을 만들지 않는다.
- Renderer는 evaluator나 Registry를 직접 호출하지 않는다.
- `attemptKey`가 바뀌면 선택 상태를 초기화하고 Section 9에 따라 항목 순서를 다시 준비한다.
- `disabled`이면 모든 선택 조작과 drag 조작을 막는다.
- `reveal`이 있으면 사용자의 최종 답과 canonical 정답을 구분해 표시한다.

### 6.3 통합 Plugin descriptor

```ts
interface QuestionPlugin<T extends QuestionType> {
  type: T;
  definition: QuestionDefinition<T>;
  renderer: QuestionRendererComponent<T>;
}

type AnyQuestionPlugin = {
  [T in QuestionType]: QuestionPlugin<T>;
}[QuestionType];
```

Plugin Registry는 7개 descriptor를 연결한다. Content Builder처럼 UI가 필요 없는 환경은 `definition`만 import할 수 있어야 한다.

### 6.4 Registry

```ts
interface QuestionPluginRegistry {
  register<T extends QuestionType>(plugin: QuestionPlugin<T>): void;
  get<T extends QuestionType>(type: T): QuestionPlugin<T> | null;
  require<T extends QuestionType>(type: T): QuestionPlugin<T>;
}
```

- 같은 type을 두 번 등록하면 startup error다.
- v1 기본 Registry는 7개 Plugin을 명시적으로 등록한다.
- `get`은 탐색용 nullable API다.
- `require`는 등록되지 않은 type에 대해 구조화된 registry error를 throw한다.
- Question Host는 `question.type`으로 descriptor를 조회해 renderer를 동적으로 선택한다. type별 `if` 또는 `switch`를 두지 않는다.

## 7. Question Host 상태

Question Host는 한 Question presentation의 공통 lifecycle을 관리한다.

```ts
type QuestionPhase =
  "answering" | "evaluating" | "retry-feedback" | "final-feedback" | "error";

interface QuestionHostState {
  questionId: string;
  questionRevision: number;
  phase: QuestionPhase;
  attemptNumber: 1 | 2;
  attemptKey: number;
  currentAnswer: UserAnswer | null;
  attempts: EvaluationResult[];
  error: EvaluationError | null;
}
```

Question이 새 ID 또는 revision으로 바뀌면 Host state 전체를 초기화한다.

### 7.1 상태 전이

```text
answering (attempt 1)
├─ invalid evaluation ─────────────► error ─► answering (attempt 1)
├─ correct ─────────────────────────► final-feedback
└─ incorrect ───────────────────────► retry-feedback
                                      │ retry
                                      ▼
                                  answering (attempt 2)
                                  ├─ invalid ─► error ─► answering (attempt 2)
                                  ├─ correct ──────────► final-feedback
                                  └─ incorrect ────────► final-feedback
```

`evaluating`은 중복 submit을 막기 위한 짧은 중간 상태다. 동기 evaluator를 사용해도 상태 계약에는 유지한다.

### 7.2 제출

- 모든 type은 공통 `정답 확인` button으로 명시적으로 제출한다.
- `currentAnswer === null`이면 button을 disable한다.
- `answering` 외 phase에서는 submit할 수 없다.
- 한 submit 동작은 최대 한 번의 attempt callback만 생성한다.
- double click, 반복 제출, component 재렌더링으로 중복 평가하지 않는다.

### 7.3 첫 오답과 재시도

첫 오답에서는 다음만 표시한다.

- `오답입니다. 한 번 더 풀어보세요.`와 같은 공통 문구
- `다시 풀기` action

이 시점에는 다음을 표시하지 않는다.

- canonical 정답
- 정답 option 강조
- `explanation`
- 정답을 추론할 수 있는 type별 feedback

`다시 풀기`를 선택하면 다음과 같이 처리한다.

- `attemptNumber`를 2로 변경한다.
- `attemptKey`를 증가시킨다.
- current answer와 error를 초기화한다.
- 선택과 조합 상태를 초기화한다.
- shuffle 대상의 순서를 다시 섞는다.
- 두 번째 제출 전까지 상위 flow의 continue action을 허용하지 않는다.

### 7.4 최종 feedback

첫 정답 또는 두 번째 제출 후 다음을 표시한다.

- 최종 제출의 정오답 공통 문구
- 사용자가 제출한 답
- canonical 정답
- Question에 `explanation`이 있으면 해당 Content Block
- 상위 flow가 제공하는 continue action

첫 정답이면 `정답입니다.`, 두 번째 정답이면 `정답입니다.`, 두 번째 오답이면 `정답을 확인해 보세요.`를 기본 문구로 사용한다. 이 문자열은 공통 UI copy이며 evaluator 결과가 아니다.

## 8. Attempt 전달 계약

Question Host는 유효하게 평가된 제출마다 attempt를 전달한다.

```ts
interface QuestionAttempt {
  attemptId: string;
  questionId: string;
  questionRevision: number;
  attemptNumber: 1 | 2;
  result: EvaluationResult;
  durationMs: number;
  final: boolean;
}

interface QuestionHostProps {
  question: Question;
  onAttempt: (attempt: QuestionAttempt) => void | Promise<void>;
}
```

`final` 규칙:

- 첫 시도 정답: `true`
- 첫 시도 오답: `false`
- 두 번째 시도: `true`

`attemptId`는 유효한 제출 직전에 생성하는 UUID v4다. callback 실패 후 같은 attempt를 다시 전달할 때는 새 ID를 만들지 않고 기존 `attemptId`를 유지한다.

원본 UserAnswer는 UI lifecycle 동안만 유지하며 `QuestionAttempt`에 포함하지 않는다. 장기 저장 여부를 Question Engine이 결정하지 않는다.

`onAttempt`가 Promise를 반환하면 완료될 때까지 Host는 `evaluating` 상태를 유지한다. callback이 실패하면 attempt를 완료 처리하지 않고 error를 표시하며 같은 snapshot을 다시 전달할 수 있는 retry action을 제공한다. 사용자에게 답안을 다시 선택하게 하거나 attempt number를 증가시키지 않는다.

Question Host는 callback을 임의로 재호출하지 않는다. 저장 계층은 `attemptId`를 StudyEvent ID 또는 idempotency key로 사용해 callback 재전달의 중복을 방지한다.

## 9. Shuffle 규칙

### 9.1 적용 대상

- `single-choice`, `multi-select`: 기본적으로 option을 섞는다. 콘텐츠가 `shuffleOptions: false`를 명시한 경우에만 source 순서를 유지한다.
- `fill-blank`, `code-output`: 모든 attempt에서 선택 카드 순서를 섞는다.
- `code-completion`: 모든 attempt에서 각 빈칸의 선택 카드 순서를 독립적으로 섞는다.
- `ordering`: 모든 attempt의 최초 item 순서를 섞는다.
- `matching`: 모든 attempt에서 left item은 왼쪽 A 열에 source 순서로 세로 배치하고, right item은 오른쪽 B 열에 세로 배치한다. B 열의 순서만 mount 시 섞으며, 모든 카드 내용을 처음부터 표시한다.
- 나머지 type은 shuffle하지 않는다.

### 9.2 수명

- 한 attempt를 표시할 때 한 번만 섞는다.
- 선택 변경이나 component 재렌더링으로 순서를 바꾸지 않는다.
- 첫 오답 뒤 두 번째 attempt를 시작할 때 새로 섞는다.
- `shuffleOptions: false`인 선택형은 재시도에서도 source 순서를 유지한다.
- 항목이 2개 이상이면 선택 카드, ordering의 최초 순서와 matching B 열의 순서는 가능한 한 직전 attempt와 다르게 만든다. A 열의 source 순서는 유지한다.
- 테스트에서 deterministic random source를 주입할 수 있어야 한다.

## 10. 시도 시간 측정

`durationMs`는 각 attempt의 활성 풀이 시간이다.

- 시작: Renderer가 선택 가능한 `answering` phase에 진입한 시점
- 종료: 유효한 답안을 submit한 시점
- 재시도: 두 번째 `answering` 진입 시 0부터 다시 측정
- 제외: `document.visibilityState === 'hidden'`인 구간
- 포함: 사용자가 선택을 수정하거나 drag하는 시간
- 제외: evaluator 실행, feedback 표시, attempt callback 대기 시간

시간은 monotonic clock인 `performance.now()`로 계산하고 가장 가까운 정수 millisecond로 반올림한다. 음수나 `Number.MAX_SAFE_INTEGER`보다 큰 값은 허용하지 않는다.

browser lifecycle을 사용할 수 없는 unit test와 SSR에서는 clock과 visibility source를 주입한다. SSR에서는 Question을 상호작용 가능한 상태로 시작하지 않고 client mount 후 측정을 시작한다.

## 11. Canonical 정답 공개

`CanonicalAnswer`는 renderer가 안전하게 정답을 표시할 수 있는 type별 구조다.

```ts
type CanonicalAnswer =
  | { type: "single-choice"; optionId: string }
  | { type: "multi-select"; optionIds: string[] }
  | { type: "fill-blank"; value: string }
  | { type: "ordering"; orderedItemIds: string[] }
  | { type: "matching"; pairs: MatchingAnswerPair[] }
  | { type: "code-output"; value: string }
  | { type: "code-completion"; values: Record<string, string> };

interface CanonicalAnswerByType {
  "single-choice": Extract<CanonicalAnswer, { type: "single-choice" }>;
  "multi-select": Extract<CanonicalAnswer, { type: "multi-select" }>;
  "fill-blank": Extract<CanonicalAnswer, { type: "fill-blank" }>;
  ordering: Extract<CanonicalAnswer, { type: "ordering" }>;
  matching: Extract<CanonicalAnswer, { type: "matching" }>;
  "code-output": Extract<CanonicalAnswer, { type: "code-output" }>;
  "code-completion": Extract<CanonicalAnswer, { type: "code-completion" }>;
}

type CanonicalAnswerOf<T extends QuestionType> = CanonicalAnswerByType[T];
```

- single-choice와 multi-select는 정답 option 카드를 강조한다.
- fill-blank는 `acceptedAnswers[0]`을 정답 choice 카드로 표시한다.
- ordering은 `correctOrder`를 표시한다.
- matching은 `correctPairs`를 표시한다.
- code-output은 `acceptedOutputs[0]`을 정답 choice 카드로 표시한다.
- code-completion은 각 blank의 `acceptedAnswers[0]`을 정답 choice로 표시한다.
- 여러 허용 답안을 모두 공개하지 않는다.
- 정답 여부를 색상만으로 표현하지 않는다.

## 12. 유형별 Renderer 동작

모든 선택지는 동일한 카드 스타일의 클릭 가능한 `button`으로 제공한다. 선택 여부, 정답 여부, 선택 해제와 `matched` 고정 상태는 카드의 접근 가능한 이름과 상태로도 전달해야 하며 색상만으로 구분하지 않는다.

### 12.1 single-choice

- 모든 option은 같은 모양의 클릭 가능한 카드 `button`으로 표시한다.
- 한 카드만 선택할 수 있다.
- 키보드로 카드에 focus하고 Space 또는 Enter로 선택할 수 있어야 한다.
- 최종 feedback에서는 사용자 선택과 정답을 각각 text label과 icon으로 구분한다.

### 12.2 multi-select

- 모든 option은 single-choice와 같은 카드 `button`으로 표시한다.
- 카드를 클릭하거나 Space 또는 Enter로 선택 상태를 toggle할 수 있어야 한다.
- 하나 이상의 카드를 선택해야 제출할 수 있다.
- 최종 feedback에서 누락된 정답과 잘못 선택한 option을 구분한다.

### 12.3 fill-blank

- `choices`를 같은 모양의 클릭 가능한 카드 `button`으로 표시한다.
- 하나의 카드만 선택할 수 있다.
- 키보드로 카드에 focus하고 Space 또는 Enter로 선택할 수 있어야 한다.

### 12.4 ordering

- pointer drag로 item 순서를 변경할 수 있다.
- 각 item에 키보드로 위·아래 이동할 수 있는 대체 button을 제공한다.
- 이동 후 새 위치를 `aria-live`로 알린다.
- 첫 렌더링과 재시도에서 Section 9에 따라 순서를 섞는다.

### 12.5 matching

- left item 카드는 A 열에 세로로, right item 카드는 B 열에 세로로 표시한다. 두 열은 반응형 화면에서도 유지한다.
- A와 B의 heading 또는 label을 제공하고 모든 카드 내용을 처음부터 표시한다.
- 사용자는 반드시 A 카드 한 장과 B 카드 한 장을 선택한다. 같은 열에서 다른 카드를 고르면 기존 선택을 교체한다.
- 두 카드가 올바른 left-right pair이면 양쪽 카드를 `matched` 상태로 고정한다.
- pair가 아니면 양쪽 선택을 해제하고 다음 선택을 허용한다.
- 모든 pair를 맞추면 답안 구성이 완료된다.
- 키보드 focus, Space 또는 Enter로 카드를 선택할 수 있으며, 각 카드에 `aria-pressed`와 선택 또는 `matched` 상태를 접근 가능한 이름으로 제공한다. 선택된 카드와 `matched` 카드의 상태를 색상만으로 구분하지 않는다.

### 12.6 code-output

- 출력 선택지를 같은 모양의 클릭 가능한 카드 `button`으로 제공하고 한 카드만 고를 수 있게 한다.
- 빈 출력이 유효한 답일 수 있으므로 `출력 없음`을 빈 문자열 선택지로 표시할 수 있다.

### 12.7 code-completion

- `{{blank:<id>}}` 위치에 blank별 카드 `button` 선택지를 렌더링한다.
- Tab 순서는 template에 나타나는 blank 순서를 따른다.
- 모든 blank에서 하나의 선택지를 골라야 제출할 수 있다.
- 최종 feedback에서는 blank별 사용자 답과 canonical 답을 함께 표시한다.

## 13. Focus와 announcement

### 13.1 Focus 이동

- Question 최초 표시: 첫 번째 답안 카드
- 첫 오답 후 `다시 풀기`: 초기화된 첫 번째 답안 카드
- 평가 형식 오류 복구: 오류를 설명한 뒤 문제가 된 첫 카드
- 최종 평가: final feedback heading
- drag 또는 keyboard reorder: 이동한 item

페이지 진입 시 heading 안내가 먼저 필요한 상위 화면은 Question Host의 autofocus를 비활성화할 수 있다. 이 경우 상위 화면이 focus를 관리한다.

### 13.2 상태 알림

- feedback과 error는 `aria-live="polite"` 영역에서 알린다.
- 저장 callback 실패처럼 진행을 막는 오류는 `role="alert"`를 사용할 수 있다.
- 정답과 오답은 text를 반드시 포함한다.
- loading 또는 evaluating 중에는 `aria-busy="true"`를 표시한다.

## 14. 오류 처리

### 14.1 복구 가능한 오류

다음은 사용자의 attempt를 소비하지 않는다.

- incomplete answer
- Question/Answer type mismatch
- 존재하지 않는 option 또는 item ID
- attempt callback 실패

incomplete answer는 기본적으로 submit button 비활성화로 예방한다. evaluator 경계에서도 다시 검증한다.

### 14.2 콘텐츠 또는 Plugin 오류

다음은 Question을 풀 수 없는 오류다.

- 등록되지 않은 Question type
- generated Question validation 실패
- Plugin renderer loading 실패
- canonical answer 생성 실패

이 경우 Question Host는 다음을 수행한다.

- 답안 선택 조작과 submit을 비활성화한다.
- `문제를 표시할 수 없습니다.` 오류 카드를 표시한다.
- question ID와 error code를 개발 로그에 남긴다.
- attempt callback을 호출하지 않는다.
- Lesson 또는 Review가 retry loading 또는 안전한 이탈 action을 제공할 수 있게 오류를 전달한다.

사용자에게 정답 데이터나 stack trace를 노출하지 않는다.

## 15. Lesson과 Review 연동

Lesson과 Review는 Question Host에 Question과 `onAttempt`만 전달한다.

```text
Lesson / Review
      │ Question + onAttempt
      ▼
 Question Host
      │ valid QuestionAttempt
      ▼
Application callback
      │
      ├─ StudyEvent 생성
      ├─ progress 갱신
      └─ scheduler 적용
```

- 첫 오답 attempt도 즉시 callback으로 전달한다.
- 상위 화면은 `final: true` attempt를 처리하기 전에는 다음 question으로 이동할 수 없다.
- Question Host는 Lesson인지 Review인지 알지 않는다.
- 동일 question을 다시 표시할 때 새 Host lifecycle을 만든다.
- 두 번째 정답을 FSRS에 어떻게 반영할지는 Progress 상세 명세에서 정한다.
- v1에는 hint가 없으므로 StudyEvent 생성 계층은 `hintsUsed: 0`을 사용한다.

## 16. 테스트 계약

### 16.1 Pure evaluator

각 Plugin은 최소 다음을 검증한다.

- canonical 정답
- 정상 오답
- Question/Answer type mismatch
- incomplete answer
- 알 수 없는 ID, 중복 ID, 누락 ID
- 문자열 정규화 경계
- Question 객체를 변경하지 않음
- 같은 Question과 Answer에 항상 같은 결과

### 16.2 Registry

- 7개 기본 type 등록
- type별 descriptor 조회
- 중복 등록 거부
- 미등록 type의 get/require 차이
- pure definition을 Svelte 없이 import 가능

### 16.3 Question Host

- 첫 정답은 attempt 1, final true로 완료
- 첫 오답은 정답과 explanation을 숨기고 continue 차단
- 첫 오답 후 필수 재시도
- 두 번째 정답과 두 번째 오답 모두 final true
- 형식 오류가 attempt number를 소비하지 않음
- double submit이 callback을 중복 호출하지 않음
- callback 실패 후 같은 attempt 재전달
- Question ID 또는 revision 변경 시 state 초기화

### 16.4 시간과 shuffle

- hidden 구간을 duration에서 제외
- feedback과 callback 대기 시간을 제외
- 재시도에서 duration 초기화
- 한 attempt 안에서는 순서 유지
- 재시도에서 shuffle 재실행
- `shuffleOptions: false`에서 source 순서 유지
- 주입한 random과 clock으로 deterministic test 가능

### 16.5 Renderer와 접근성

- 모든 type에서 keyboard만으로 답안 구성과 제출 가능
- ordering에서 pointer drag와 keyboard 대체 조작의 결과 동일
- matching에서 카드 클릭과 키보드 선택 조작의 결과 동일
- focus 이동과 live announcement
- 색상을 제거해도 정오답과 pair 관계 식별 가능
- code-output의 빈 출력 선택
- code-completion의 template 순서와 Tab 순서 일치

## 17. 구현 이행 기준

현재 초기 구현은 이 계약 이전의 prototype이다. Question Engine 구현 시 다음을 한 번에 맞춘다.

- field 존재 여부 기반 `UserAnswer`를 type discriminator union으로 교체
- `fill-blank.answer`를 `acceptedAnswers`로 교체
- evaluator의 한국어 feedback 문자열과 `hintsUsed` 제거
- malformed answer의 일반 오답 처리를 `EvaluationOutcome.error`로 분리
- Svelte Plugin 내부 평가 호출을 Question Host로 이동
- `QuestionRenderer`의 type switch를 통합 Registry lookup으로 교체
- 첫 제출 후 즉시 잠금 동작을 최대 두 번의 공통 attempt lifecycle로 교체
- 나머지 5개 Plugin을 같은 descriptor와 Renderer 계약으로 구현

이행 중 이전 generated Question 형식을 런타임에서 함께 지원하지 않는다. Content Builder와 예제 콘텐츠를 먼저 `CONTENT_SPEC.md` 계약으로 migration한 뒤 Question Engine을 전환한다.
