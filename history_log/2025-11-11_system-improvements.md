# 2025-11-11 시스템 개선 사항 기록

- 작성자: GPT-5 Codex
- 요약: 포트폴리오 분석/자동투자 안정성 강화를 위한 UI 개선 및 테스트 보강

## 상세 변경 내용

1. **거래 이력 UX 개선**
   - 검색 입력, CSV 내보내기 버튼 추가 및 필터 상태 `localStorage` 저장.
   - 검색 결과 개수와 전체 건수를 분리 표시.
   - 거래 카드/아코디언 내에서 `TransactionDetailPopover` 연동으로 상세 정보 접근성 강화.

2. **자동 투자/손익 로직 테스트 보강**
   - `tests/unit/auto-invest.test.ts`: 금액/기간/잔액 조건 및 경고 발생 여부 검증.
   - `tests/unit/profit-calculation.test.ts`: 총 투자금 기반 수익률 계산 정확도 검증.
   - 루트 `package.json`에 `vitest` devDependency 추가.

3. **포트폴리오 분석 E2E 흐름 확인**
   - `tests/e2e/portfolio-analysis.spec.ts` 작성 (Playwright, API 모킹 포함).
   - 주요 위젯 렌더링 및 시나리오 분석 인터랙션 검증.

## 관련 테스트

- `npm run test:unit` (vitest)  
- `npx playwright test` (E2E)


