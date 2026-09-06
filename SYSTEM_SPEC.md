# CS 듀오링고 전체 시스템 상세 명세 v1

> 이 문서는 CS 듀오링고 프로젝트의 상위 시스템 명세다. 하위 명세와 구현은 이 문서의 아키텍처 원칙과 도메인 경계를 기준으로 한다.

## 1. 제품 정의

CS 듀오링고는 컴퓨터공학을 짧은 설명과 반복적인 문제 풀이로 학습하는 웹 기반 학습 앱이다. 목표는 단순 입문을 넘어 학부 컴퓨터공학 과정의 주요 내용을 단계적으로 학습할 수 있는 수준이다.

핵심 학습 사이클은 다음과 같다.

```text
새로운 개념 학습
→ 짧은 문제 풀이
→ 즉시 피드백
→ 다음 개념
→ 레슨 완료
→ 시간 경과
→ 복습
→ 장기 기억 강화
```

기본 학습 단위는 긴 강의가 아니라 `짧은 설명 + 즉시 풀 수 있는 문제`다.

## 2. 핵심 설계 원칙

### 2.1 Content First

대부분의 새 학습 콘텐츠는 프로그램 코드 변경 없이 추가할 수 있어야 한다. 기존 문제 형식의 새 문제는 lesson의 `questions/`에 YAML 파일을 추가해 작성하며, 새로운 상호작용 형식이 필요할 때만 Question Plugin을 구현한다.

### 2.2 Offline First

앱 실행, 레슨 읽기, 문제 풀이, 채점, 진행도 기록, 복습은 인터넷 연결 없이 동작해야 한다. 네트워크는 향후 계정, 동기화, 백업, 리더보드, 콘텐츠 업데이트를 위한 보조 계층으로 둔다.

### 2.3 Static Content

작성자는 YAML/Markdown으로 콘텐츠를 작성하고 빌드 과정에서 검증된 정적 JSON으로 변환한다. 런타임 앱은 원본 YAML/Markdown을 직접 파싱하지 않는다.

```text
YAML / Markdown
→ Content Builder
→ Validation
→ Static JSON
→ App
```

### 2.4 Stable ID + Revision

track, lesson, question은 변경되지 않는 영구 ID를 가진다. 콘텐츠 변경 버전은 별도의 `revision`으로 관리한다.

```yaml
id: ds.array.index-01
revision: 3
```

ID는 정체성이고 revision은 내용 버전이다.

### 2.5 Learning / Gamification 분리

학습 상태와 게임화 상태를 별도 도메인으로 관리한다.

```text
Learning                 Gamification
├─ 문제 풀이             ├─ XP
├─ 기억 상태             ├─ streak
├─ 복습 일정             ├─ achievement
└─ 레슨 진행             └─ daily goal
```

게임화 정책이 학습 알고리즘의 상태를 직접 변경하지 않는다.

## 3. 기술 스택

- Frontend: Svelte 5, SvelteKit, TypeScript
- Build: `@sveltejs/adapter-static`
- Web: SPA + PWA
- Local persistence: IndexedDB + Dexie
- Styling: Svelte scoped CSS + CSS Variables
- Mobile: Capacitor
- Review scheduler: FSRS
- Backend: MVP에서는 없음

동일한 Svelte 앱을 Browser/PWA에서 실행하고 이후 Capacitor shell을 통해 Android/iOS로 배포한다.

## 4. 최상위 시스템 구조

```text
Content Repository
YAML / Markdown / Assets
        │
        ▼
Content Build Pipeline
validation + compile
        │
        ▼
Generated Static JSON
        │
        ▼
Svelte Application
├─ Curriculum
├─ Lesson Engine
├─ Question Engine
├─ Review Engine
├─ Progress
└─ Gamification
        │
        ├──────────────► UI
        ▼
IndexedDB / Dexie
        │
        ▼
Outbox
        │ future
        ▼
Backend / Sync
```

## 5. 저장소 구조

```text
cs-duolingo/
├─ content/
├─ src/
├─ scripts/
├─ static/
├─ generated/
├─ tests/
├─ capacitor.config.ts
├─ svelte.config.js
├─ vite.config.ts
├─ package.json
└─ README.md
```

## 6. 콘텐츠 구조

작성 원본은 `content/`에 저장한다.

```text
content/
├─ curriculum/
│  ├─ tracks.yaml
│  └─ graph.yaml
├─ lessons/
│  ├─ py.variables/
│  │  ├─ lesson.yaml
│  │  ├─ questions/
│  │  │  ├─ py.variables.definition-01.yaml
│  │  │  └─ py.variables.assignment-01.yaml
│  │  ├─ content/
│  │  │  ├─ intro.md
│  │  │  └─ assignment.md
│  │  └─ assets/
│  ├─ ds.array/
│  └─ arch.binary/
└─ assets/
```

세 종류의 정보를 분리한다.

- Curriculum: 무엇을 어떤 순서로 배울 것인가
- Lesson: 한 수업 안에서 무엇을 보여줄 것인가
- Question: 사용자가 무엇을 풀 것인가

## 7. 커리큘럼

전체 학습 과정은 단일 선형 리스트가 아니라 DAG 기반 학습 그래프로 표현한다.

대표적인 관계는 다음과 같다.

```text
Python Fundamentals
        ↓
Data Structures
        ├─ Array
        │   ├─ Searching
        │   └─ Sorting
        ├─ Tree
        │   ├─ DFS
        │   └─ BFS
        └─ Graph
            ├─ Dijkstra
            └─ A*

Computer Architecture
        ├─ Networking
        └─ Graphics
```

### 7.1 tracks.yaml

트랙의 메타데이터와 표현 순서를 정의한다. `order`는 UI 표현 순서이며 선행 조건이 아니다.

```yaml
tracks:
  - id: python
    revision: 1
    title: Python 기초
    description: 자료구조 학습에 필요한 Python 기초
    order: 10

  - id: data-structures
    revision: 1
    title: 자료구조
    order: 20
```

### 7.2 graph.yaml

선행 관계는 하나의 방향으로만 저장한다. `requires`를 canonical relation으로 두고 reverse unlock 관계는 빌드 또는 런타임에서 유도한다.

```yaml
nodes:
  - lesson: py.variables
    requires: []

  - lesson: ds.array
    requires:
      - py.variables

  - lesson: algo.sorting
    requires:
      - ds.array
```

MVP의 unlock 조건은 모든 prerequisite lesson 완료다. 향후 assessment, skill level 등의 조건을 추가할 수 있으나 초기에는 도입하지 않는다.

## 8. Lesson

한 lesson은 약 3 ~ 10분의 짧은 학습 세션을 목표로 한다. 설명과 문제를 섞어 배치할 수 있도록 명시적 `flow`를 가진다.

```yaml
id: ds.array
revision: 2
track: data-structures
title: 배열
description: 연속된 메모리에 데이터를 저장하는 배열을 학습한다.

flow:
  - type: content
    ref: intro
  - type: question
    ref: ds.array.definition-01
  - type: content
    ref: indexing
  - type: question
    ref: ds.array.index-01
```

이 구조는 다음과 같은 학습 흐름을 지원한다.

```text
설명 → 문제 → 문제 → 새 설명 → 문제 → 요약
```

## 9. Content Block

설명과 문제 내부 표현은 작은 Content Block의 조합으로 구성한다.

```ts
type ContentBlock =
  TextBlock | MarkdownBlock | CodeBlock | ImageBlock | DiagramBlock;
```

기본 구조:

```ts
interface TextBlock {
  type: "text";
  text: string;
}

interface MarkdownBlock {
  type: "markdown";
  markdown: string;
}

interface CodeBlock {
  type: "code";
  language: string;
  code: string;
}

interface ImageBlock {
  type: "image";
  src: string;
  alt: string;
}

interface DiagramBlock {
  type: "diagram";
  diagramType: string;
  data: unknown;
}
```

향후 diagram renderer로 array, linked-list, tree, graph, memory, logic-gate, pipeline 등을 등록할 수 있다.

긴 설명은 별도 Markdown 파일에 작성하고 빌드 타임에 처리한다.

## 10. Question 시스템

Question은 TypeScript Discriminated Union으로 표현한다.

```ts
type Question =
  | SingleChoiceQuestion
  | MultiSelectQuestion
  | FillBlankQuestion
  | OrderingQuestion
  | MatchingQuestion
  | CodeOutputQuestion
  | CodeCompletionQuestion;
```

공통 필드:

```ts
interface QuestionBase {
  id: string;
  revision: number;
  type: string;
  prompt: ContentBlock[];
  explanation?: ContentBlock[];
  tags?: string[];
  difficulty?: number;
}
```

Question ID는 절대로 재사용하지 않는다.

### 10.1 초기 문제 템플릿 7종

1. `single-choice`: 하나의 정답 선택
2. `multi-select`: 복수 정답 선택
3. `fill-blank`: 문장 또는 코드 빈칸 채우기
4. `ordering`: 알고리즘 단계 등의 순서 배열
5. `matching`: 두 집합 항목 연결
6. `code-output`: 코드의 출력 결과 예측
7. `code-completion`: 제한된 형태의 코드 완성

초기 `code-completion`은 자유 코드 실행보다 제한된 빈칸 기반 완성을 우선한다.

향후 CS 전용 Plugin 후보:

- `graph-path`
- `tree-traversal`
- `memory-layout`
- `interactive-simulation`

## 11. Question Plugin Registry

문제 형식은 플러그인으로 등록한다.

구체적인 런타임 답안, 평가, Renderer와 시도 lifecycle 계약은 `QUESTION_SPEC.md`를 기준으로 한다.

```ts
interface QuestionPlugin<T extends QuestionType> {
  type: T;
  definition: QuestionDefinition<T>;
  renderer: QuestionRendererComponent<T>;
}
```

```ts
const questionPlugins: QuestionPluginRegistry;
```

레슨 엔진은 개별 문제 타입을 알 필요 없이 `question.type`으로 Registry에서 Plugin을 찾는다.

```text
Question → type → Plugin Registry → Renderer / Evaluator
```

## 12. Evaluator

채점 로직은 UI와 완전히 분리한다.

```text
Plugin Renderer
→ UserAnswer
→ Question Host
→ Evaluator
→ EvaluationOutcome
```

```ts
interface EvaluationResult {
  correct: boolean;
  score: 0 | 1;
}
```

Evaluator가 정답 여부, 정규화, 평가 기준을 담당한다. 사용자 표시용 feedback과 explanation은 공통 UI 계층이 조합하며 Svelte component 내부에 정답 비교 로직을 두지 않는다. MVP에서는 첫 오답 뒤 정답을 공개하지 않고 한 번의 재시도를 필수로 제공한다.

## 13. Lesson Engine

Lesson Engine은 `lesson.flow`를 실행하는 작은 상태 머신이다.

```ts
interface LessonSession {
  lessonId: string;
  currentIndex: number;
  status: "active" | "completed";
  answers: SessionAnswer[];
}
```

실행 흐름:

```text
lesson 시작
→ flow[currentIndex]
→ Content 또는 Question 렌더링
→ 완료
→ 다음 flow
→ ...
→ lesson completed
```

문제 제출 흐름:

```text
사용자 답안
→ Question Evaluator
→ EvaluationResult
→ 즉시 피드백
→ Review Rating
→ Scheduler
→ StudyEvent
→ QuestionState
→ LessonState
```

## 14. 진행도 모델

학습 기록은 세 계층으로 나눈다.

- `StudyEvent`: 실제 발생한 사건의 append-only history
- `QuestionState`: 현재 문제별 학습 상태
- `LessonState`: 현재 레슨 상태

### 14.1 StudyEvent

StudyEvent가 학습 history의 canonical source다. 문제 풀이, 레슨 완료, 진행도 초기화, 콘텐츠 revision 변화 등의 사건을 표현한다.

대표 review event:

```ts
interface ReviewAttemptEvent {
  id: string;
  schemaVersion: number;
  eventType: "review-attempt";
  userId: string;
  deviceId: string;
  clientSeq: number;
  questionId: string;
  lessonId: string;
  contentRevision: number;
  effectiveAt: number;
  result: "correct" | "incorrect";
  rating: "again" | "hard" | "good" | "easy";
  durationMs: number;
  hintsUsed: number;
  schedulerProfileId: string;
  baseStateVersion: number;
}
```

### 14.2 QuestionState

```ts
interface QuestionState {
  userId: string;
  questionId: string;
  lessonId: string;
  contentRevision: number;
  status: "new" | "learning" | "review" | "relearning" | "suspended";
  lastReviewAt: number | null;
  nextReviewAt: number | null;
  correctCount: number;
  incorrectCount: number;
  reps: number;
  lapses: number;
  schedulerProfileId: string;
  schedulerState: SchedulerState;
  stateVersion: number;
  updatedAt: number;
}
```

### 14.3 LessonState

```ts
interface LessonState {
  userId: string;
  lessonId: string;
  contentRevision: number;
  status: "not-started" | "in-progress" | "completed";
  startedAt: number | null;
  completedAt: number | null;
  lastStudiedAt: number | null;
  attemptedQuestions: number;
  completedQuestions: number;
  correctCount: number;
  incorrectCount: number;
  updatedAt: number;
}
```

한 번 완료된 lesson은 이후 개별 문제를 잊었다고 해서 미완료 상태로 돌아가지 않는다.

## 15. 복습 시스템

복습 scheduling은 FSRS를 사용하되 애플리케이션이 특정 라이브러리에 직접 결합되지 않도록 Adapter를 둔다.

```text
Application
→ Scheduler Interface
→ FsrsScheduler
→ FSRS Library
```

```ts
interface Scheduler<TState> {
  createInitialState(now: Date): TState;
  apply(
    state: TState,
    rating: ReviewRating,
    now: Date,
  ): {
    state: TState;
    nextReviewAt: number;
  };
  retrievability(state: TState, now: Date): number | null;
}
```

MVP에서는 사용자에게 Again/Hard/Good/Easy를 직접 요구하지 않고 evaluator 결과를 기본적으로 다음과 같이 매핑한다.

```text
오답 → Again
정답 → Good
```

`Hard`, `Easy`는 데이터 모델에 남겨 향후 확장한다.

기본 목표 retention은 `0.90`으로 시작하고, 충분한 데이터가 쌓이기 전까지 라이브러리 기본 parameter를 사용한다.

Review Queue 기본 우선순위:

1. relearning
2. due review
3. 새롭게 학습 가능한 문제

동일 집합 안에서는 낮은 retrievability를 우선할 수 있다.

새 레슨에서 처음 푼 Question이 그대로 향후 복습 단위가 되므로 별도의 복습용 콘텐츠를 만들 필요가 없다.

## 16. IndexedDB / Dexie

로컬 DB의 논리적 구조:

```text
LearningDB
├─ studyEvents
├─ questionStates
├─ lessonStates
├─ schedulerProfiles
├─ gameEvents
├─ gameState
├─ outbox
└─ syncMeta
```

한 번의 문제 제출은 atomic transaction으로 처리한다.

```text
BEGIN
StudyEvent append
QuestionState update
LessonState update
GameEvent 생성
Outbox append
COMMIT
```

실패 시 전체를 rollback한다.

## 17. Gamification

초기에는 작게 유지한다.

- XP
- 현재 streak
- 최장 streak
- daily goal
- achievement 확장 가능

XP 수치는 configuration으로 두며 하드코딩하지 않는다. Streak 날짜는 UTC 날짜가 아니라 사용자의 local date를 기준으로 계산한다.

## 18. Offline First와 향후 Sync

문제 제출은 서버를 기다리지 않는다.

```text
Evaluator
→ Scheduler
→ IndexedDB Transaction
→ UI 반영
```

향후 서버가 추가되면 그 뒤에 Outbox 기반 동기화를 붙인다.

```text
Local Transaction
→ Outbox
→ Background Sync
→ Server
```

동기화의 canonical data는 `QuestionState`가 아니라 StudyEvent다. 여러 기기의 event를 합친 뒤 필요하면 derived state를 replay한다.

## 19. Content Revision 정책

revision을 증가시키는 변경:

- 정답 변경
- 질문 의미 변경
- 평가 기준 변경
- 사실상 다른 문제로 변경

revision을 유지할 수 있는 변경:

- 오타 수정
- 문체 개선
- 레이아웃 변경
- 의미를 바꾸지 않는 설명 개선

## 20. Content Build Pipeline

```text
content/
YAML + Markdown + Assets
        ↓
Load
        ↓
Schema Validation
        ↓
Reference Validation
        ↓
Graph Validation
        ↓
Question Validation
        ↓
Compile
        ↓
generated/content/*.json
```

빌드 실패 조건에는 다음이 포함된다.

- 중복 ID
- 존재하지 않는 lesson/question 참조
- 알 수 없는 question type
- curriculum graph cycle
- 잘못된 prerequisite
- revision 누락
- 필수 필드 누락
- 등록되지 않은 diagram type
- 정답 index 범위 오류
- matching pair 오류
- 존재하지 않는 asset 참조

콘텐츠 오류는 런타임이 아니라 CI에서 차단한다.

## 21. Generated Content

예상 산출물:

```text
generated/
├─ curriculum.json
├─ lessons/
│  └─ ds.array.json
├─ questions/
│  └─ ds.array.index-01.json
└─ manifest.json
```

```ts
interface ContentManifest {
  schemaVersion: number;
  buildId: string;
  generatedAt: string;
  tracks: string[];
  lessons: string[];
  questions: string[];
}
```

Manifest는 콘텐츠 버전 감지와 캐시 관리에도 사용한다.

## 22. Runtime Content Repository

UI가 실제 JSON 파일 배치를 직접 알지 않도록 Repository를 둔다.

```ts
interface ContentRepository {
  getTrack(id: string): Promise<Track>;
  getLesson(id: string): Promise<Lesson>;
  getQuestion(id: string): Promise<Question>;
  getPrerequisites(lessonId: string): Promise<string[]>;
}
```

## 23. Application State

대규모 전역 상태관리 프레임워크를 추가하지 않는다. Svelte의 reactive state를 우선하고 필요한 경우에만 작은 도메인 store를 둔다.

```text
sessionStore
progressStore
reviewStore
settingsStore
```

IndexedDB가 장기 데이터의 source이므로 전체 DB를 전역 메모리 state에 복제하지 않는다.

## 24. 화면과 Routing

기본 정보 구조:

```text
Home
├─ Learn
│  ├─ Curriculum Map
│  └─ Lesson
├─ Review
├─ Progress
└─ Settings
```

SvelteKit route 예:

```text
/
/learn
/learn/[lessonId]
/review
/progress
/settings
```

SPA에서도 브라우저의 일반적인 뒤로가기 동작을 유지한다.

### Home

가장 중요한 행동은 `이어 학습하기`와 `오늘 복습하기`다. 현재 트랙, 다음 lesson, due review 수, streak, 오늘 XP 등을 표시할 수 있다.

### Curriculum

lesson node는 `Locked`, `Available`, `In Progress`, `Completed` 상태를 가진다. DAG의 모든 edge를 기계적으로 노출하기보다 학습 경로를 이해하기 쉽게 보여주는 것을 우선한다.

### Lesson

Lesson 화면은 progress bar, 현재 Content/Question, feedback, continue action으로 구성되는 player 역할을 한다.

### Review

FSRS 내부 개념을 노출하지 않고 `오늘의 복습`처럼 표현한다. Lesson과 Review는 동일한 Question Renderer를 재사용한다.

### Progress

완료 lesson 수, 트랙 진행률, 최근 학습, 복습 문제 수, streak, 총 XP 등을 제공한다.

## 25. PWA와 캐싱

필수 요소:

- Web App Manifest
- Service Worker
- Static Asset Cache
- Offline Content
- App Icons

App Shell과 학습 Content cache를 구분한다. Content Manifest의 build ID를 이용해 콘텐츠 업데이트를 감지한다.

## 26. Mobile

```text
SvelteKit Static Build
→ Capacitor
├─ Android
└─ iOS
```

초기에는 Web API를 우선 사용한다. 향후 필요한 native 기능으로 Local Notification, Haptic, App lifecycle, Filesystem backup, Share 등을 추가할 수 있다.

복습 알림은 scheduling과 분리하며 MVP 필수 기능으로 두지 않는다.

## 27. 코드 실행 문제

MVP에서는 임의 Python/JavaScript 실행 sandbox를 핵심 의존성으로 만들지 않는다. `code-output`, 제한된 `code-completion`은 정적 evaluator로 처리한다.

실제 코드 실행이 필요해지면 독립 `Code Runner` 도메인을 추가한다. 브라우저에서 임의 사용자 코드를 `eval()` 또는 `new Function()`으로 실행하지 않는다.

## 28. 접근성과 보안

Question Plugin은 최소한 다음을 만족해야 한다.

- 키보드 조작 가능
- 적절한 text label
- image alt 필수
- 색상만으로 정답/오답 표현 금지
- 적절한 focus 이동
- drag 기반 문제의 키보드 대체 조작

Markdown raw HTML은 기본적으로 허용하지 않으며 필요 시 sanitize한다. Question YAML이나 Markdown에서 executable JavaScript를 허용하지 않는다.

## 29. 개인정보 원칙

MVP는 계정 없이 로컬 저장을 기본으로 한다. 학습에 필요한 최소 데이터만 기록한다. 필요성이 검증되기 전에는 모든 키 입력, mouse movement, 상세 행동 telemetry, 전체 코드 편집 history 등을 수집하지 않는다.

## 30. 테스트

테스트를 네 층으로 나눈다.

### Content Tests

- ID uniqueness
- reference integrity
- graph acyclic
- question validation
- asset existence
- revision validity

### Unit Tests

- Evaluator
- Scheduler Adapter
- unlock logic
- review queue
- revision migration
- progress reducer
- content parser/builder

### Integration Tests

대표적으로 `문제 제출 → StudyEvent → QuestionState → nextReviewAt` 전체 흐름을 검증한다.

### E2E Tests

최소 시나리오:

- 앱 첫 실행
- 첫 lesson 시작
- 문제 풀이
- lesson 완료
- 앱 재실행 후 진행도 유지
- offline 학습
- due review 수행

## 31. 권장 코드 구조

```text
src/
├─ lib/
│  ├─ content/
│  │  ├─ types/
│  │  ├─ repository/
│  │  └─ loader/
│  ├─ curriculum/
│  │  ├─ graph.ts
│  │  └─ unlock.ts
│  ├─ lesson/
│  │  ├─ lesson-session.ts
│  │  └─ lesson-engine.ts
│  ├─ questions/
│  │  ├─ registry.ts
│  │  ├─ types.ts
│  │  └─ plugins/
│  │     ├─ single-choice/
│  │     ├─ multi-select/
│  │     ├─ fill-blank/
│  │     ├─ ordering/
│  │     ├─ matching/
│  │     ├─ code-output/
│  │     └─ code-completion/
│  ├─ learning/
│  │  ├─ domain/
│  │  ├─ progress/
│  │  ├─ review/
│  │  └─ scheduler/
│  ├─ gamification/
│  ├─ storage/
│  │  ├─ db.ts
│  │  ├─ repositories/
│  │  ├─ migrations/
│  │  └─ backup/
│  ├─ sync/
│  ├─ components/
│  └─ stores/
└─ routes/
   ├─ +page.svelte
   ├─ learn/
   ├─ review/
   ├─ progress/
   └─ settings/
```

```text
scripts/
└─ content/
   ├─ build.ts
   ├─ validate.ts
   ├─ validate-graph.ts
   ├─ validate-lessons.ts
   └─ validate-questions.ts
```

## 32. CI / Build

Pull Request마다 최소 다음을 수행한다.

```text
TypeScript typecheck
→ Svelte check
→ Unit tests
→ Content validation
→ Content build
→ Production build
```

최종 빌드 흐름:

```text
content:validate
→ content:build
→ generated content
→ SvelteKit build
├─ Web/PWA
└─ Capacitor
```

## 33. Backend 정책

MVP는 `Static Hosting + Local IndexedDB`로 동작한다. 계정/동기화 필요성이 생기면 Supabase 또는 자체 경량 API를 검토하되 현재는 특정 backend를 확정하지 않는다.

향후 서버의 역할은 계정, event sync, backup, content distribution, 통계, leaderboard 등이다. 문제 제출 자체가 서버 응답을 기다리는 구조로 바꾸지 않는다.

## 34. Repository 계층

IndexedDB 구현을 UI와 application logic에 직접 노출하지 않는다.

```ts
interface ProgressRepository {
  getQuestionState(
    userId: string,
    questionId: string,
  ): Promise<QuestionState | null>;

  saveAttempt(event: ReviewAttemptEvent): Promise<void>;
}
```

이를 통해 향후 저장 구현을 변경해도 상위 로직을 유지할 수 있다.

## 35. 버전 체계

다음 버전을 독립적으로 관리한다.

- Database Schema Version
- Event Schema Version
- Content Revision
- Scheduler Algorithm Version

서로 같은 숫자로 맞출 필요가 없다.

## 36. 백업

서버가 없는 시기에도 Export/Import가 가능하도록 설계한다. canonical backup 대상은 StudyEvent, SchedulerProfile, GameEvent, Settings이며 QuestionState와 LessonState는 필요하면 replay로 재생성할 수 있다.

## 37. MVP 범위

포함:

- SvelteKit SPA
- PWA
- 정적 콘텐츠 build
- Curriculum DAG
- Lesson Engine
- Content Blocks
- 7개 기본 Question Plugin
- Evaluator
- IndexedDB + Dexie
- StudyEvent
- QuestionState
- LessonState
- FSRS
- Review Queue
- 기본 XP/streak
- Home/Curriculum/Lesson/Review/Progress/Settings

MVP에서 제외:

- Backend
- 회원가입
- Cloud sync
- 친구/리더보드
- AI tutor
- 실시간 서버 채점
- 자유 코드 실행 sandbox
- CMS
- 교사용 dashboard
- 개인별 FSRS parameter 최적화
- 고급 achievement 시스템

## 38. 구현 순서

### Phase 1 — Skeleton

SvelteKit, TypeScript, PWA, routing, 기본 UI.

### Phase 2 — Content Pipeline

content 구조, YAML schema, Markdown, validator, builder, generated JSON.

### Phase 3 — Question Engine

ContentBlock, Question union, Plugin Registry, Evaluator. 먼저 `single-choice`, `fill-blank` 두 타입으로 전체 구조를 검증한다.

### Phase 4 — Lesson Engine

lesson flow, content renderer, question renderer, session progress, completion.

### Phase 5 — 나머지 Question Plugin

multi-select, ordering, matching, code-output, code-completion.

### Phase 6 — Progress

Dexie, StudyEvent, QuestionState, LessonState.

### Phase 7 — Review

Scheduler Adapter, FSRS, Review Queue, Review UI.

### Phase 8 — Curriculum

graph, unlock logic, curriculum UI.

### Phase 9 — Gamification

XP, streak, progress display.

### Phase 10 — Mobile

Capacitor, Android/iOS build, 필요한 native integration.

## 39. 첫 Vertical Slice

전체 기능을 조금씩 병렬 구현하기 전에 다음 흐름을 완성한다.

```text
앱 실행
→ Python 변수 lesson 선택
→ 설명 표시
→ single-choice 문제
→ fill-blank 문제
→ 채점
→ lesson 완료
→ 앱 종료
→ 재실행
→ 완료 상태 유지
→ 시간이 지나면 review에 문제 등장
```

이 흐름이 완성되면 시스템의 핵심 가정 대부분을 실제로 검증할 수 있다.

## 40. 의존 방향

가능한 한 다음 방향을 유지한다.

```text
UI
↓
Application
↓
Domain
↑
Infrastructure
```

UI가 Dexie나 특정 FSRS 구현체 같은 infrastructure detail을 직접 호출하지 않는다.

## 41. 금지할 구조

- 콘텐츠마다 `ArrayQuestion.svelte`, `StackQuestion.svelte` 같은 전용 UI를 만드는 구조
- Svelte component 내부에 evaluator 로직을 분산하는 구조
- Component에서 Dexie에 직접 접근하는 구조
- 문제 제출이 서버 API 응답을 기다리는 구조
- 실제 학습 콘텐츠를 TypeScript source에 하드코딩하는 구조
- `eval()`, `new Function()`, Markdown `<script>` 또는 YAML executable JS

## 42. 핵심 추상화

전체 프로젝트에서 가장 중요한 추상화는 다음 여섯 개다.

```text
Curriculum Graph
Lesson Flow
Content Block
Question Plugin
StudyEvent
Scheduler
```

이 경계가 안정적이면 대부분의 기능은 그 위에서 독립적으로 확장할 수 있다.

## 43. 전체 데이터 흐름

```text
Authoring
YAML / Markdown
      ↓
Content Build
      ↓
Static JSON
      ↓
ContentRepository
      ↓
Lesson Engine
  ┌───┴────┐
  ▼        ▼
Content  Question
Block    Plugin
           ↓
         Answer
           ↓
       Evaluator
           ↓
 EvaluationResult
           ↓
       Scheduler
           ↓
       StudyEvent
       ┌───┴────┐
       ▼        ▼
QuestionState LessonState
       │
       ▼
 Review Queue
```

## 44. 시스템 정의

CS 듀오링고는 세 핵심 시스템의 결합으로 본다.

1. **Content System** — Curriculum Graph + Lesson + Question Plugin
2. **Learning System** — Evaluator + StudyEvent + Progress State + FSRS
3. **Application Shell** — SvelteKit + IndexedDB + PWA + Capacitor

Gamification, Sync, Analytics, AI는 이 핵심 위에 올라가는 부가 계층이다.

## 45. 현재 확정 사항

- Svelte 5
- SvelteKit
- TypeScript
- Static SPA
- PWA
- Capacitor
- IndexedDB + Dexie
- YAML + Markdown authoring
- Static JSON build output
- Curriculum DAG
- Permanent IDs + revision
- Lesson Flow
- Content Block
- Discriminated Union Questions
- Plugin Registry
- Independent Evaluator
- 7 initial Question Types
- StudyEvent
- QuestionState
- LessonState
- FSRS
- Offline First

## 46. 후속 상세 설계 대상

다음은 상위 아키텍처를 유지한 채 별도 하위 명세에서 결정한다.

콘텐츠 작성 원본과 generated JSON의 구체적인 계약은 `CONTENT_SPEC.md`를 기준으로 한다.

Question Plugin, UserAnswer, Evaluator와 Renderer의 런타임 계약은 `QUESTION_SPEC.md`를 기준으로 한다.

- 구체적인 UI 디자인
- 홈 화면 배치
- Curriculum Graph 시각 표현
- lesson당 권장 문제 수
- XP 획득량과 streak 세부 규칙
- daily goal
- review session 길이
- 정답/오답 애니메이션
- DiagramBlock 유형별 `data` 문법
- 실제 코드 실행 환경
- 계정/backend 제공자
- cloud sync 구현
- notification 정책
- AI 기능

향후 필요하면 `PROGRESS_SPEC.md` 등의 하위 명세로 추가 분리한다.

## 47. 한 문장 아키텍처

**CS 듀오링고는 YAML/Markdown으로 작성한 학부 수준 CS 콘텐츠를 빌드 타임에 검증된 정적 JSON으로 변환하고, SvelteKit 기반 Offline First 앱이 재사용 가능한 Question Plugin과 독립 Evaluator를 통해 이를 실행하며, StudyEvent와 FSRS를 이용해 장기 학습 진행도와 복습을 관리하고, 동일한 앱을 PWA와 Capacitor를 통해 웹·Android·iOS에 제공하는 시스템이다.**
