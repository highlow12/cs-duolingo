# Question Type Decisions

이 문서는 `SYSTEM_SPEC.md`의 "향후 CS 전용 Plugin 후보"를 실제 구현 관점에서 구체화한다.

## 원칙

새 Question type은 이름이나 학습 주제가 다르다는 이유만으로 추가하지 않는다.

다음 중 하나 이상이 기존 타입과 실질적으로 달라질 때만 별도 type과 renderer/evaluator를 만든다.

- 사용자가 답을 만드는 상호작용 방식
- 답안 데이터 구조
- 유효성 검증 규칙
- 채점 의미

같은 상호작용을 다른 시각 자료에 적용하는 경우에는 기존 Question type과 Content Block/Diagram을 조합한다. 이 원칙은 문제 타입 수가 늘어나면서 renderer와 evaluator가 복제되는 것을 막기 위한 것이다.

## 구현하는 CS 전용 타입

### `graph-path`

그래프의 node를 직접 선택해 시작점에서 목표점까지 경로를 만든다.

기존 `ordering`과 달리 다음 제약이 상호작용 자체에 포함된다.

- 현재 node와 edge로 연결된 node만 다음 선택으로 허용한다.
- directed graph에서는 edge 방향을 따른다.
- 한 경로에서 같은 node를 다시 방문하지 않는다.
- 시작점과 목표점이 문제 데이터에 포함된다.
- 복수의 accepted path를 정답으로 지정할 수 있다.

따라서 별도 renderer와 evaluator를 유지한다.

### `interactive-simulation`

현재 state에 따라 실행 가능한 action이 달라지는 결정적 상태 전이 문제다.

기존 `ordering`과 달리 정답은 미리 나열된 항목을 단순 재배열하는 것이 아니다. action을 실행할 때마다 state가 바뀌고, 새 state에서 가능한 다음 action이 다시 결정된다.

- `(state, action)`은 하나의 다음 state만 가져야 한다.
- 같은 action은 서로 다른 state에서 또는 여러 단계에 걸쳐 반복 실행할 수 있다.
- 목표 state에 도달하면 정답이다.
- `maxSteps`로 실행 길이를 제한한다.
- 목표 도달, 단계 소진, dead-end 상태에서 사용자 답안이 완성된다.

따라서 별도 renderer와 evaluator를 유지한다.

## 별도 타입으로 구현하지 않는 후보

### `tree-traversal` → `ordering` 재사용

트리 순회 문제의 핵심 답안은 "node 방문 순서"다. 트리 자체는 prompt의 `diagram` 또는 다른 Content Block으로 표현하고, 사용자가 node를 올바른 순서로 배열하는 상호작용은 기존 `ordering`으로 충분하다.

예:

- preorder 방문 순서
- inorder 방문 순서
- postorder 방문 순서
- BFS 레벨 순서

별도 `tree-traversal` type을 만들면 답안 구조와 평가 로직이 `ordering`과 중복되므로 구현하지 않는다.

향후 실제 node 클릭 순회, frontier 시각화, 방문 상태 변화처럼 **순서 배열을 넘어서는 상호작용**이 필요해질 때 별도 플러그인을 다시 검토한다.

### `memory-layout` → `matching` 재사용

초기 memory layout 문제는 주소/영역과 값·변수·구조를 연결하는 것이 핵심이므로 기존 `matching`으로 표현할 수 있다. 메모리 그림은 prompt의 `diagram` 또는 Content Block으로 제공한다.

예:

- 변수와 메모리 주소 연결
- stack frame 슬롯과 값 연결
- struct field와 offset 연결
- 메모리 영역과 역할 연결

별도 `memory-layout` type을 만들면 두 집합의 항목 연결이라는 답안/평가 구조가 `matching`과 중복되므로 구현하지 않는다.

향후 사용자가 메모리 블록을 직접 배치하거나 alignment/padding을 조절하는 등 **공간 배치 자체가 답**이 되는 문제가 필요해질 때 별도 플러그인을 다시 검토한다.

## 현재 결과

Question 시스템은 기존 7종에 다음 2종을 추가해 총 9종의 runtime/authoring type을 지원한다.

- `single-choice`
- `multi-select`
- `fill-blank`
- `ordering`
- `matching`
- `code-output`
- `code-completion`
- `graph-path`
- `interactive-simulation`

`tree-traversal`과 `memory-layout`은 독립 type이 아니라 기존 primitive를 조합하는 문제 패턴으로 취급한다.
