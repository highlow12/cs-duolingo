# MVP 구현 상태

기준: SYSTEM_SPEC.md, CONTENT_SPEC.md, QUESTION_SPEC.md. 학부 전체 강의 콘텐츠가 아닌, 확장 가능한 오프라인 학습 앱 MVP와 입문 콘텐츠를 구현한다.

## 완료 확인

- 기존 소스 기준 타입 검사, 13개 테스트, 정적 빌드 통과.
- Markdown을 빌드 시 HTML로 변환하고 허용 태그 및 URL을 정제한다. 앱에는 Markdown parser가 포함되지 않는다.

## 현재 구현·통합 중

- 7종 수동 입력 Renderer + 공통 Question Host, 첫 오답 재시도, 최종 결과 저장.
- Dexie 원자적 학습 이벤트, 상태, Outbox, FSRS 5.4.2 Adapter, 세션 복구.
- 홈, 선행 조건 기반 커리큘럼, 레슨 플레이어, 복습, 진행도, 목표 설정, 백업 복원.
- Python, 자료구조·알고리즘, 컴퓨터 구조의 입문 레슨과 분기.
- 학습 중 새 서비스 워커 강제 교체 방지 및 오프라인 캐시.
- Capacitor Android/iOS 프로젝트 및 CI.

## 검증과 남는 경계

통합 완료 시 이 문서와 README를 실제 테스트·빌드 결과로 갱신한다. Android APK 및 iOS 서명/실기기 검증은 Android SDK와 macOS/Xcode 환경이 필요하다. 계정, 서버 동기화, 자유 코드 실행, 학부 전과정 콘텐츠는 이번 MVP 범위 밖이다.
