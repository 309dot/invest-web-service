# 2025-11-03 QA: 통화/AI 기능 검증

## 실행 항목
- `npm run qa:consistency`
  - 환경 변수
    - `QA_BASE_URL`: `http://localhost:3000`
    - `QA_USER_ID`: 대상 사용자 UID
    - `QA_PORTFOLIO_ID`: 검사할 포트폴리오 ID
    - `QA_TOLERANCE`: 허용 오차 (기본 5 단위)

## 기대 결과
- USD/KRW 투자 총액과 거래 매수 총액이 허용 오차 이내로 일치하면 스크립트가 `✅` 메시지 출력
- 차이가 허용치를 초과하면 `⚠️` 경고와 함께 종료 코드 1 반환

## 참고 사항
- 로컬 개발 서버가 실행 중이어야 하며 Firestore 샘플 데이터가 필요합니다.
- GPT 진단 재생성 버튼(`포트폴리오 분석 > AI 종합 진단`) 동작 확인 시 API 키가 유효해야 합니다.

