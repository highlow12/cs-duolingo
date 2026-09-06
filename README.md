# CS 듀오링고

컴퓨터과학을 짧은 학습 세션과 반복 문제로 공부할 수 있도록 돕는 Offline First 학습 앱입니다.

## 현재 목표

- SvelteKit 기반 웹 앱과 PWA 구축
- YAML/Markdown 콘텐츠를 검증된 정적 JSON으로 변환
- Curriculum DAG와 Lesson Flow 실행
- 재사용 가능한 Question Plugin과 독립 Evaluator 구성
- IndexedDB 기반 학습 진행도와 FSRS 복습 시스템 확장
- 동일한 앱을 Capacitor로 Android/iOS에 배포

Phase 1 Skeleton과 Phase 2 Content Pipeline을 완료했으며, 다음 단계는 `QUESTION_SPEC.md`에 따른 Question Engine 확장입니다.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

주요 명령:

```bash
npm run content:validate  # 콘텐츠 스키마와 참조 검증
npm run content:build     # YAML/Markdown → generated JSON
npm run check             # 타입·Svelte·콘텐츠 검사
npm run test              # 단위 테스트
npm run build             # 정적 웹 빌드
```

## 구조

```text
content/       작성 원본 YAML/Markdown
generated/     콘텐츠 빌드 산출물
scripts/       콘텐츠 검증·빌드 스크립트
src/           SvelteKit 앱과 도메인 코드
static/        PWA 정적 자산
tests/         단위 테스트
```

전체 아키텍처는 [SYSTEM_SPEC.md](./SYSTEM_SPEC.md), 콘텐츠 작성 규칙은 [CONTENT_SPEC.md](./CONTENT_SPEC.md), Question Engine의 런타임 계약은 [QUESTION_SPEC.md](./QUESTION_SPEC.md)에 정의되어 있습니다.

## 학습 경로

초기 학습 경로는 Python 기초, 자료구조·알고리즘, 컴퓨터 구조를 중심으로 구성하며, 자료구조에서 배열·트리·그래프로 분기해 정렬·탐색·DFS·BFS·다익스트라·A* 등으로 연결합니다.

## 초기 문제 형식

- `single-choice`
- `multi-select`
- `fill-blank`
- `ordering`
- `matching`
- `code-output`
- `code-completion`

첫 번째 수직 슬라이스에서는 `single-choice`와 `fill-blank`를 우선 구현합니다.

## 라이선스

라이선스는 프로젝트 방향이 정해진 뒤 결정할 예정입니다.
