<!-- 9209a4c3-27ee-4f08-8bf7-aa45923794ca ee93813e-c731-4764-abcc-d237bdc14c12 -->
# 투자 시스템 개선 및 자동화 구현

## Part 1: 자동 투자 실행 스케줄러 구현

### 1.1 Firebase Cloud Function - 자동 투자 실행 Job 생성

**파일**: `functions/src/jobs/executeAutoInvest.ts`

매일 한국/미국 시장 개장 시간에 실행되는 스케줄러를 생성합니다.

```typescript
// 매일 오전 9시 (KST) 실행 - 한국 시장
// 매일 오전 11시 (KST) 실행 - 미국 시장 (미국 시간 오후 9시/10시 전후)
schedule: "0 9,11 * * *"
```

**기능**:

- 모든 활성 자동 투자 스케줄 조회
- 오늘 실행될 자동 투자 거래 생성
- 잔액 확인 후 거래 실행
- 잔액 부족 시 알림 발송

### 1.2 자동 투자 거래 생성 로직 수정

**파일**: `mgk-dashboard/lib/services/auto-invest.ts`

`generateAutoInvestTransactions()` 함수를 수정하여:

- 오늘 날짜 거래만 생성하는 옵션 추가
- 거래 생성 시 즉시 잔액 차감 (KRW/USD 구분)
- 거래 상태 관리 (pending → completed)

### 1.3 Transaction 타입에 상태 필드 추가

**파일**: `mgk-dashboard/types/index.ts`

```typescript
export interface Transaction {
  // ... 기존 필드
  status?: 'pending' | 'completed' | 'failed';
  scheduledDate?: string; // 예정 거래인 경우
}
```

### 1.4 거래 이력 페이지 - 오늘 예정 거래 표시

**파일**: `mgk-dashboard/app/transactions/page.tsx`

현재 "오늘 자동 투자 일정" 섹션을 개선:

- 오늘 실행 예정인 자동 투자를 pending 상태로 거래 목록에 표시
- 실행 완료되면 completed 상태로 전환
- pending 거래는 회색/점선 스타일로 구분

## Part 2: 손익 계산 로직 개선

### 2.1 Position 계산 로직 수정

**파일**: `mgk-dashboard/lib/services/position.ts`

`recalculatePositionFromTransactions()` 함수 수정:

```typescript
// 기존: const profitLoss = currentPrice - averagePrice;
// 개선: const profitLoss = (currentPrice * shares) - (averagePrice * shares);

const totalInvested = averagePrice * shares;
const totalValue = currentPrice * shares;
const profitLoss = totalValue - totalInvested;
const returnRate = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
```

### 2.2 반올림 로직 개선

**파일**: `mgk-dashboard/lib/utils/calculations.ts`

```typescript
export function calculateReturnRate(totalValue: number, totalInvested: number): number {
  if (totalInvested === 0) return 0;
  // 소수점 4자리까지 계산 후 표시는 2자리
  return Number(((totalValue - totalInvested) / totalInvested * 100).toFixed(4));
}
```

음수가 0으로 반올림되지 않도록 수정.

### 2.3 시세 API 실패 시 캐싱된 가격 사용

**파일**: `mgk-dashboard/lib/apis/alphavantage.ts`

- Firebase에 가격 스냅샷 저장
- API 실패 시 최근 24시간 내 캐시된 가격 사용
- 캐시 사용 시 UI에 경고 표시

### 2.4 UI 컴포넌트 수정

**파일**: `mgk-dashboard/components/PositionCard.tsx`, `mgk-dashboard/app/portfolio/page.tsx`

```tsx
<span className={profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
  {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)}%
</span>
```

음수 손익률을 빨간색으로 명확히 표시.

## Part 3: 포트폴리오 분석 화면 개선 (Phase 1-4)

### Phase 1: 긴급 개선 (1-2주)

#### 3.1 섹터 정보 정확히 표시

**파일**: `mgk-dashboard/lib/services/portfolio-analysis.ts`

`calculateSectorAllocation()` 함수 개선:

- ETF의 경우 내부 구성 종목의 섹터 정보 가져오기
- GICS 11개 섹터 기준으로 분류
- "미분류" 최소화

#### 3.2 벤치마크 비교 추가

**파일**: `mgk-dashboard/components/PortfolioAnalysis/BenchmarkComparison.tsx` (신규)

```tsx
<BenchmarkCard>
  내 포트폴리오: +1.97%
  KOSPI: +8.32%
  S&P 500: +12.54%
  60/40 포트폴리오: +10.12%
</BenchmarkCard>
```

- 벤치마크 데이터 API 연동 필요
- 동일 기간 수익률 비교

#### 3.3 기간별 성과 탭 추가

**파일**: `mgk-dashboard/app/portfolio/analysis/page.tsx`

```tsx
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="1d">1일</TabsTrigger>
    <TabsTrigger value="1w">1주</TabsTrigger>
    <TabsTrigger value="1m">1개월</TabsTrigger>
    <TabsTrigger value="3m">3개월</TabsTrigger>
    <TabsTrigger value="ytd">YTD</TabsTrigger>
    <TabsTrigger value="1y">1년</TabsTrigger>
    <TabsTrigger value="all">전체</TabsTrigger>
  </TabsList>
</Tabs>
```

#### 3.4 리밸런싱 - 목표 비중 프리셋 제공

**파일**: `mgk-dashboard/components/RebalancingSimulator.tsx`

프리셋 옵션 추가:

- 균등 분산
- 현재 유지
- AI 추천 (최적화)
- 안정형
- 공격형

### Phase 2: 핵심 개선 (3-4주)

#### 3.5 AI 조언 구체화 - 실행 가능한 액션 아이템

**파일**: `mgk-dashboard/components/PortfolioAnalysis/AIActionItems.tsx` (신규)

```tsx
<ActionItem priority="urgent">
  1. 069500 비중 조절
  현재: 48.8% → 목표: 35%
  방법: $140 상당 매도
  예상 효과: 집중도 리스크 20% 감소
</ActionItem>
```

우선순위별(긴급/중요/권장) 액션 아이템 제공.

#### 3.6 리밸런싱 실행 계획 상세화

**파일**: `mgk-dashboard/components/RebalancingSimulator.tsx`

Before/After 시뮬레이션:

- 매도/매수 상세 계획
- 예상 수수료/세금 계산
- 분할 실행 옵션 (3회, 5회 등)
- 캘린더 연동

#### 3.7 종목 비교 차트 구현

**파일**: `mgk-dashboard/components/PortfolioAnalysis/StockComparisonChart.tsx` (신규)

인터랙티브 차트:

- 기간별 성과 비교 (1개월, 3개월, 6개월, 1년)
- 벤치마크 포함
- 범례 토글 기능

#### 3.8 수익 기여도 분해 분석

**파일**: `mgk-dashboard/components/PortfolioAnalysis/ContributionBreakdown.tsx` (신규)

```tsx
<ContributionItem>
  069500: +$32.15
  ├─ 비중 기여: +$18.20 (높은 비중)
  ├─ 성과 기여: +$13.95 (수익률 +4.98%)
  └─ 조언: 주요 수익원, 비중 유지
</ContributionItem>
```

#### 3.9 상관관계 히트맵

**파일**: `mgk-dashboard/components/PortfolioAnalysis/CorrelationHeatmap.tsx` (신규)

종목 간 상관관계 매트릭스:

- 최근 3개월 데이터 기반
- 색상으로 상관관계 강도 표시
- 분산 효과 분석

### Phase 3: 경험 향상 (5-8주)

#### 3.10 스마트 알림 시스템

**파일**: `mgk-dashboard/lib/services/smart-alerts.ts` (신규)

알림 우선순위:

- 긴급: 급등/급락, 손절가 도달 (즉시 푸시)
- 중요: 리밸런싱 필요 (1일 1회)
- 정보: 주간 리포트 (주간)

#### 3.11 개인화 대시보드

**파일**: `mgk-dashboard/components/PersonalizedDashboard.tsx` (신규)

투자 성향별 맞춤:

- 보수적: 안정성 지표 강조
- 공격적: 수익률 지표 강조

#### 3.12 시나리오 분석

**파일**: `mgk-dashboard/components/PortfolioAnalysis/ScenarioAnalysis.tsx` (신규)

"만약 ~한다면?" 시뮬레이션:

- 특정 종목 매도 시
- 시장 급락 시 (-10%, -20%)
- 환율 변동 시

#### 3.13 세금 최적화 도구

**파일**: `mgk-dashboard/components/TaxOptimization.tsx` (신규)

손익 상황 분석:

- 수익 종목 (과세 대상)
- 손실 종목 (세금 절감)
- 최적화 전략 제안

### Phase 4: 고급 기능 (9-12주)

#### 3.14 백테스팅 엔진

**파일**: `mgk-dashboard/lib/services/backtesting.ts` (신규)

과거 데이터로 전략 검증:

- 리밸런싱 전략 백테스트
- 자동 투자 시뮬레이션
- 결과 비교

#### 3.15 포트폴리오 최적화 알고리즘

**파일**: `mgk-dashboard/lib/services/portfolio-optimizer.ts` (신규)

현대 포트폴리오 이론(MPT) 기반:

- 효율적 프론티어 계산
- 최적 비중 제안

## Part 4: 거래 이력 UI 개선

### 4.1 요약 카드 컴포넌트

**파일**: `mgk-dashboard/components/TransactionSummaryCards.tsx` (신규)

```tsx
<SummaryCards>
  <Card title="총 매수 금액" value="$944.57" 
        sub="4.71주 / 평균 $200.70" />
  <Card title="총 매도 금액" value="$195.04" 
        sub="0.47주 / 평균 $412.69" />
  <Card title="순매수" value="-$749.52" tone="negative" />
</SummaryCards>
```

### 4.2 종목별 그룹 뷰

**파일**: `mgk-dashboard/app/transactions/page.tsx`

Accordion으로 종목별 그룹화:

```tsx
<Accordion type="multiple">
  <AccordionItem value="MGK">
    <AccordionTrigger>
      MGK (최근 30회) +7.2% 수익중
    </AccordionTrigger>
    <AccordionContent>
      {/* 거래 목록 */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 4.3 자동투자/수동거래 구분 탭

**파일**: `mgk-dashboard/app/transactions/page.tsx`

```tsx
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">전체</TabsTrigger>
    <TabsTrigger value="auto">자동 투자</TabsTrigger>
    <TabsTrigger value="manual">수동 매수/매도</TabsTrigger>
  </TabsList>
</Tabs>
```

### 4.4 거래 요약 타임라인 뷰

**파일**: `mgk-dashboard/components/TransactionTimeline.tsx` (신규)

주간/월간 요약:

```tsx
<TimelineItem>
  📆 10월 마지막 주: 5회 매수, 1회 매도 (순매수 -$120)
</TimelineItem>
```

### 4.5 금액/단가 표시 단순화

**파일**: `mgk-dashboard/components/TransactionTable.tsx`

```tsx
// 개선 전: $5.00 / $5.00 / 총 금액 $5.00
// 개선 후: 매수 0.0118주 @ $422.94 → $5.00
```

### 4.6 정보 계층화 - 클릭 시 상세

**파일**: `mgk-dashboard/components/TransactionListItem.tsx` (신규)

리스트 뷰에서는 날짜/종목/유형/금액만 표시.

클릭 시 Popover로 가격, 수수료, 메모 등 상세 정보 표시.

### 4.7 추가 기능

**파일**: `mgk-dashboard/app/transactions/page.tsx`

- 검색창 (종목명/거래유형)
- CSV 내보내기 버튼
- 주간 집계 그래프
- LocalStorage로 필터 상태 유지

## Part 5: 테스트 및 QA

### 5.1 자동 투자 테스트

**파일**: `mgk-dashboard/__tests__/auto-invest.test.ts`

- 스케줄러 실행 테스트
- 잔액 차감 검증
- 거래 생성 검증
- 에러 처리 검증

### 5.2 손익 계산 정확도 테스트

**파일**: `mgk-dashboard/__tests__/profit-calculation.test.ts`

QA 체크리스트의 모든 케이스 검증:

- 단일 매수 수익/손실
- 분할 매수 평균 단가
- 수수료 포함 계산
- 환율 포함 계산
- 엣지 케이스 (소수점, 0원, 음수, 큰 숫자)

### 5.3 E2E 테스트

**파일**: `mgk-dashboard/tests/e2e/portfolio-analysis.spec.ts`

Playwright로 전체 플로우 테스트:

- 포트폴리오 분석 페이지 진입
- 기간별 탭 전환
- 리밸런싱 시뮬레이션 실행
- 거래 이력 필터링

## Part 6: 문서화 및 히스토리 로그

### 6.1 개발 히스토리 로그 작성

**파일**: `history_log/2025-11-11_system-improvements.md`

이번 작업의 모든 변경 사항을 날짜별로 기록:

- 수정한 파일 목록
- 추가한 기능
- 버그 수정
- 테스트 결과

### 6.2 QA 체크리스트 작성

**파일**: `QA_log/checklists/auto-invest_checklist.md`

**파일**: `QA_log/checklists/portfolio-analysis_checklist.md`

**파일**: `QA_log/checklists/transaction-ui_checklist.md`

각 기능별 QA 체크리스트 작성.

### 6.3 README 업데이트

**파일**: `mgk-dashboard/README.md`

새로운 기능 섹션 추가:

- 자동 투자 스케줄러
- 포트폴리오 분석 기능
- 거래 이력 개선사항

### To-dos

- [ ] Firebase Cloud Function으로 자동 투자 실행 스케줄러 생성 (매일 9시, 11시 실행)
- [ ] 자동 투자 거래 생성 로직 수정 - 오늘 거래만 생성, 잔액 차감, 상태 관리
- [ ] Transaction 타입에 status 필드 추가 (pending/completed/failed)
- [ ] 거래 이력 페이지에 오늘 예정 거래 표시 (pending 상태)
- [ ] 손익 계산 로직 수정 - 총 투자금 기준 계산으로 변경
- [ ] 반올림 로직 개선 - 음수가 0으로 반올림되지 않도록 수정
- [ ] 시세 API 실패 시 캐싱된 가격 사용 로직 구현
- [ ] 손익 UI 컴포넌트 수정 - 음수는 빨간색으로 명확히 표시
- [ ] 섹터 정보 정확히 표시 - GICS 11개 섹터 기준, ETF 내부 구성 분석
- [ ] 벤치마크 비교 컴포넌트 추가 - KOSPI, S&P500, 60/40 포트폴리오
- [ ] 기간별 성과 탭 추가 - 1일/1주/1개월/3개월/YTD/1년/전체
- [ ] 리밸런싱 목표 비중 프리셋 제공 - 균등/현재/AI추천/안정형/공격형
- [ ] AI 조언 구체화 - 우선순위별 실행 가능한 액션 아이템
- [ ] 리밸런싱 실행 계획 상세화 - 매도/매수 상세, 수수료/세금, 분할 실행
- [ ] 종목 비교 인터랙티브 차트 구현
- [ ] 수익 기여도 분해 분석 - 비중 기여 vs 성과 기여
- [ ] 상관관계 히트맵 구현 - 종목 간 상관관계 매트릭스
- [ ] 스마트 알림 시스템 - 긴급/중요/정보 우선순위별 알림
- [ ] 개인화 대시보드 - 투자 성향별 맞춤형 UI
- [ ] 시나리오 분석 도구 - 만약 시뮬레이션
- [ ] 세금 최적화 도구 - 손익 상황 분석 및 전략 제안
- [ ] 백테스팅 엔진 - 과거 데이터로 전략 검증
- [ ] 포트폴리오 최적화 알고리즘 - MPT 기반 효율적 프론티어
- [ ] 거래 이력 요약 카드 컴포넌트 구현
- [ ] 종목별 그룹 뷰 - Accordion으로 그룹화
- [ ] 자동투자/수동거래 구분 탭 구현
- [ ] 거래 요약 타임라인 뷰 - 주간/월간 요약
- [ ] 금액/단가 표시 단순화
- [ ] 정보 계층화 - 클릭 시 Popover로 상세 정보
- [ ] 거래 이력 추가 기능 - 검색/CSV 내보내기/주간 집계/필터 유지
- [ ] 자동 투자 테스트 작성 - 스케줄러/잔액/거래 생성 검증
- [ ] 손익 계산 정확도 테스트 - QA 체크리스트 모든 케이스
- [ ] E2E 테스트 - Playwright로 전체 플로우 검증
- [ ] 개발 히스토리 로그 작성 - 2025-11-11_system-improvements.md
- [ ] QA 체크리스트 작성 - 자동투자/포트폴리오분석/거래UI
- [ ] README 업데이트 - 새로운 기능 섹션 추가