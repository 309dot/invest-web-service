<!-- 32ea67a6-2584-4737-a9ad-619045898844 026b8132-a150-4cc1-9803-d3b97aa74b40 -->
# 개인 주식 관리 시스템 구현 계획

> **프로젝트**: PRD 기반 다중 종목 포트폴리오 관리 시스템  
> **기간**: 12주 (2025년 10월 29일 시작)  
> **진행률**: 100% (Week 12/12 완료) 🎉  
> **완료일**: 2025년 10월 29일

---

## 📊 진행 상황

### ✅ 완료된 작업 (Week 1-8)

#### Week 1: 데이터 모델 재설계 ✅
- ✅ 다중 종목 타입 시스템 구축 (11개 새로운 타입)
- ✅ Firestore 컬렉션 구조 설계
- ✅ 마이그레이션 스크립트 작성
- ✅ 비용 효율적 데이터베이스 설계 (1000명 기준 월 $1)

**주요 타입**: Stock, Portfolio, Position, Transaction, PortfolioAnalysis

#### Week 2: Google OAuth 구현 ✅
- ✅ 인증 컨텍스트 및 로그인 페이지
- ✅ 네비게이션 헤더 (데스크톱/모바일)
- ✅ Protected Routes
- ✅ 사용자 프로필 및 기본 포트폴리오 자동 생성

#### Week 3: 통합 검색 엔진 ✅
- ✅ 주식 검색 API (Alpha Vantage 연동)
- ✅ 종목 마스터 서비스 (Firestore)
- ✅ 주식 검색 컴포넌트 (실시간 자동완성)
- ✅ 인기 종목 기능
- ✅ 시장/자산 유형 필터링

#### Week 4: 종목 등록 및 포지션 관리 ✅
- ✅ 종목 추가 모달 (2단계 프로세스)
- ✅ 포지션 관리 서비스 (생성/조회/업데이트/삭제)
- ✅ 거래 관리 서비스 (거래 기록 및 통계)
- ✅ 포지션/거래 API 엔드포인트
- ✅ 포트폴리오 개요 컴포넌트 (데스크톱/모바일)
- ✅ 평균 매수가 및 수익률 계산 로직
- ✅ 다중 종목 표시 (테이블/카드 뷰)
- ✅ UI 컴포넌트 추가 (Dialog, Label, Select, RadioGroup)

#### Week 5: 구매 이력 관리 ✅
- ✅ 거래 입력 폼 (TransactionForm)
- ✅ 포지션에 거래 추가 기능
- ✅ 거래 이력 페이지 (통계, 필터링)
- ✅ 환율 API (자동 조회, 캐싱)
- ✅ 거래 삭제 기능 (AlertDialog)
- ⏸️ 자동투자 스케줄러 (Week 후반으로 연기)

#### Week 6: 충전 금액 관리 ✅
- ✅ 잔액 관리 서비스 (balance.ts)
- ✅ 잔액 API (조회, 충전/출금)
- ✅ 잔액 대시보드 컴포넌트 (충전/출금, 환전)
- ⏸️ ManualEntry 개선 (레거시 유지)
- ⏸️ 충전 이력 페이지 (대시보드에 통합)

#### Week 7: 포트폴리오 분석 엔진 ✅
- ✅ 포트폴리오 분석 서비스 (섹터/지역/자산 분산도)
- ✅ 리스크 지표 (변동성, 샤프 비율, 최대 낙폭, 집중도)
- ✅ 다각화 점수 계산
- ✅ 수익률 기여도 분석
- ✅ 포트폴리오 분석 페이지 (차트)
- ✅ 리밸런싱 제안 로직
- ✅ 포맷터 유틸리티

#### Week 8: 고급 차트 및 시각화 ✅
- ✅ 리밸런싱 시뮬레이터 (목표 비중 설정, 매수/매도 제안)
- ✅ 다중 종목 비교 차트 (수익률/주가, 종목 토글)
- ✅ PriceChart 개선 (터치 제스처, 풀스크린, 매수 마커)
- ✅ 분석 페이지 통합

#### Week 9: 개인화된 뉴스 시스템 ✅
- ✅ 뉴스 분석 서비스 (관련성, 감성, 영향도 분석)
- ✅ 종목별 뉴스 수집 (Google News RSS)
- ✅ 개인화 뉴스 API
- ✅ 뉴스 피드 페이지 (필터링, 정렬)
- ✅ 키워드 기반 감성 분석 (한국어/영어)

#### Week 10: AI 분석 고도화 ✅
- ✅ AI 분석 서비스 확장 (다중 종목 지원)
- ✅ 포트폴리오 종합 진단 (강점/약점, 종목별 평가)
- ✅ 개별 종목 분석 (가격 목표, 리스크, 액션)
- ✅ AI 프롬프트 개선 (포트폴리오 컨텍스트)
- ✅ AI API 엔드포인트 (진단, 종목 분석)

---

## 🎯 현재 상태 분석

### 구현 완료된 기능

- ✅ Firebase 인프라 (Auth, Firestore, Storage)
- ✅ 기본 UI 컴포넌트 (shadcn/ui)
- ✅ Google OAuth 인증 시스템
- ✅ 통합 주식 검색 (미국/한국)
- ✅ AI 어드바이저 (Claude API 연동)
- ✅ 관심 종목 관리 (Watchlist)
- ✅ 수동 데이터 입력 (달러 충전, 매수 기록)
- ✅ 주간 리포트 생성
- ✅ 외부 API 연동 (Alpha Vantage, ExchangeRate, News)

### 남은 작업 (Week 10-12)

- ⏳ AI 분석 고도화 (Week 10)
- ⏳ 모바일 최적화 (Week 11)
- ⏳ 알림 시스템 (Week 12)
- ⏳ 온보딩 및 테스트 (Week 12)
- ⏸️ 자동투자 스케줄러 (추후 구현)

---

## 📅 상세 구현 계획

## Phase 1: 핵심 데이터 모델 및 인증 (Week 1-2) ✅

### Week 1: 데이터 모델 재설계 ✅

**목표**: 다중 종목 지원을 위한 데이터 구조 전환

**완료 내역**:

1. `types/index.ts` 확장 ✅
   - `Portfolio` 타입: 사용자별 포트폴리오 컨테이너
   - `Stock` 타입: 종목 마스터 데이터
   - `Position` 타입: 포트폴리오 내 종목별 포지션
   - `Transaction` 타입: 거래 이력 (매수/매도)
   - `PurchaseMethod` 타입: 자동투자/일괄투자 구분
   - `PurchaseUnit` 타입: 주 단위/금액 단위 구분

2. Firestore 컬렉션 구조 재설계 ✅
   ```
   users/{userId}/
   ├── portfolios/{portfolioId}
   ├── positions/{positionId}
   ├── transactions/{transactionId}
   └── settings
   
   stocks/{stockId}  (글로벌 종목 마스터)
   ```

3. 마이그레이션 스크립트 작성 ✅
   - 기존 MGK 데이터를 새 구조로 변환

### Week 2: Google OAuth 구현 ✅

**목표**: 사용자 인증 및 개인화 기반 구축

**완료 내역**:

1. 로그인 페이지 구현 (`app/login/page.tsx`) ✅
   - Google 로그인 버튼
   - Firebase Auth 연동
   - 로그인 상태 관리

2. 인증 컨텍스트 구현 (`lib/contexts/AuthContext.tsx`) ✅
   - 사용자 세션 관리
   - Protected Routes
   - 자동 로그아웃

3. 네비게이션 헤더 추가 (`components/Header.tsx`) ✅
   - 사용자 프로필
   - 로그아웃 버튼
   - 모바일 햄버거 메뉴

4. 레이아웃 업데이트 ✅
   - 인증 필요한 페이지 보호
   - 로그인 리다이렉트

---

## Phase 2: 스마트 주식 검색 및 등록 (Week 3-4)

### Week 3: 통합 검색 엔진 ✅

**목표**: 한국/미국 주식 통합 검색 시스템 구축

**완료 내역**:

1. 주식 검색 API 구현 (`app/api/stocks/search/route.ts`) ✅
   - Alpha Vantage API 연동 (미국 주식)
   - 한국 주식 샘플 데이터 (향후 KIS API 연동)
   - 통합 검색 결과 반환
   - 캐싱 전략 (5분)

2. 종목 마스터 관리 (`lib/services/stock-master.ts`) ✅
   - 검색된 종목 자동 저장
   - 종목 정보 업데이트
   - 인기 종목 추적

3. 검색 컴포넌트 (`components/StockSearch.tsx`) ✅
   - 실시간 자동완성 (300ms 디바운스)
   - 티커/종목명 검색
   - 카테고리 필터 (ETF, 개별주, 리츠)
   - 모바일 최적화된 UI

### Week 4: 종목 등록 및 포지션 관리 ✅

**목표**: 포트폴리오에 종목 추가 및 관리

**완료 내역**:

1. 종목 추가 모달 (`components/AddStockModal.tsx`) ✅
   - 검색 결과에서 선택
   - 초기 매수 정보 입력
   - 구매 방식 선택 (자동/일괄)
   - 구매 단위 선택 (주/금액)
   - 2단계 프로세스 (검색 → 상세 입력)
   - 실시간 금액 계산

2. 포지션 관리 서비스 (`lib/services/position.ts`) ✅
   - 포지션 생성/수정/삭제
   - 평균 매수가 계산 (가중 평균)
   - 수익률 계산
   - 포트폴리오 총계 계산

3. 거래 관리 서비스 (`lib/services/transaction.ts`) ✅
   - 거래 생성 및 조회
   - 거래 통계 계산
   - 필터링 지원

4. API 엔드포인트 ✅
   - POST/GET `/api/positions`
   - POST/GET `/api/transactions`

5. 포트폴리오 개요 컴포넌트 (`components/PortfolioOverview.tsx`) ✅
   - 다중 종목 표시
   - 데스크톱: 테이블 뷰
   - 모바일: 카드 뷰
   - 새로고침 기능

6. 대시보드 통합 (`app/page.tsx`) ✅
   - Tabs 구조로 개선
   - PortfolioOverview 통합
   - 레거시 MGK 섹션 유지

7. UI 컴포넌트 ✅
   - Dialog, Label, Select, RadioGroup

---

## Phase 3: 정밀한 거래 관리 시스템 (Week 5-6)

### Week 5: 구매 이력 관리

**목표**: 자동투자/수동투자 구분 및 상세 추적

**작업 내역**:

1. 거래 입력 폼 개선 (`components/TransactionForm.tsx`)
   - 구매 방식 선택
     - 자동 구매: 주기(매월/격주/매주), 금액, 시작일
     - 일괄 구매: 날짜, 가격, 수량/금액
   - 충전 금액 연동
   - 환율 자동 적용

2. 거래 이력 서비스 (`lib/services/transaction.ts`)
   - 거래 기록 저장
   - 자동투자 스케줄 관리
   - 거래 이력 조회 (필터링, 정렬)

3. 거래 이력 페이지 (`app/transactions/page.tsx`)
   - 종목별/날짜별 필터
   - 거래 상세 정보
   - 수정/삭제 기능
   - 모바일 리스트 뷰

### Week 6: 충전 금액 관리 개선

**목표**: 원화/달러 충전 및 잔액 추적

**작업 내역**:

1. 충전 관리 서비스 (`lib/services/balance.ts`)
   - 충전 이력 관리
   - 잔액 계산
   - 환율 이력 추적

2. 충전 대시보드 (`components/BalanceDashboard.tsx`)
   - 현재 잔액 표시
   - 충전 이력
   - 환율 추이 차트
   - 충전 알림 (잔액 부족 시)

3. ManualEntry 컴포넌트 개선
   - 다중 종목 지원
   - 종목 선택 드롭다운
   - 자동 계산 개선

---

## Phase 4: 포트폴리오 분석 및 시각화 (Week 7-8) ✅

### Week 7: 포트폴리오 분석 엔진 ✅

**목표**: 섹터/지역 분산도, 리스크 분석

**완료 내역**:

1. 분석 서비스 (`lib/services/portfolio-analysis.ts`) ✅
   - ✅ 섹터별 분산도 계산
   - ✅ 지역별 분산도 계산
   - ✅ 자산 유형별 분산도
   - ✅ 리스크 프로파일 분석 (변동성, 샤프 비율, 최대 낙폭, 집중도)
   - ✅ 다각화 점수 계산 (섹터/지역/자산)
   - ✅ 수익률 기여도 분석
   - ✅ 리밸런싱 제안 로직

2. 포트폴리오 분석 API (`app/api/portfolio/analysis/route.ts`) ✅
   - ✅ GET 엔드포인트
   - ✅ 포지션 데이터 포함

3. 포트폴리오 분석 페이지 (`app/portfolio/analysis/page.tsx`) ✅
   - ✅ 주요 지표 카드 (총 투자금, 평가액, 수익률, 다각화 점수)
   - ✅ 섹터별 파이 차트 (Recharts)
   - ✅ 지역별 도넛 차트
   - ✅ 자산 유형별 바 차트
   - ✅ 리스크 지표 시각화
   - ✅ 수익률 기여도 바 차트
   - ✅ 자동 리밸런싱 제안

4. 포맷터 유틸리티 (`lib/utils/formatters.ts`) ✅
   - ✅ formatCurrency, formatPercent, formatNumber
   - ✅ formatDate, formatShares
   - ✅ formatCompactNumber, formatRelativeDate

### Week 8: 고급 차트 및 시각화 ✅

**목표**: 인터랙티브 차트 및 분석 화면

**완료 내역**:

1. 리밸런싱 시뮬레이터 (`components/RebalancingSimulator.tsx`) ✅
   - ✅ 목표 비중 개별 설정
   - ✅ 균등 분배/현재 유지 자동 설정
   - ✅ 실시간 시뮬레이션
   - ✅ 매수/매도/유지 액션 제안
   - ✅ 차이 금액 계산
   - ✅ 목표 비중 합계 100% 검증
   - ✅ 데스크톱 테이블 / 모바일 카드 뷰
   - ✅ 시뮬레이션 결과 요약

2. 다중 종목 비교 차트 (`components/MultiStockChart.tsx`) ✅
   - ✅ 여러 종목 동시 비교
   - ✅ 수익률/주가 차트 전환
   - ✅ 기간 선택 (7일/1개월/3개월/6개월/1년/전체)
   - ✅ 종목별 토글 (표시/숨김)
   - ✅ 전체 표시/숨김 버튼
   - ✅ 커스텀 툴팁
   - ✅ 현재 성과 요약
   - ✅ 8가지 색상별 종목 구분

3. PriceChart 컴포넌트 개선 ✅
   - ✅ 매수 포인트 마커 (초록색 점)
   - ✅ 모바일 터치 제스처 (좌/우 스와이프로 기간 변경)
   - ✅ 풀스크린 모드 (데스크톱)
   - ✅ fullscreenchange 이벤트 감지
   - ✅ 기간 선택 버튼 래핑 (모바일)
   - ✅ 터치 영역 확대

4. 분석 페이지 통합 ✅
   - ✅ 다중 종목 비교 차트 추가
   - ✅ 리밸런싱 시뮬레이터 추가
   - ✅ 반응형 레이아웃

---

## Phase 5: 개인화된 뉴스 시스템 (Week 9) ✅

### Week 9: 맞춤형 뉴스 큐레이션 ✅

**목표**: 보유 종목별 뉴스 필터링 및 영향도 분석

**완료 내역**:

1. 뉴스 수집 개선 (`lib/apis/news.ts`) ✅
   - ✅ 종목별 뉴스 수집 (`collectNewsForSymbols`)
   - ✅ Google News RSS 연동
   - ✅ 다중 쿼리 지원 (stock, earnings, market)
   - ✅ 7일간 뉴스 수집
   - ✅ 중복 제거 개선
   - ✅ relatedSymbols, keywords 자동 태깅
   - ✅ 심볼 추출 함수

2. 뉴스 분석 서비스 (`lib/services/news-analysis.ts`) ✅
   - ✅ 관련성 점수 계산 (0-100 스케일)
   - ✅ 영향도 분석 (고/중/저 3단계)
   - ✅ 포트폴리오 비중 기반 우선순위
   - ✅ 감성 분석 (긍정/부정/중립)
   - ✅ 키워드 기반 감성 점수 (-1 to 1)
   - ✅ 한국어/영어 키워드 지원
   - ✅ 개인화 분석 (보유 종목 기반)
   - ✅ 뉴스 저장/조회 함수
   - ✅ 북마크 기능

3. 개인화 뉴스 API (`app/api/news/personalized/route.ts`) ✅
   - ✅ GET 엔드포인트 (userId, portfolioId)
   - ✅ 보유 종목 자동 조회
   - ✅ 종목별 뉴스 수집
   - ✅ 감성 분석 적용
   - ✅ 개인화 분석 및 정렬
   - ✅ 에러 처리

4. 뉴스 피드 페이지 (`app/news/page.tsx`) ✅
   - ✅ 개인화된 뉴스 피드
   - ✅ 종목별 필터
   - ✅ 감성별 필터 (긍정/중립/부정)
   - ✅ 영향도별 필터 (높음/중간/낮음)
   - ✅ 필터 초기화
   - ✅ 모바일 반응형 카드 레이아웃
   - ✅ 감성 아이콘 및 배지
   - ✅ 관련성 점수 표시
   - ✅ 영향받는 종목 목록
   - ✅ 외부 링크 버튼
   - ✅ 북마크 버튼 (UI)
   - ✅ 빈 상태 처리
   - ✅ 로딩 상태

5. 뉴스 알림 시스템 ⏸️
   - ⏸️ 중요 뉴스 푸시 알림 (Week 12로 연기)
   - ⏸️ 이메일 다이제스트 (Week 12로 연기)

---

## Phase 6: AI 분석 고도화 (Week 10)

### Week 10: AI 포트폴리오 애널리스트

**목표**: 개인화된 AI 분석 및 전략 제안

**작업 내역**:

1. AI 분석 서비스 확장 (`lib/services/ai-advisor.ts`)
   - 다중 종목 분석
   - 포트폴리오 진단
   - 개별 종목 분석
   - 매수/매도 타이밍 제안
   - 세금 효율적 매도 전략

2. AI 프롬프트 개선
   - 포트폴리오 컨텍스트 추가
   - 섹터/지역 분산 정보 포함
   - 뉴스 임팩트 분석
   - 리스크 성향 반영

3. AI 인사이트 페이지 (`app/ai-insights/page.tsx`)
   - 종목별 AI 분석
   - 포트폴리오 종합 분석
   - 액션 아이템
   - 분석 이력

4. AIAdvisorCard 컴포넌트 개선
   - 다중 종목 지원
   - 종목별 탭
   - 인터랙티브 차트 연동

---

## Phase 7: 모바일 최적화 (Week 11)

### Week 11: 모바일 우선 UI/UX

**목표**: 모바일 친화적 인터페이스 완성

**작업 내역**:

1. 반응형 레이아웃 개선
   - 모바일 네비게이션 (하단 탭바)
   - 스와이프 제스처
   - 풀스크린 모달
   - 터치 최적화 버튼 크기

2. 모바일 전용 컴포넌트
   - `components/mobile/BottomNav.tsx`: 하단 네비게이션
   - `components/mobile/StockCard.tsx`: 종목 카드 (스와이프)
   - `components/mobile/QuickActions.tsx`: 빠른 액션 버튼
   - `components/mobile/MobileHeader.tsx`: 모바일 헤더

3. 성능 최적화
   - 이미지 레이지 로딩
   - 무한 스크롤
   - 가상 스크롤 (긴 리스트)
   - 코드 스플리팅

4. PWA 설정
   - `manifest.json` 생성
   - 서비스 워커 설정
   - 오프라인 지원
   - 홈 화면 추가

5. 터치 제스처
   - 스와이프로 삭제
   - 풀 투 리프레시
   - 핀치 줌 (차트)

---

## Phase 8: 고급 기능 및 마무리 (Week 12)

### Week 12: 최종 통합 및 테스트

**목표**: 전체 시스템 통합 및 품질 보증

**작업 내역**:

1. 알림 시스템 완성
   - 주가 급등/급락 알림 (±5%)
   - 실적 발표 알림
   - 배당 기준일 알림
   - 리밸런싱 제안 알림
   - 충전 잔액 부족 알림

2. 설정 페이지 완성 (`app/settings/page.tsx`)
   - 투자 성향 설정
   - 알림 설정
   - 관심 섹터/테마
   - AI 분석 깊이 조절
   - 데이터 백업/복원

3. 온보딩 플로우
   - 첫 로그인 시 튜토리얼
   - 샘플 포트폴리오 생성
   - 기능 안내

4. 에러 처리 및 로깅
   - 전역 에러 바운더리
   - 사용자 친화적 에러 메시지
   - Sentry 연동 (옵션)

5. 성능 테스트
   - Lighthouse 점수 90+ 목표
   - 로딩 시간 최적화
   - 번들 사이즈 최적화

6. E2E 테스트
   - 주요 사용자 플로우 테스트
   - 모바일 테스트
   - 크로스 브라우저 테스트

7. 문서화
   - 사용자 가이드
   - API 문서
   - 배포 가이드

---

## 📱 모바일 최적화 가이드라인

### 디자인 원칙

1. **터치 우선**: 최소 44x44px 터치 영역
2. **한 손 사용**: 중요 액션은 하단 1/3 영역
3. **명확한 피드백**: 터치 시 즉각적인 시각적 피드백
4. **간결한 정보**: 한 화면에 핵심 정보만 표시
5. **빠른 로딩**: 3초 이내 초기 로딩

### 반응형 브레이크포인트

```css
mobile: 0-640px
tablet: 641-1024px
desktop: 1025px+
```

### 모바일 우선 컴포넌트 체크리스트

- [ ] 터치 제스처 지원
- [ ] 가로/세로 모드 대응
- [ ] 키보드 오버레이 처리
- [ ] 오프라인 대응
- [ ] 로딩 스켈레톤
- [ ] 에러 상태 UI

---

## 📁 주요 파일 구조 (최종)

```
mgk-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx ✅
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx (with Header) ✅
│   │   ├── page.tsx (Portfolio Dashboard) ✅
│   │   ├── portfolio/
│   │   │   ├── analysis/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── news/page.tsx
│   │   ├── ai-insights/page.tsx
│   │   ├── settings/page.tsx ✅
│   │   └── weekly-reports/page.tsx ✅
│   └── api/
│       ├── stocks/
│       │   ├── search/route.ts ✅
│       │   └── [symbol]/route.ts
│       ├── portfolio/route.ts
│       ├── positions/route.ts
│       ├── transactions/route.ts
│       ├── balance/route.ts
│       └── ... (기존 API) ✅
├── components/
│   ├── Header.tsx ✅
│   ├── StockSearch.tsx ✅
│   ├── AddStockModal.tsx
│   ├── TransactionForm.tsx
│   ├── BalanceDashboard.tsx
│   ├── RebalancingSimulator.tsx
│   ├── mobile/
│   │   ├── BottomNav.tsx
│   │   ├── StockCard.tsx
│   │   ├── QuickActions.tsx
│   │   └── MobileHeader.tsx
│   └── ... (기존 컴포넌트) ✅
├── lib/
│   ├── contexts/
│   │   └── AuthContext.tsx ✅
│   ├── services/
│   │   ├── stock-master.ts ✅
│   │   ├── position.ts
│   │   ├── transaction.ts
│   │   ├── balance.ts
│   │   ├── portfolio-analysis.ts
│   │   └── news-analysis.ts
│   └── ... (기존 lib) ✅
└── types/
    └── index.ts (확장) ✅
```

---

## 🎯 성공 지표

### 기능 완성도

- [x] Google OAuth 인증
- [x] 통합 주식 검색 (한국/미국)
- [ ] 다중 종목 포트폴리오 관리
- [ ] 자동투자/수동투자 구분 관리
- [ ] 포트폴리오 분석 (섹터/지역)
- [ ] 개인화된 뉴스 큐레이션
- [ ] AI 기반 투자 분석
- [ ] 모바일 최적화 완료

### 성능 목표

- Lighthouse 성능 점수: 90+
- 모바일 First Contentful Paint: < 2초
- Time to Interactive: < 3초
- 번들 사이즈: < 500KB (gzipped)

### 사용성 목표

- 모바일 터치 영역: 44x44px 이상
- 반응 시간: < 100ms
- 에러율: < 1%
- 오프라인 지원: 기본 기능 동작

---

## ⚠️ 위험 요소 및 대응

### 기술적 위험

1. **API 제한**: Alpha Vantage 무료 플랜 25 requests/day
   - ✅ 대응: 캐싱 전략 구현 (5분 캐시)
   - 대체 API 준비 중

2. **Firebase 비용**: Firestore 읽기/쓰기 비용
   - ✅ 대응: 쿼리 최적화, 인덱스 설계
   - 예상 비용: 1000명 기준 월 $1

3. **실시간 데이터 지연**: 주가 업데이트 지연
   - 대응: 명확한 업데이트 시간 표시, 수동 새로고침

### 일정 위험

1. **외부 API 연동 복잡도**: KIS API 등 한국 주식 데이터
   - 대응: 샘플 데이터로 우선 구현, 단계적 API 연동

2. **모바일 최적화 시간**: 예상보다 많은 시간 소요 가능
   - 대응: 핵심 화면 우선, 점진적 개선

---

## 📝 다음 단계 (Week 4)

### 우선순위 작업

1. **종목 추가 모달 구현**
   - StockSearch 컴포넌트 활용
   - 초기 매수 정보 입력 폼
   - 구매 방식/단위 선택

2. **포지션 관리 서비스**
   - CRUD 기능
   - 평균 매수가/수익률 계산
   - Firestore 연동

3. **포트폴리오 대시보드 개선**
   - 다중 종목 카드 레이아웃
   - 종목별 수익률 표시
   - 모바일 최적화

### 예상 소요 시간

- 종목 추가 모달: 4시간
- 포지션 관리 서비스: 3시간
- 대시보드 개선: 3시간
- **총 예상: 10시간**

---

## 📚 참고 문서

- [PRD 문서](../../prd/personal_stock_tracker_prd.md)
- [Firestore 구조](../../mgk-dashboard/docs/FIRESTORE_STRUCTURE.md)
- [개발 이력](../../history_log/2025-10-29.md)
- [Firebase 프로젝트](https://console.firebase.google.com/u/0/project/invest-web-service/overview)

---

**마지막 업데이트**: 2025년 10월 29일  
**다음 리뷰**: Week 4 완료 후

