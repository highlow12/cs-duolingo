# CS 듀오링고 콘텐츠 스키마 명세 v1

> 이 문서는 콘텐츠 작성 원본과 빌드 결과의 계약을 정의한다. 상위 아키텍처와 학습 도메인 경계는 `SYSTEM_SPEC.md`를 따르며, 두 문서가 충돌하면 `SYSTEM_SPEC.md`를 우선한다.

## 1. 목적과 범위

이 명세의 목적은 콘텐츠 작성자와 Content Builder 구현자가 같은 형식을 기준으로 작업하게 하는 것이다.

v1에서 정의하는 대상은 다음과 같다.

- track과 curriculum graph
- lesson metadata와 flow
- Markdown 설명 콘텐츠
- Content Block
- 7개 기본 Question 형식
- asset 참조
- source validation
- generated JSON의 공통 형태

다음 항목은 이 명세의 범위가 아니다.

- Question Renderer의 시각 디자인
- FSRS와 학습 상태
- XP와 streak
- Diagram Renderer별 `data` 구조
- Python 코드 실행
- 부분 점수
- 콘텐츠 번역과 다국어 fallback

## 2. 기본 원칙

### 2.1 작성 원본과 런타임 데이터 분리

작성자는 `content/` 아래의 YAML, Markdown, asset만 수정한다. 런타임 앱은 작성 원본을 직접 읽지 않고 Content Builder가 생성한 `generated/` JSON만 읽는다.

```text
content/                  generated/
YAML + Markdown + Assets  normalized JSON
          \                 /
           Content Builder
```

`generated/` 파일은 작성 원본이 아니며 직접 수정하지 않는다.

### 2.2 엄격한 검증

스키마에 정의되지 않은 YAML 필드는 빌드 오류다. 타입이 다르거나 필수 필드가 없거나 참조 대상이 존재하지 않아도 빌드 오류다.

이 정책은 작성자의 오타를 조기에 발견하기 위한 것이다. 향후 확장 필드가 필요하면 먼저 이 명세와 validator를 변경한다.

### 2.3 영구 ID와 revision

track, lesson, question의 `id`는 생성 후 변경하거나 재사용하지 않는다. 내용을 변경할 때는 Section 13의 규칙에 따라 `revision`을 증가시킨다.

모든 `revision`은 `1` 이상의 정수다.

## 3. 작성 파일 구조

```text
content/
├─ curriculum/
│  ├─ tracks.yaml
│  └─ graph.yaml
├─ lessons/
│  └─ py.variables/
│     ├─ lesson.yaml
│     ├─ content/
│     │  ├─ intro.md
│     │  └─ assignment.md
│     ├─ questions/
│     │  ├─ py.variables.definition-01.yaml
│     │  └─ py.variables.assignment-01.yaml
│     └─ assets/
│        └─ variable-box.svg
└─ assets/
   └─ shared/
      └─ python-logo.svg
```

규칙은 다음과 같다.

- lesson 디렉터리 이름은 `lesson.yaml`의 `id`와 같아야 한다.
- question 파일 이름은 `<question-id>.yaml`이어야 한다.
- question 파일 하나에는 question 하나만 둔다.
- lesson 전용 asset은 해당 lesson의 `assets/`에 둔다.
- 여러 lesson이 공유하는 asset은 `content/assets/`에 둔다.
- 모든 텍스트 파일은 UTF-8로 저장한다.
- YAML 파일 확장자는 `.yaml`만 허용한다.

## 4. 공통 값 규칙

### 4.1 ID

ID는 ASCII 소문자, 숫자, 점, 하이픈만 사용한다.

```text
^[a-z0-9]+(?:[.-][a-z0-9]+)*$
```

권장 형식은 다음과 같다.

| 대상        | 형식                            | 예                           |
| ----------- | ------------------------------- | ---------------------------- |
| track       | kebab-case                      | `data-structures`            |
| lesson      | domain.topic                    | `py.variables`               |
| question    | lesson ID + 의미 있는 suffix    | `py.variables.definition-01` |
| option/item | question 내부의 짧은 kebab-case | `mutable`, `step-1`          |

question ID는 소유 lesson의 ID와 `.`으로 시작해야 한다. 예를 들어 `py.variables` lesson의 question은 `py.variables.` prefix를 가져야 한다.

ID uniqueness 범위는 다음과 같다.

- track ID는 전체 저장소에서 유일하다.
- lesson ID는 전체 저장소에서 유일하다.
- question ID는 전체 저장소에서 유일하다.
- option과 item ID는 해당 question 안에서 유일하다.

### 4.2 문자열

- `title`, `description`, `text`, `markdown`, `code`는 앞뒤 공백을 제외하고 비어 있을 수 없다.
- 사용자에게 보이는 문자열의 줄바꿈은 보존한다.
- ID, tag, language 같은 기계 식별자에는 앞뒤 공백을 허용하지 않는다.
- `description`은 plain text이며 Markdown으로 해석하지 않는다.

### 4.3 tags와 difficulty

`tags`는 선택 필드이며 중복 없는 ID 형식 문자열 배열이다. 순서는 의미를 갖지 않는다.

`difficulty`는 선택 필드이며 `1` ~ `5`의 정수다.

| 값  | 의미                       |
| --- | -------------------------- |
| 1   | 개념을 바로 확인하는 문제  |
| 2   | 한 단계 적용이 필요한 문제 |
| 3   | 여러 개념을 연결하는 문제  |
| 4   | 복합 추론이 필요한 문제    |
| 5   | 해당 학습 단계의 도전 문제 |

값이 없으면 난이도를 지정하지 않은 것으로 처리하며 임의의 기본값을 주입하지 않는다.

### 4.4 상대 경로

YAML과 Markdown의 파일 참조는 참조를 작성한 파일을 기준으로 해석한다.

- 경로 구분자는 `/`를 사용한다.
- 절대 경로, URL, `..`로 `content/` 밖을 벗어나는 경로는 허용하지 않는다.
- 경로의 실제 대소문자와 파일명이 정확히 일치해야 한다.
- symlink를 따라 `content/` 밖의 파일을 참조할 수 없다.

## 5. Curriculum 스키마

### 5.1 tracks.yaml

최상위에는 `schemaVersion`과 `tracks`만 둔다.

```yaml
schemaVersion: 1
tracks:
  - id: python
    revision: 1
    title: Python 기초
    description: 자료구조 학습에 필요한 Python 기초
    order: 10

  - id: data-structures
    revision: 1
    title: 자료구조
    description: 핵심 자료구조와 연산을 학습한다.
    order: 20
```

```ts
interface TrackSource {
  id: string;
  revision: number;
  title: string;
  description: string;
  order: number;
}

interface TracksSource {
  schemaVersion: 1;
  tracks: TrackSource[];
}
```

추가 규칙:

- `tracks`는 하나 이상의 항목을 가져야 한다.
- `order`는 `0` 이상의 정수다.
- 여러 track이 같은 `order`를 가질 수 있다. 이때 ID 오름차순으로 표시 순서를 안정화한다.
- `order`는 선행 조건이나 unlock에 영향을 주지 않는다.

### 5.2 graph.yaml

선행 관계는 `requires` 한 방향으로만 저장한다.

```yaml
schemaVersion: 1
nodes:
  - lesson: py.variables
    requires: []

  - lesson: ds.array
    requires:
      - py.variables
```

```ts
interface CurriculumNodeSource {
  lesson: string;
  requires: string[];
}

interface CurriculumGraphSource {
  schemaVersion: 1;
  nodes: CurriculumNodeSource[];
}
```

추가 규칙:

- 모든 lesson은 graph에 정확히 한 번 나타나야 한다.
- `requires`는 중복 없는 lesson ID 배열이다.
- 자기 자신을 prerequisite로 지정할 수 없다.
- 모든 참조 lesson이 존재해야 한다.
- graph는 directed acyclic graph여야 한다.
- 서로 다른 track의 lesson도 prerequisite로 참조할 수 있다.

## 6. Lesson 스키마

`lesson.yaml`은 메타데이터와 실행 순서만 정의한다.

```yaml
schemaVersion: 1
id: py.variables
revision: 1
track: python
title: 변수
description: 값을 이름에 연결하고 다시 사용하는 방법을 학습한다.

flow:
  - type: content
    ref: content/intro.md

  - type: question
    ref: py.variables.definition-01

  - type: content
    ref: content/assignment.md

  - type: question
    ref: py.variables.assignment-01
```

```ts
interface LessonSource {
  schemaVersion: 1;
  id: string;
  revision: number;
  track: string;
  title: string;
  description: string;
  flow: LessonFlowItemSource[];
}

type LessonFlowItemSource = ContentFlowItemSource | QuestionFlowItemSource;

interface ContentFlowItemSource {
  type: "content";
  ref: string;
}

interface QuestionFlowItemSource {
  type: "question";
  ref: string;
}
```

검증 규칙:

- `track`은 `tracks.yaml`에 존재해야 한다.
- `flow`는 하나 이상의 항목을 가져야 한다.
- content `ref`는 같은 lesson 디렉터리의 `content/*.md` 파일이어야 한다.
- question `ref`는 같은 lesson 디렉터리의 question ID여야 한다.
- 하나의 flow에서 같은 content 파일이나 question을 두 번 참조할 수 없다.
- lesson 디렉터리의 모든 question은 flow에서 정확히 한 번 참조되어야 한다.
- lesson 디렉터리의 Markdown은 참조되지 않아도 되지만 validator가 경고한다.
- 첫 항목과 마지막 항목의 type에는 제한을 두지 않는다.

## 7. Markdown 설명 콘텐츠

긴 설명은 `content/*.md`에 작성하고 lesson flow의 content item에서 참조한다.

````markdown
# 변수란 무엇인가

변수는 값을 다시 사용할 수 있도록 붙이는 이름이다.

```python
score = 10
print(score)
```
````

Markdown 처리 규칙:

- CommonMark 문법과 fenced code block을 지원한다.
- raw HTML은 허용하지 않는다.
- `<script>`와 실행 가능한 JavaScript URL은 허용하지 않는다.
- Markdown 안의 상대 image 경로는 Markdown 파일을 기준으로 해석한다.
- 외부 HTTP(S) image는 허용하지 않는다. 오프라인에서 사용할 수 있는 로컬 asset만 참조한다.
- 일반 HTTP(S) link는 허용하되 앱이 외부 링크임을 표시한다.
- 첫 heading은 선택 사항이며 Builder가 임의로 heading을 추가하지 않는다.
- YAML front matter는 v1에서 허용하지 않는다.

## 8. Content Block

Question의 `prompt`, `explanation`, option과 item의 표시 내용에는 inline Content Block 배열을 사용한다. Markdown 파일 참조형 block은 없다.

```ts
type ContentBlockSource =
  | TextBlockSource
  | MarkdownBlockSource
  | CodeBlockSource
  | ImageBlockSource
  | DiagramBlockSource;

interface TextBlockSource {
  type: "text";
  text: string;
}

interface MarkdownBlockSource {
  type: "markdown";
  markdown: string;
}

interface CodeBlockSource {
  type: "code";
  language: string;
  code: string;
}

interface ImageBlockSource {
  type: "image";
  src: string;
  alt: string;
}

interface DiagramBlockSource {
  type: "diagram";
  diagramType: string;
  data: unknown;
  alt: string;
}
```

예:

```yaml
prompt:
  - type: text
    text: 다음 코드가 출력하는 값을 고르세요.
  - type: code
    language: python
    code: |-
      count = 2
      print(count + 1)
```

공통 규칙:

- Content Block 배열은 하나 이상의 block을 가져야 한다.
- `language`는 syntax highlighting을 위한 비어 있지 않은 소문자 식별자다. 실행 가능 언어라는 의미는 아니다.
- `image.alt`와 `diagram.alt`는 필수이며 장식용 이미지도 빈 문자열을 사용할 수 없다.
- `src`는 해당 question YAML 기준 상대 경로다.
- `diagramType`은 등록된 Diagram Renderer의 ID여야 한다.
- v1은 DiagramBlock의 공통 envelope만 정의한다. 각 `diagramType`의 `data`는 해당 renderer 명세와 validator가 정의한다.
- inline `markdown`에도 raw HTML을 허용하지 않는다.

## 9. Question 공통 스키마

모든 question 파일은 다음 공통 필드를 가진다.

```ts
interface QuestionBaseSource {
  schemaVersion: 1;
  id: string;
  revision: number;
  type: QuestionType;
  prompt: ContentBlockSource[];
  explanation?: ContentBlockSource[];
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

공통 규칙:

- `prompt`는 사용자에게 답을 요구하는 완결된 질문이어야 한다.
- `explanation`은 제출 이후 표시하는 해설이며 정답 여부와 관계없이 같은 내용을 사용한다.
- 정답별 맞춤 feedback은 v1 source schema에 포함하지 않는다.
- 모든 문제의 score는 정답이면 `1`, 오답이면 `0`이다.
- 부분 점수와 콘텐츠별 scoring 설정은 허용하지 않는다.
- question 파일의 소유 lesson은 파일 위치로 결정한다. YAML에 `lessonId`를 중복 기록하지 않는다.

## 10. 문자열 답안 정규화

`fill-blank`, `code-output`, `code-completion`은 자유 문자열을 받지 않고 선택지 중 하나를 선택한다. 선택한 값과 허용 답안은 같은 방식으로 정규화한 뒤 비교한다.

### 10.1 일반 문자열 정규화

`fill-blank`와 `code-completion`의 blank 답안에는 다음 순서를 적용한다.

1. CRLF와 CR을 LF로 변환한다.
2. 앞뒤 Unicode whitespace를 제거한다.
3. 연속된 내부 Unicode whitespace를 ASCII space 하나로 합친다.
4. Unicode 문자열을 NFC로 정규화한다.
5. 결과 문자열을 `choices`와 `acceptedAnswers`의 각 값에 같은 정규화를 적용한 결과와 비교한다.

대소문자는 구분한다. 정규식, 임의 코드, locale별 case folding은 사용하지 않는다.

Builder는 정규화 후 서로 같아지는 중복 허용 답안을 오류로 처리한다.

### 10.2 출력 정규화

`code-output`에는 다음 순서를 적용한다.

1. CRLF와 CR을 LF로 변환한다.
2. 각 줄 끝의 space와 tab을 제거한다.
3. 파일 끝의 LF는 모두 제거한다.
4. Unicode 문자열을 NFC로 정규화한다.
5. 내부 줄과 각 줄의 앞쪽 공백은 보존한다.

대소문자는 구분한다.

### 10.3 선택지 계약

`fill-blank`와 `code-output`은 최상위 `choices`를 필수로 가진다. `code-completion`은 각 blank가 `choices`를 필수로 가진다.

- 각 `choices` 배열은 최소 2개의 문자열을 가져야 한다.
- `fill-blank.choices`와 `fill-blank.acceptedAnswers`는 Section 10.1로 정규화한다.
- `code-output.choices`와 `code-output.acceptedOutputs`는 Section 10.2로 정규화한다.
- `code-completion`의 blank `choices`와 `acceptedAnswers`는 Section 10.1로 정규화한다.
- 정규화한 `choices`에는 중복이 없어야 한다. 각 허용 답안 배열에도 정규화 후 중복이 없어야 한다.
- 모든 `acceptedAnswers` 또는 `acceptedOutputs`는 같은 정규화 규칙을 적용했을 때 해당 `choices`에 포함되어야 한다.
- 선택지는 학습자가 구분할 수 있는 오답을 포함해야 하며, 정답과 의미상 동일한 선택지를 중복해서 만들지 않는다.

## 11. Question 유형별 스키마

### 11.1 single-choice

사용자가 여러 option 중 하나를 선택한다.

```yaml
schemaVersion: 1
id: py.variables.definition-01
revision: 1
type: single-choice
prompt:
  - type: text
    text: Python 변수에 대한 올바른 설명은 무엇인가요?
options:
  - id: named-value
    content:
      - type: text
        text: 값을 다시 참조할 수 있는 이름이다.
  - id: fixed-type
    content:
      - type: text
        text: 한 번 정한 자료형을 바꿀 수 없는 저장소다.
correctOptionId: named-value
shuffleOptions: false
explanation:
  - type: text
    text: 변수 이름을 사용하면 연결된 값을 다시 읽거나 바꿀 수 있습니다.
tags: [variable, assignment]
difficulty: 1
```

```ts
interface SingleChoiceQuestionSource extends QuestionBaseSource {
  type: "single-choice";
  options: ChoiceOptionSource[];
  correctOptionId: string;
  shuffleOptions?: boolean;
}

interface ChoiceOptionSource {
  id: string;
  content: ContentBlockSource[];
}
```

검증과 평가:

- `options`는 2개 이상이어야 한다.
- `correctOptionId`는 정확히 하나의 option을 참조해야 한다.
- `shuffleOptions` 기본값은 `false`다.
- 제출한 option ID가 `correctOptionId`와 같을 때만 정답이다.

### 11.2 multi-select

사용자가 여러 option을 선택한다.

```yaml
schemaVersion: 1
id: py.variables.names-01
revision: 1
type: multi-select
prompt:
  - type: text
    text: 유효한 Python 변수 이름을 모두 고르세요.
options:
  - id: score
    content:
      - type: code
        language: python
        code: score
  - id: user-name
    content:
      - type: code
        language: python
        code: user_name
  - id: starts-number
    content:
      - type: code
        language: python
        code: 2nd_place
correctOptionIds: [score, user-name]
shuffleOptions: false
```

```ts
interface MultiSelectQuestionSource extends QuestionBaseSource {
  type: "multi-select";
  options: ChoiceOptionSource[];
  correctOptionIds: string[];
  shuffleOptions?: boolean;
}
```

검증과 평가:

- `options`는 2개 이상이어야 한다.
- `correctOptionIds`는 중복 없이 1개 이상이어야 한다.
- 모든 correct ID는 option을 참조해야 한다.
- 모든 option을 정답으로 지정할 수는 없다.
- 제출 ID 집합과 정답 ID 집합이 정확히 같을 때만 정답이다. 배열 순서는 무시한다.

### 11.3 fill-blank

사용자가 여러 선택지 중 하나의 짧은 문자열을 고른다.

```yaml
schemaVersion: 1
id: py.variables.assignment-01
revision: 1
type: fill-blank
prompt:
  - type: text
    text: name 변수에 문자열 "Ada"를 할당하는 코드의 빈칸에 들어갈 기호를 고르세요.
  - type: code
    language: python
    code: name ___ "Ada"
choices:
  - "="
  - "=="
  - "+="
acceptedAnswers:
  - "="
explanation:
  - type: text
    text: Python은 등호로 변수 이름에 값을 할당합니다.
```

```ts
interface FillBlankQuestionSource extends QuestionBaseSource {
  type: "fill-blank";
  choices: string[];
  acceptedAnswers: string[];
}
```

검증과 평가:

- `choices`는 두 개 이상의 문자열을 가져야 하며, 정규화 후 중복이 없어야 한다.
- `acceptedAnswers`는 하나 이상의 비어 있지 않은 문자열을 가져야 하며 정규화 후 중복이 없어야 한다.
- 모든 `acceptedAnswers`는 정규화 후 `choices`에 포함되어야 한다.
- prompt의 blank 표시는 표현용이며 특정 token 문법을 요구하지 않는다.
- 사용자가 고른 값 하나를 Section 10.1에 따라 비교한다.
- accepted answer 중 하나와 같을 때만 정답이다.

### 11.4 ordering

사용자가 item을 올바른 순서로 배열한다.

```yaml
schemaVersion: 1
id: py.variables.execution-order-01
revision: 1
type: ordering
prompt:
  - type: text
    text: 코드가 실행되는 순서대로 배열하세요.
items:
  - id: assign
    content:
      - type: text
        text: score에 10을 할당한다.
  - id: add
    content:
      - type: text
        text: score에 5를 더한다.
  - id: print
    content:
      - type: text
        text: score를 출력한다.
correctOrder: [assign, add, print]
```

```ts
interface OrderingQuestionSource extends QuestionBaseSource {
  type: "ordering";
  items: OrderItemSource[];
  correctOrder: string[];
}

interface OrderItemSource {
  id: string;
  content: ContentBlockSource[];
}
```

검증과 평가:

- `items`는 2개 이상이어야 한다.
- `correctOrder`는 모든 item ID를 정확히 한 번 포함해야 한다.
- 런타임은 최초 표시 순서를 섞는다. 가능한 경우 정답과 다른 순서를 사용한다.
- 제출 배열이 `correctOrder`와 위치별로 모두 같을 때만 정답이다.

### 11.5 matching

사용자가 내용이 보이는 카드 두 장을 골라 left item과 right item을 일대일로 연결한다.

```yaml
schemaVersion: 1
id: py.variables.types-01
revision: 1
type: matching
prompt:
  - type: text
    text: 값과 Python 자료형을 연결하세요.
leftItems:
  - id: number-value
    content:
      - type: code
        language: python
        code: "42"
  - id: text-value
    content:
      - type: code
        language: python
        code: '"Ada"'
rightItems:
  - id: integer-type
    content:
      - type: code
        language: python
        code: int
  - id: string-type
    content:
      - type: code
        language: python
        code: str
correctPairs:
  - leftId: number-value
    rightId: integer-type
  - leftId: text-value
    rightId: string-type
```

```ts
interface MatchingQuestionSource extends QuestionBaseSource {
  type: "matching";
  leftItems: MatchItemSource[];
  rightItems: MatchItemSource[];
  correctPairs: MatchPairSource[];
}

interface MatchItemSource {
  id: string;
  content: ContentBlockSource[];
}

interface MatchPairSource {
  leftId: string;
  rightId: string;
}
```

검증과 평가:

- 각 item 집합은 2개 이상이며 두 집합의 크기는 같아야 한다.
- left와 right ID는 question 전체에서 서로도 중복될 수 없다.
- `correctPairs`는 모든 left와 right ID를 정확히 한 번 사용해야 한다.
- 런타임은 left와 right item을 하나의 카드 묶음으로 합쳐 섞고, 모든 카드 내용을 처음부터 표시한다.
- 서로 다른 쪽의 카드가 `correctPairs`에 해당하면 `matched` 상태로 고정한다.
- 같은 쪽을 고르거나 잘못된 pair를 고르면 선택을 해제한다.
- 모든 pair를 맞추면 `correctPairs`로 자동 평가한다. 평가 pair 배열의 순서는 무시한다.

### 11.6 code-output

실행하지 않은 Python 코드의 출력 결과 중 하나를 사용자가 고른다.

```yaml
schemaVersion: 1
id: py.variables.output-01
revision: 1
type: code-output
prompt:
  - type: text
    text: 다음 코드의 출력 결과를 고르세요.
language: python
code: |-
  value = 3
  value = value + 2
  print(value)
choices:
  - "5"
  - "3"
  - "8"
acceptedOutputs:
  - "5"
explanation:
  - type: text
    text: 두 번째 줄에서 value가 5로 갱신됩니다.
```

```ts
interface CodeOutputQuestionSource extends QuestionBaseSource {
  type: "code-output";
  language: "python";
  code: string;
  choices: string[];
  acceptedOutputs: string[];
}
```

검증과 평가:

- `language`는 v1에서 `python`만 허용한다.
- `code`는 표시용이며 Builder와 앱은 실행하지 않는다.
- `choices`는 두 개 이상의 문자열을 가져야 하며, 출력 정규화 후 중복이 없어야 한다.
- `acceptedOutputs`는 하나 이상의 문자열을 가져야 하고 출력 정규화 후 중복이 없어야 하며, 모든 값이 `choices`에 포함되어야 한다. 빈 출력이 정답이면 빈 문자열을 선택지에 명시할 수 있다.
- 사용자가 고른 값은 Section 10.2의 출력 정규화 후 비교한다.

### 11.7 code-completion

사용자가 Python 코드 template의 각 blank에서 선택지를 고른다. 자유 코드 실행은 하지 않는다.

```yaml
schemaVersion: 1
id: py.variables.completion-01
revision: 1
type: code-completion
prompt:
  - type: text
    text: 두 수를 더해 result에 저장하도록 각 blank의 선택지를 고르세요.
language: python
template: |-
  left = 2
  right = 3
  result = {{blank:operator}}
blanks:
  - id: operator
    choices:
      - left + right
      - left - right
      - left * right
    acceptedAnswers:
      - left + right
explanation:
  - type: text
    text: 덧셈 연산자로 두 변수의 값을 더할 수 있습니다.
```

```ts
interface CodeCompletionQuestionSource extends QuestionBaseSource {
  type: "code-completion";
  language: "python";
  template: string;
  blanks: CodeBlankSource[];
}

interface CodeBlankSource {
  id: string;
  choices: string[];
  acceptedAnswers: string[];
}
```

검증과 평가:

- `language`는 v1에서 `python`만 허용한다.
- placeholder 문법은 `{{blank:<id>}}`다.
- `template`의 모든 placeholder는 `blanks`에 정확히 한 번 정의되어야 한다.
- 정의된 blank는 template에서 정확히 한 번 사용되어야 한다.
- blank는 하나 이상이어야 한다.
- 각 blank의 `choices`는 두 개 이상이어야 하며 Section 10.1로 정규화한 뒤 중복이 없어야 한다.
- 각 blank의 `acceptedAnswers`는 하나 이상의 비어 있지 않은 문자열이어야 하며 정규화 후 중복이 없어야 한다.
- 각 blank의 모든 `acceptedAnswers`는 정규화 후 해당 blank의 `choices`에 포함되어야 한다.
- 사용자가 각 blank에서 고른 값은 Section 10.1에 따라 비교한다.
- 모든 blank가 맞을 때만 question 정답이다.
- 완성된 코드는 실행하지 않는다.

## 12. Asset 규칙

지원 대상은 정적 image와 diagram renderer가 읽는 데이터다.

- image format은 v1에서 `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`를 허용한다.
- 파일 확장자는 실제 MIME type과 일치해야 한다.
- SVG 안의 `<script>`, event handler attribute, 외부 resource 참조는 허용하지 않는다.
- 모든 ImageBlock에는 의미 있는 `alt`가 있어야 한다.
- 사용되지 않는 asset은 validator warning 대상이다.
- Builder는 참조 asset을 generated content가 사용하는 공개 경로로 복사하거나 fingerprint할 수 있다. source schema의 상대 참조 의미는 유지해야 한다.

## 13. Revision 규칙

### 13.1 revision을 증가시키는 변경

- 정답 또는 accepted answer 변경
- 질문의 의미 변경
- option, item, pair 추가·삭제 또는 의미 변경
- 채점 결과가 달라지는 정규화 규칙 변경
- lesson flow의 학습 단계 추가·삭제·재배치
- track 또는 lesson의 학습 의미 변경

### 13.2 revision을 유지할 수 있는 변경

- 의미를 바꾸지 않는 오타 수정
- 같은 의미의 문체 개선
- alt나 explanation의 사실관계 유지 보완
- 정답과 무관한 표시 순서 변경
- 렌더링 스타일 변경

판단이 애매하면 revision을 증가시킨다. ID는 revision과 관계없이 유지한다.

## 14. Source validation

Content Builder는 compile 전에 다음 순서로 검증한다.

1. YAML syntax와 top-level schema
2. 정의되지 않은 필드와 값 타입
3. 파일 경로와 ID/file-name 일치
4. 전역 ID uniqueness
5. track, lesson, question, Markdown, asset reference integrity
6. curriculum graph completeness와 cycle
7. Content Block과 Question 유형별 규칙
8. revision과 source schema version

오류에는 최소한 다음 위치 정보를 포함한다.

```text
content/lessons/py.variables/questions/py.variables.definition-01.yaml:18
[correctOptionId] option "correct" does not exist
```

검증 결과 정책:

- error가 하나라도 있으면 build하지 않고 non-zero exit code로 종료한다.
- 가능한 경우 한 번의 실행에서 모든 독립 error를 수집한다.
- warning은 build를 막지 않지만 CI output에 표시한다.
- warning 대상은 미참조 Markdown, 미사용 asset처럼 결과의 정확성을 깨뜨리지 않는 항목으로 제한한다.

## 15. Generated JSON 계약

Builder는 source를 검증한 뒤 다음 구조로 생성한다.

```text
generated/
├─ curriculum.json
├─ lessons/
│  └─ py.variables.json
├─ questions/
│  └─ py.variables.definition-01.json
└─ manifest.json
```

generated JSON 공통 규칙:

- source의 YAML key는 camelCase JSON key로 유지한다.
- YAML default 값은 JSON에 명시적으로 materialize한다.
- lesson JSON의 content flow item에는 Markdown을 처리한 Content Block 배열을 포함한다.
- lesson JSON의 question flow item은 question ID를 유지한다.
- question JSON에는 source 파일 위치에서 유도한 `lessonId`를 추가한다.
- source 전용 상대 asset 경로는 앱이 읽을 수 있는 생성 경로로 변환한다.
- 런타임은 source file path에 의존하지 않는다.

```ts
interface ContentManifest {
  schemaVersion: 1;
  buildId: string;
  generatedAt: string;
  tracks: string[];
  lessons: string[];
  questions: string[];
}
```

Manifest 규칙:

- ID 배열은 오름차순으로 정렬한다.
- `generatedAt`은 UTC ISO 8601 문자열이다.
- `buildId`는 검증된 source 내용과 Builder 버전에서 계산한 deterministic hash다. `generatedAt`은 hash 입력에 포함하지 않는다.
- 같은 source와 같은 Builder 버전은 같은 `buildId`를 생성해야 한다.

## 16. 유효하지 않은 예

### 16.1 index로 정답 참조

```yaml
correctOptionIndex: 0
```

option 순서 변경에 취약하므로 허용하지 않는다. `correctOptionId`를 사용한다.

### 16.2 question 파일에 lesson 중복 기록

```yaml
lessonId: py.variables
```

소유 lesson은 파일 위치로 결정하므로 허용하지 않는다.

### 16.3 외부 Markdown 참조를 prompt에 사용

```yaml
prompt:
  - type: markdown-file
    ref: prompt.md
```

외부 Markdown 참조는 lesson의 content flow에서만 허용한다.

### 16.4 정규식 또는 실행 코드 정답

```yaml
answerPattern: "^[0-9]+$"
evaluator: "return answer === '5'"
```

정규식과 executable evaluator는 허용하지 않는다.

### 16.5 정의되지 않은 확장 필드

```yaml
customRenderer: fancy-card
```

v1은 임의 확장 영역을 제공하지 않는다. 새 필드는 schema와 validator를 먼저 변경해야 한다.

## 17. 변경 절차

콘텐츠 스키마를 변경할 때는 다음을 함께 수행한다.

1. 이 문서의 source와 generated 계약 수정
2. source schema version 변경 필요성 검토
3. TypeScript type과 validator 수정
4. 유효·무효 fixture 수정
5. 기존 콘텐츠 migration
6. Content Builder 및 production build 검증

새로운 optional 필드처럼 기존 source를 그대로 해석할 수 있는 변경은 같은 `schemaVersion`에서 허용할 수 있다. 기존 필드의 의미 변경, 필수 필드 추가, discriminator 변경처럼 기존 source를 다르게 해석하는 변경은 `schemaVersion`을 증가시킨다.

## 구현 보충: Markdown 표시

현재 Builder는 source `markdown`을 보존하면서 generated MarkdownBlock에 선택적 `html: string`을 추가한다. 이 HTML은 빌드 시 Markdown parser와 허용 목록 기반 sanitizer를 거친 결과다. 작성 원본 YAML에는 `html`을 직접 쓸 수 없다. 런타임은 생성된 HTML을 표시하고 Markdown parser를 포함하지 않는다. 기존 generated block에 HTML이 없으면 안전한 일반 텍스트로 표시한다.
