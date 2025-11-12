- [ ] 잔액 차감 및 부족 알림 기능 추가
  - 매수/매도 시 원화/달러 잔액 업데이트 처리 (BalanceDashboard 연동)
  - 거래 생성 서비스에서 통화별 잔액 차감/증가 로직 구현 (Firestore balance 컬렉션)
  - 잔액 부족 시 이메일 알림 트리거 및 알림 한도(Threshold) 저장
  - 관련 QA 케이스 작성 (한국/미국 종목)
- [ ] 매도 타이밍 알림 기능 설계
  - 포지션 상세 페이지에 목표 수익률/매도 비율 입력 UI 추가
  - 백엔드에서 목표 도달 이벤트 감지 및 알림 발송 로직 구현
- [ ] 수익률/손익 불일치 원인 분석 보고
  - 실제 브로커리지 데이터와 시스템 데이터 비교, 환율/가격 소스 검증
  - 발견된 문제를 History Log 및 QA 문서에 기록
- [ ] 거래 이력 체결 시간 표시
  - `transactions` 컬렉션에 시간 정보 저장/표시
  - UI에서 날짜+시간 포맷으로 렌더링
- [ ] 리밸런싱 계산 KRW 기준 통일
  - 리밸런싱 시뮬레이터/자동 제안 계산을 KRW 기준으로 수행 후 원 통화 표시
  - 환율 불러오기 및 처리 로직 정리
# 🧩 개인 주식 관리 시스템 QA 및 개선 Task 목록

## Task 1. 데이터 로직 일관성 검증 및 수정
**문제 요약:**  
- 대시보드와 거래 이력 페이지의 통화 단위 및 계산 로직 불일치.  
- 통화 변환(USD ↔ KRW), 합산 로직, 평균 단가 계산이 다르게 표시됨.

**세부 확인사항:**
1. 대시보드 USD 자산 총합 `$890.14` vs 거래 이력 매수 총액 `$914,439.57` 불일치  
2. 환율이 고정값(`1달러 = 1,428.91원`)으로 유지되어 실시간 반영 불가  
3. 원화 종목(069500)이 `$` 단위로 표시됨 → 통화 구분 누락

**개선 제안:**
- [ ] `/api/dashboard`와 `/api/transactions`의 통화 변환 로직 통합  
- [ ] `currency` 필드 명시 (`USD` | `KRW`)  
- [ ] 실시간 환율 API 적용 및 캐싱  
- [ ] `toLocaleString` 통화 단위 일관성 유지  

---

## Task 2. GPT-oss API 검증 및 인사이트 생성 문제
**문제 요약:**  
- AI 어드바이저(베타) 기능이 GPT-oss API 키 미설정으로 동작 중단.  
- “지금 생성” 클릭 시 분석 결과 없음 → API 호출 실패.

**개선 제안:**
- [ ] `.env` 환경 변수 `GPT_OSS_API_KEY` 설정 검증 추가
  ```js
  if (!process.env.GPT_OSS_API_KEY) {
    throw new Error("Missing GPT_OSS_API_KEY environment variable");
  }
  ```
- [ ] API 에러 메시지 UI 노출 (“API 연결 실패: 인증 토큰 없음”)  
- [ ] GPT 응답 데이터 구조 명확화 및 시각화 예시:
  ```json
  {
    "summary": "이번 주 NVDA는 3% 상승, BRK-B는 안정적 흐름",
    "recommendations": [
      {"ticker": "MGK", "action": "hold", "reason": "대형 성장주 장기 모멘텀 유지"},
      {"ticker": "NVDA", "action": "buy", "reason": "AI 반도체 섹터 강세 지속"}
    ],
    "riskScore": 0.27
  }
  ```

---

## Task 3. 포트폴리오 분석 화면 개선
**문제 요약:**  
- 분석 탭이 단순 수익률 요약 수준으로, 전문가형 분석 미비.

**개선 제안:**
- [ ] GPT 응답 기반 시각화 구성 (리스크-리턴, 섹터 비중 차트 등)  
- [ ] 주요 지표 추가: 변동성(Volatility), 샤프 지수(Sharpe Ratio), 집중도 등  
- [ ] `/api/analysis` 호출 자동화 및 캐시 표시  
- [ ] “AI 분석 다시 생성” 버튼 추가  

**UI 구조 예시:**
```tsx
<PortfolioAnalysis>
  <RiskSection />
  <SectorDistributionChart />
  <GPTSummaryCard />
  <RecommendationList />
</PortfolioAnalysis>
```

---

## Task 4. QA 자동 검증 스크립트 (추천)
**목표:** 대시보드와 거래 이력 데이터 일관성 자동 검증  

**도구:** Playwright 또는 Jest

```js
test('Dashboard and Transactions consistency', async () => {
  const dashboard = await fetch('/api/dashboard').then(r => r.json());
  const transactions = await fetch('/api/transactions').then(r => r.json());
  
  expect(dashboard.totalUSDInvested).toBeCloseTo(
    sum(transactions.filter(t => t.currency === 'USD').map(t => t.amount)),
    2
  );
});
```

---

## 요약
| Task | 핵심 문제 | 개선 방향 |
|------|------------|------------|
| 1 | 데이터/통화 불일치 | API 일원화 + 환율 반영 로직 개선 |
| 2 | GPT-oss API 미작동 | 환경 변수 확인 + 에러 핸들링 강화 |
| 3 | 분석 화면 단순함 | GPT 응답 기반 시각화 및 전문가형 분석 추가 |
| 4 | QA 자동화 | Jest/Playwright 기반 검증 스크립트 추가 |
