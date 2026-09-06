# MVP 구현 상태

SYSTEM_SPEC.md, CONTENT_SPEC.md, QUESTION_SPEC.md 기준의 오프라인 학습 앱 MVP 구현을 완료했다. 학부 전체 교재가 아닌 확장 가능한 앱과 입문 콘텐츠를 제공한다.

## 구현 완료

- 5개 트랙, 19개 레슨, 60개 문제와 선행 조건 DAG.
- 7종 입력 Renderer와 공통 Question Host, 첫 오답 재시도, 최종 결과 저장.
- Dexie 원자적 학습 이벤트·상태·Outbox 저장, 중복 방지와 세션 복구.
- ts-fsrs 5.4.2 복습 일정, 경험치·연속 학습·일일 목표.
- 홈, 학습 경로, 레슨, 복습, 진행도, 설정 및 JSON 백업·복원.
- 빌드 시 정제된 Markdown HTML과 전체 학습 자료 오프라인 캐시.
- 사용자 선택으로 적용하는 서비스 워커 업데이트.
- Capacitor Android/iOS 소스 프로젝트 및 검증 CI.

## 검증 결과

- `npm run verify`: 콘텐츠 검증, Svelte/TypeScript 검사(오류·경고 0개), 9개 파일의 44개 테스트, 정적 프로덕션 빌드 통과.
- 테스트는 모든 작성 문제의 정답 평가, Host 재시도·저장 오류, 저장 트랜잭션·복원·revision 변경, 레슨 완료부터 복습까지의 통합 흐름, 서비스 워커 오프라인 동작을 포함한다.
- `npx cap sync`: Android/iOS 웹 자산 및 네이티브 프로젝트 동기화 통과.
- 실제 브라우저 UI·모바일 터치 및 기기 검증은 실행하지 않았다. 점검 절차는 docs/TESTING.md에 기록했다.
- Android SDK와 macOS/Xcode가 없어 APK/AAB/IPA 빌드·서명·실기기 테스트는 수행하지 않았다.

계정, 서버 동기화, 자유 코드 실행, 학부 전과정 콘텐츠는 이번 MVP 범위 밖이다.
