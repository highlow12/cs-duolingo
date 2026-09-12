# CS 듀오링고

짧은 설명과 7종 문제, 개인 복습 일정으로 컴퓨터과학을 익히는 **오프라인 우선 학습 앱 MVP**입니다. Svelte 5 + SvelteKit 정적 SPA이며 계정이나 서버 없이 동작합니다.

👉 **[GitHub Pages에서 바로 실행하기](https://highlow12.github.io/cs-duolingo/)**

## 실행

Node.js 24를 사용합니다.

```bash
npm ci
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. 프로덕션 동작은 `npm run build && npm run preview`로 확인합니다. PWA는 HTTPS 또는 localhost에서 한 번 온라인으로 열고 오프라인 자료 준비를 마친 뒤 사용할 수 있습니다.

## 구현 범위

- 홈: 이어 학습하기, 복습 대기 문제, 오늘 목표와 경험치.
- 학습 경로: 선행 레슨을 모두 완료하면 다음 레슨이 열리는 DAG.
- 레슨: 설명과 문제를 순서대로 진행하고 저장된 단계부터 이어하기.
- 문제: 단일 선택, 복수 선택, 빈칸, 순서, 연결, 코드 출력, 제한된 코드 완성.
- 첫 오답에는 정답을 숨기고 한 번 재시도. 최종 제출 후 설명과 정답 표시.
- Dexie 트랜잭션 기반 학습 기록, 중복 제출 방지, 완료 상태 보존.
- ts-fsrs 복습 일정, 복습 세션, 경험치·로컬 날짜 연속 학습.
- 진행도, 일일 목표, JSON 백업·복원, 기록 초기화.
- 빌드 시 안전하게 변환한 Markdown, 전체 학습 자료 오프라인 캐시, 학습을 방해하지 않는 업데이트 적용.
- Capacitor Android/iOS 소스 프로젝트와 CI.

학습 데이터는 브라우저/기기별로 분리됩니다. 다른 기기로 옮길 때 설정에서 백업을 다운로드하고 복원하세요. 서버 동기화는 제공하지 않습니다.

## 학습 콘텐츠

5개 트랙, 21개 레슨, 78개 문제를 제공합니다. **학부 전체 과정을 완성한 교재가 아니라 앱의 전체 학습 흐름을 사용할 수 있는 입문 콘텐츠**입니다.

| 트랙          | 내용                                                         |
| ------------- | ------------------------------------------------------------ |
| Python 기초   | 변수, 기본 타입과 연산, 입출력, 조건문, 반복문, 함수, 리스트 |
| 자료구조      | 배열, 스택, 큐, 트리, 그래프                                 |
| 알고리즘      | 탐색, 정렬, BFS·DFS, Dijkstra·A* 입문                        |
| 컴퓨터 구조   | 이진수, 논리 게이트, CPU                                     |
| 컴퓨터 시스템 | 네트워크, 그래픽스 입문                                      |

Python → 자료구조 → 알고리즘으로 이어집니다. 컴퓨터 구조 트랙은 독립적으로 시작하며 네트워크·그래픽스로 분기합니다.

## 주요 명령

```bash
npm run content:validate  # YAML, ID, 참조, 정답, DAG 검증
npm run content:build     # 작성 원본 → 정적 JSON과 정제된 HTML
npm run check            # Svelte·TypeScript·콘텐츠 검사
npm test                 # 도메인·콘텐츠·오프라인 캐시 테스트
npm run build            # build/ 정적 웹 배포 산출물
npm run verify           # 전체 검증과 빌드
npm run mobile:sync      # 웹 빌드 + Android/iOS 동기화
npm run mobile:android   # Android Studio로 열기
npm run mobile:ios       # Xcode로 열기 (macOS)
```

정적 호스팅에서는 `build/`를 게시하고 앱 경로의 fallback을 `index.html`로 설정합니다. 네이티브 서명 빌드에는 별도로 Android SDK/JDK 또는 macOS/Xcode와 개발자 서명 설정이 필요합니다. 현재 환경에서는 네이티브 소스 생성·동기화까지만 검증합니다.

## 구조

```text
content/        YAML/Markdown 작성 원본
scripts/content 콘텐츠 검증·변환
src/lib/content 정적 콘텐츠 repository
src/lib/questions 순수 evaluator, host, renderer registry 및 7종 입력 UI
src/lib/learning 진행도 모델, FSRS adapter, 게임화 정책
src/lib/storage Dexie와 learningRepository
src/lib/curriculum 선행 조건 정책
src/routes/     홈·학습·복습·진행도·설정
android/, ios/  Capacitor 네이티브 소스
```

새 레슨은 `content/lessons/<id>/lesson.yaml`, `content/*.md`, `questions/*.yaml`로 작성하고 curriculum graph에 등록합니다. 앱은 generated JSON만 읽습니다. ID는 재사용하지 않고 의미·정답 변경 시 revision을 증가시킵니다.

상위 구조는 [SYSTEM_SPEC.md](SYSTEM_SPEC.md), 작성 규칙은 [CONTENT_SPEC.md](CONTENT_SPEC.md), 문제 계약은 [QUESTION_SPEC.md](QUESTION_SPEC.md), 저장·복습 정책은 [PROGRESS_SPEC.md](PROGRESS_SPEC.md)를 참고하세요. 검증 범위와 실제 기기 점검은 [docs/TESTING.md](docs/TESTING.md), 현재 완료 상태는 [IMPLEMENTATION.md](IMPLEMENTATION.md)에 기록합니다.

## 라이선스

아직 결정하지 않았습니다.
