# Dashboard Improvements QA Checklist (2025-11-14)

- [ ] **Weekly Report Modal**
  - [ ] 버튼 클릭 시 최근 리포트가 1초 내 로드되는지 확인
  - [ ] 모달에서 `상세 보기` 링크 클릭 → `/weekly-reports` 이동

- [ ] **자동 투자**
  - [ ] `/api/internal/test-auto-invest` `dryRun=true` 요청 시 로그에 `preview` 항목 생성
  - [ ] 크론 엔드포인트 `/api/internal/auto-invest/cron` 호출 시 `automationLogs` 문서가 추가되는지 확인

- [ ] **Sell Alert Banner**
  - [ ] 매도 조건 충족 후 Firestore `sellAlerts`에 문서 생성
  - [ ] 대시보드에서 배너 노출 및 닫기(PATCH) 동작 확인

- [ ] **Balance Dashboard**
  - [ ] USD 카드에 환율/전일 대비 퍼센트가 노출되는지 확인

- [ ] **Portfolio Overview**
  - [ ] 통화 토글(KRW/USD) 전환 시 합산 값과 테이블 금액이 따라 변경
  - [ ] 모바일 카드가 `종목/수량/평가금/손익` 정보만 표시하는지 확인

- [ ] **Analysis Page**
  - [ ] "오늘의 한 줄 요약" 카드는 분석 데이터 로드 후 노출
  - [ ] Glossary 아이콘 클릭 시 팝오버가 맞는 설명을 노출
  - [ ] Guided Tour가 최초 1회만 실행되고 Skip 시 localStorage에 상태 저장
  - [ ] Learning Progress 체크박스 상태가 새로고침 후에도 유지
  - [ ] Alert Preference 폼 값이 로컬 스토리지에 저장되는지 확인
  - [ ] MultiStockChart 하이라이트 선택 시 해당 라인 두께 증가 및 나머지 라인 투명도 감소

- [ ] **Rebalancing Simulator**
  - [ ] 설명/체크리스트 문구 노출
  - [ ] 시뮬레이션 실행 시 `executionPlan` 노트에 수수료/현금 흐름이 포함되는지 확인

