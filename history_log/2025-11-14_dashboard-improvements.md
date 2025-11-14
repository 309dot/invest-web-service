# 2025-11-14 Dashboard & Analysis 개선 작업 내역

## 개요
- 초보 투자자용 분석 화면 개선 PRD v2.0 구현
- 자동 구매/알림 흐름 안정화 및 대시보드 카드 재구성
- 학습/가이드 시스템, 게이미피케이션 기능 추가

## 주요 변경 사항
1. **네비게이션 및 페이지 정리**
   - 거래 이력/뉴스 페이지 제거, 종목 상세 페이지에 뉴스 카드 추가
   - 주간 리포트 모달(`WeeklyReportModal`) 추가 및 헤더 링크 정리
   - 대시보드에 `SellAlertBanner` 삽입, AI Advisor 제거

2. **자동 구매 & 잔액 로직**
   - `autoInvestExecutor` 로직 개선: 드라이런, 잔액 로그, `automationLogs` 기록
   - Vercel Cron(`/api/internal/auto-invest/cron`) + 테스트 엔드포인트(`/api/internal/test-auto-invest`) 도입
   - 잔액 카드에 USD→KRW 환율 및 전일 대비 정보 표시

3. **포트폴리오 현황**
   - `PortfolioOverview` 전면 개편: 원·달러 토글, 합산 카드, 간결한 열 구성
   - 종목 리스트는 `종목 / 수량 / 평가금 / 손익` 포맷으로 재정렬

4. **분석 페이지 Phase 1**
   - "오늘의 한 줄 요약" 카드 도입
   - 리스크 지표에 `GlossaryPopover` 적용
   - `GPTSummaryCard` 스토리텔링 레이아웃

5. **Phase 2: 학습 시스템**
   - `PortfolioGuidedTour`(react-joyride), `LearningProgress`, `AlertPreferenceCard`
   - 리밸런싱 시뮬레이터 설명/체크리스트 추가, 학습 자료 링크 카드

6. **Phase 3: 고도화**
   - 맞춤 학습 경로/배지 카드 추가
   - `MultiStockChart`에 하이라이트 선택 기능 추가

## 잔여 작업 없음

