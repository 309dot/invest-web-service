# Dashboard Improvements QA Checklist (2025-11-14)

- [ ] **Weekly Report Modal**
  - [ ] 버튼 클릭 시 최근 리포트가 1초 내 로드되는지 확인
  - [ ] 모달에서 `상세 보기` 링크 클릭 → `/weekly-reports` 이동

- [ ] **자동 투자**
  - [ ] `/api/internal/test-auto-invest` `dryRun=true` 요청 시 로그에 `preview` 항목 생성
  - [ ] 크론 엔드포인트 `/api/internal/auto-invest/cron` 호출 시 `automationLogs` 문서가 추가되는지 확인
  - [ ] 스케줄 실행 후 `transactions` 서브컬렉션에 `status=pending` 거래 문서가 생성되는지 확인
  - [ ] 잔액 부족 시 `alerts` 또는 `automationAlerts`에 `insufficient-balance` 경고가 남는지 확인
  - [ ] `automationBalances` 항목에서 통화별 잔액이 차감되고 음수 값이 허용되지 않는지 확인
  - [ ] 실패한 거래에 대해 `status=failed` 업데이트 및 에러 로그가 남는지 확인
  - [ ] 시장 구분(US/KR)에 따라 해당 스케줄만 실행되는지 확인 (`resolveMarketWindow`)
  - [ ] 재실행 시 중복 거래 생성 없이 기존 `pending` 항목을 활용하는지 확인

- [ ] **Sell Alert Banner**
  - [ ] 매도 조건 충족 후 Firestore `sellAlerts`에 문서 생성
  - [ ] 대시보드에서 배너 노출 및 닫기(PATCH) 동작 확인

- [ ] **Balance Dashboard**
  - [ ] USD 카드에 환율/전일 대비 퍼센트가 노출되는지 확인

- [ ] **Portfolio Overview**
  - [ ] 통화 토글(KRW/USD) 전환 시 합산 값과 테이블 금액이 따라 변경
  - [ ] 모바일 카드가 `종목/수량/평가금/손익` 정보만 표시하는지 확인
  - [ ] `priceSource=cached` 포지션에 대해 "캐시 시세" 배지가 표시되는지 확인
  - [ ] 캐시 사용 알림(Alert)이 표시되고 최종 업데이트 시간이 노출되는지 확인

- [ ] **Analysis Page**
  - [ ] "오늘의 한 줄 요약" 카드는 분석 데이터 로드 후 노출
  - [ ] Glossary 아이콘 클릭 시 팝오버가 맞는 설명을 노출
  - [ ] Guided Tour가 최초 1회만 실행되고 Skip 시 localStorage에 상태 저장
  - [ ] Learning Progress 체크박스 상태가 새로고침 후에도 유지
  - [ ] Alert Preference 폼 값이 로컬 스토리지에 저장되는지 확인
  - [ ] MultiStockChart 하이라이트 선택 시 해당 라인 두께 증가 및 나머지 라인 투명도 감소
  - [ ] BenchmarkComparison 카드에 KOSPI/S&P500/60-40 수익률이 로드되고 비교 결과가 올바르게 표시되는지 확인
  - [ ] PeriodPerformanceTabs 탭 전환 시 각 기간 데이터(총수익, 연환산, 변동성)가 갱신되는지 확인
  - [ ] AIActionItems가 우선순위·카테고리별로 렌더링되고 분할 실행 권장 문구가 포함되는지 확인
  - [ ] PersonalizedDashboard에서 리스크 프로필 변경 시 추천 위젯/액션이 즉시 갱신되는지 확인
  - [ ] ScenarioAnalysis 카드에서 프리셋 전환 후 "시나리오 실행" 버튼이 projected 결과를 업데이트하는지 확인
  - [ ] TaxOptimization 카드에서 입력한 목표 금액/세율이 결과 요약과 후보 종목에 반영되는지 확인

- [ ] **Rebalancing Simulator**
  - [ ] 설명/체크리스트 문구 노출
  - [ ] 시뮬레이션 실행 시 `executionPlan` 노트에 수수료/현금 흐름이 포함되는지 확인
  - [ ] 프리셋 드롭다운(균등/현재/AI/안정형/공격형) 적용 시 목표 비중이 예상대로 변동하는지 확인
  - [ ] 결과 리스트에서 각 액션의 `estimatedFee`, `estimatedTax`, `netAmount`가 계산되는지 확인
  - [ ] "분할 실행 권장" 문구가 액션별로 노출되고 합계 섹션에 총 비용이 집계되는지 확인

- [ ] **Smart Alerts**
  - [ ] 동일 조건의 알림이 여러 개 발생해도 중복 제거(`dedupeKey`)가 동작하는지 확인
  - [ ] 알림 목록이 우선순위 점수에 따라 정렬되는지 확인
  - [ ] `meta.counts`와 `highestSeverity`가 API 응답 및 UI에서 일치하는지 확인

- [ ] **Price Cache & Fallback**
  - [ ] AlphaVantage 호출 실패 시 캐시에서 가격을 읽어오는지 확인
  - [ ] 캐시 만료(`expireAt`)가 지난 경우 API 재호출이 트리거되는지 확인
  - [ ] 캐시 쓰기 후 Firestore에 `priceCache/{cacheKey}` 문서가 생성되는지 확인

