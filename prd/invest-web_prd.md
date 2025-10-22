# 🔥 MGK Dashboard - Firebase 완전 독립 시스템 PRD

## 📌 프로젝트 개요

**Google Sheets 없이 Firebase로 완전 독립적인 투자 추적 시스템**

### 핵심 기술 스택
```
Frontend: Next.js 14 + TypeScript + shadcn/ui
Backend: Firebase
├── Firestore (데이터베이스)
├── Cloud Functions (자동화)
├── Firebase Auth (선택, 나중에)
└── Firebase Hosting (배포, 선택)

외부 API:
├── Alpha Vantage (주가 데이터)
├── ExchangeRate-API (환율)
└── Google News RSS (뉴스)
```

---

## 🗄️ Firebase Firestore 데이터 구조

### Collection 1: `dailyPurchases`
```javascript
// 문서 ID: YYYY-MM-DD (예: 2024-10-20)
{
  date: "2024-10-20",
  price: 520.50,           // MGK 주가
  exchangeRate: 1340,      // 환율
  purchaseAmount: 10,      // 매수 금액 (USD)
  shares: 0.0192,          // 매수 주식 수
  totalShares: 125.5,      // 누적 주식 수
  averagePrice: 510.20,    // 평균 매수가
  totalValue: 65332.75,    // 총 평가액
  returnRate: 2.02,        // 수익률 (%)
  sellSignal: false,       // 매도 신호
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Collection 2: `dollarCharges`
```javascript
// 문서 ID: 자동 생성
{
  chargeDate: "2024-10-15",
  amount: 500,              // 충전 금액 (USD)
  exchangeRate: 1345,       // 충전 환율
  krwAmount: 672500,        // 원화 금액
  fee: 2500,                // 수수료
  totalBalance: 1500,       // 누적 잔고
  memo: "토스 충전",
  createdAt: timestamp
}
```

### Collection 3: `newsItems`
```javascript
// 문서 ID: 자동 생성
{
  collectedAt: timestamp,
  title: "Microsoft announces new AI...",
  source: "Bloomberg",
  link: "https://...",
  publishedAt: timestamp,
  importance: "High",       // High/Medium/Low
  relatedStock: "MSFT",
  matchDate: "2024-10-20",  // 연결된 매수 날짜
  relevanceScore: 85,       // 0-100
  category: "tech"          // tech/economy/market
}
```

### Collection 4: `weeklyReports`
```javascript
// 문서 ID: YYYY-WW (예: 2024-W42)
{
  week: "2024-W42",
  period: "2024-10-14 to 2024-10-20",
  weeklyReturn: 2.3,        // 주간 수익률
  highPrice: 532,
  lowPrice: 518,
  volatility: 2.1,
  topNews: [                // 주요 뉴스 3개
    { title: "...", link: "...", importance: "High" }
  ],
  learningPoints: [         // 학습 포인트
    "애플 실적이 MGK에 큰 영향을 미쳤습니다",
    "변동성이 평소보다 높았습니다"
  ],
  generatedAt: timestamp
}
```

### Collection 5: `settings`
```javascript
// 문서 ID: "app-config"
{
  sellSignalThreshold: 5,   // 매도 신호 기준 (%)
  sellRatio: 30,            // 매도 비율 (%)
  minDollarBalance: 50,     // 최소 달러 잔고
  goodExchangeRate: 1350,   // 좋은 환율 기준
  notificationEmail: "user@email.com",
  dailyPurchaseAmount: 10,  // 일일 매수 금액
  autoCollectNews: true,
  newsImportanceThreshold: 2, // 뉴스 수집 변동률 기준
  monitoringStocks: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"]
}
```

### Collection 6: `automationLogs`
```javascript
// 문서 ID: 자동 생성
{
  type: "daily-update",     // daily-update/news-collection/weekly-report
  status: "success",        // success/failed
  timestamp: timestamp,
  data: {                   // 실행 결과 데이터
    priceCollected: 520.50,
    newsCount: 5
  },
  error: null               // 에러 메시지 (있으면)
}
```

---

## 🏗️ 프로젝트 구조

```
mgk-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # 메인 대시보드
│   ├── reports/
│   │   └── page.tsx          # 주간 리포트
│   ├── settings/
│   │   └── page.tsx          # 설정
│   └── api/
│       ├── collect-price/    # 주가 수집 API
│       ├── collect-news/     # 뉴스 수집 API
│       └── generate-report/  # 리포트 생성 API
├── components/
│   ├── Dashboard.tsx
│   ├── PriceChart.tsx
│   ├── NewsSection.tsx
│   ├── ManualEntry.tsx       # 수동 입력 폼
│   └── SettingsForm.tsx
├── lib/
│   ├── firebase.ts           # Firebase 초기화
│   ├── firestore.ts          # Firestore 헬퍼
│   ├── apis/
│   │   ├── alphavantage.ts   # 주가 API
│   │   ├── exchangerate.ts   # 환율 API
│   │   └── news.ts           # 뉴스 API
│   └── utils/
│       ├── calculations.ts   # 수익률 계산 등
│       └── formatters.ts     # 데이터 포맷팅
├── types/
│   └── index.ts
├── functions/                # Firebase Cloud Functions
│   ├── src/
│   │   ├── dailyUpdate.ts    # 매일 자동 실행
│   │   ├── newsCollector.ts  # 뉴스 수집
│   │   └── reportGenerator.ts # 주간 리포트
│   └── package.json
└── firebase.json
```

---

## 📝 Step by Step 개발 가이드

### **Step 0: Firebase 프로젝트 생성**

#### Claude Code에게 보낼 메시지:

```
Firebase 프로젝트 세팅을 도와줘.

1. Firebase CLI 설치 방법 알려줘
2. firebase.json 설정 파일 생성
3. .firebaserc 파일 생성
4. Firestore 보안 규칙 (firestore.rules)
5. Firebase config 파일 생성

일단 파일 구조부터 만들어줘.
```

### **Step 1: Next.js 프로젝트 + Firebase SDK**

#### Claude Code에게 보낼 메시지:

```
Next.js 14 프로젝트를 Firebase와 함께 세팅해줘.

요구사항:
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui 설치 (card, button, table, badge, tabs, chart, alert, skeleton)

필수 라이브러리:
- firebase (Firebase SDK)
- recharts (차트)
- date-fns (날짜)
- lucide-react (아이콘)
- axios (API 요청)
- swr (데이터 페칭)

프로젝트 생성하고 npm install까지 실행해줘.
```

---

### **Step 2: Firebase 설정**

#### Claude Code에게 보낼 메시지:

```
Firebase 설정 파일들을 만들어줘.

1. lib/firebase.ts
   - Firebase 앱 초기화
   - Firestore 인스턴스
   - Firebase Config는 환경 변수에서 읽기

2. .env.local
   - NEXT_PUBLIC_FIREBASE_API_KEY
   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - NEXT_PUBLIC_FIREBASE_APP_ID
   - ALPHA_VANTAGE_API_KEY (주가 API)
   - EXCHANGE_RATE_API_KEY (환율 API)

3. firestore.rules
   - 일단 개발용으로 읽기/쓰기 모두 허용
   - 나중에 인증 추가 가능하게

4. lib/firestore.ts
   - Firestore CRUD 헬퍼 함수들
   - addDocument, getDocument, updateDocument, deleteDocument
   - queryCollection, subscribeToCollection
   - TypeScript 타입 안전하게
```

---

### **Step 3: 타입 정의**

#### Claude Code에게 보낼 메시지:

```
types/index.ts에 모든 타입을 정의해줘.

필요한 타입들:
- DailyPurchase
- DollarCharge
- NewsItem
- WeeklyReport
- AppSettings
- AutomationLog
- DashboardStats (계산용)
- PriceData (API 응답용)
- ExchangeRateData (API 응답용)

각 타입은 Firestore 컬렉션 구조와 정확히 매칭되게.
Timestamp는 Firebase Timestamp 타입 사용.
```

---

### **Step 4: 외부 API 연동**

#### Claude Code에게 보낼 메시지:

```
lib/apis/ 폴더에 외부 API 연동 파일들을 만들어줘.

1. lib/apis/alphavantage.ts
   - Alpha Vantage API로 MGK 주가 가져오기
   - 함수: getCurrentPrice(symbol: string)
   - 무료 API 키 사용 (하루 25회 제한)
   - 에러 핸들링

2. lib/apis/exchangerate.ts
   - ExchangeRate-API로 USD/KRW 환율 가져오기
   - 함수: getExchangeRate()
   - 무료 API (월 1500회)
   - 에러 핸들링

3. lib/apis/news.ts
   - Google News RSS 파싱
   - 함수: collectNews(keywords: string[])
   - RSS를 JSON으로 변환
   - 최근 24시간 필터링

모든 함수에 try-catch와 타입 지정.
캐싱 로직도 추가 (5분).
```

---

### **Step 5: 수동 입력 UI**

#### Claude Code에게 보낼 메시지:

```
components/ManualEntry.tsx를 만들어줘.

이 컴포넌트는 관리자가 수동으로 데이터를 입력하는 폼이야.

기능:
1. 달러 충전 기록 입력
   - 충전 날짜
   - 충전 금액
   - 환율
   - 수수료
   - 메모

2. 일일 매수 수동 입력 (필요시)
   - 날짜
   - 주가
   - 매수 금액

3. 설정 수정
   - 매도 신호 기준
   - 알림 이메일
   - 모니터링 종목

폼 검증:
- 필수 필드 체크
- 숫자 검증
- 날짜 포맷 검증

제출 시:
- Firestore에 저장
- 성공 토스트 메시지
- 폼 초기화

shadcn/ui Form, Input, Button 사용.
깔끔한 레이아웃.
```

---

### **Step 6: 대시보드 메인**

#### Claude Code에게 보낼 메시지:

```
app/page.tsx - 메인 대시보드를 만들어줘.

레이아웃:
1. 상단: 핵심 지표 카드 (4개)
   - 현재 MGK 주가 (실시간)
   - 총 보유량
   - 총 평가액
   - 수익률
   각 카드에 전일 대비 표시

2. 중간: 차트 섹션
   - 탭: 주가 추이 / 수익률 추이
   - Recharts 사용
   - 기간 선택: 7일/30일/90일/전체

3. 하단 좌측: 최근 매수 기록
   - 테이블 형태
   - 최근 10개

4. 하단 우측: 최근 뉴스
   - 중요도별 Badge
   - 최근 5개

데이터 페칭:
- Firestore 실시간 리스너 사용
- SWR로 캐싱
- 로딩: Skeleton
- 에러: Alert

반응형:
- 모바일: 세로 스택
- 태블릿+: 그리드
```

---

### **Step 7: API Routes (Next.js)**

#### Claude Code에게 보낼 메시지:

```
Next.js API Routes를 만들어줘.

1. app/api/collect-price/route.ts
   - POST 요청
   - Alpha Vantage에서 MGK 주가 수집
   - ExchangeRate API에서 환율 수집
   - dailyPurchases 컬렉션에 저장
   - 수익률 자동 계산
   - 매도 신호 체크

2. app/api/collect-news/route.ts
   - POST 요청
   - 최근 주가 변동률 체크
   - 변동률 ±2% 이상이면 뉴스 수집
   - Google News RSS 파싱
   - 중요도 계산
   - newsItems 컬렉션에 저장

3. app/api/generate-report/route.ts
   - POST 요청
   - 지난 주 데이터 집계
   - 주요 뉴스 선별
   - 학습 포인트 생성
   - weeklyReports 컬렉션에 저장
   - 이메일 발송 (선택)

4. app/api/stats/route.ts
   - GET 요청
   - 대시보드 통계 계산
   - 캐싱 5분

모든 API에:
- 에러 핸들링
- 로그 기록 (automationLogs)
- 적절한 HTTP 상태 코드
```

---

### **Step 8: Firebase Cloud Functions**

#### Claude Code에게 보낼 메시지:

```
Firebase Cloud Functions를 만들어줘.

functions/src/dailyUpdate.ts:
- 매일 오전 10시 실행 (Cron)
- Next.js API /api/collect-price 호출
- 성공/실패 로그

functions/src/newsCollector.ts:
- 매일 오전 10시 10분 실행
- Next.js API /api/collect-news 호출

functions/src/reportGenerator.ts:
- 매주 일요일 오후 8시 실행
- Next.js API /api/generate-report 호출

functions/package.json:
- firebase-functions
- firebase-admin
- axios

functions/index.ts:
- 모든 함수 export

Cloud Functions는 단순히 Next.js API를 트리거하는 역할.
실제 로직은 Next.js에.
```

---

### **Step 9: 설정 페이지**

#### Claude Code에게 보낼 메시지:

```
app/settings/page.tsx를 만들어줘.

기능:
1. 앱 설정 폼
   - 매도 신호 기준 (%)
   - 매도 비율 (%)
   - 최소 달러 잔고
   - 좋은 환율 기준
   - 알림 이메일
   - 일일 매수 금액

2. 모니터링 종목 관리
   - 종목 추가/삭제
   - 티커 심볼 입력
   - 최대 10개

3. 자동화 설정
   - 뉴스 자동 수집 on/off
   - 주간 리포트 자동 생성 on/off

4. 데이터 관리
   - 전체 데이터 백업 (JSON 다운로드)
   - 오래된 데이터 삭제 (90일 이상)

Firestore settings 컬렉션과 연동.
실시간 저장.
성공 토스트.
```

---

### **Step 10: 주간 리포트 페이지**

#### Claude Code에게 보낼 메시지:

```
app/reports/page.tsx를 만들어줘.

레이아웃:
1. 필터
   - 기간 선택: 최근 4주/8주/12주/전체

2. 리포트 카드 리스트
   - 타임라인 형태
   - 각 카드:
     * 주차 + 기간
     * 주간 수익률 (크게, 색상)
     * 최고가/최저가
     * 변동성
     * 주요 뉴스 (아코디언)
     * 학습 포인트 (bullet)
   - 카드 간 연결선

3. 다운로드 버튼
   - 선택한 리포트 PDF 다운로드 (선택 기능)

Firestore weeklyReports 컬렉션에서 읽기.
최신순 정렬.
인피니트 스크롤.
```

---

### **Step 11: 차트 컴포넌트**

#### Claude Code에게 보낼 메시지:

```
components/PriceChart.tsx를 만들어줘.

기능:
1. 탭 선택
   - 주가 추이
   - 수익률 추이

2. 기간 선택
   - 7일 / 30일 / 90일 / 전체

3. Recharts 차트
   - LineChart: 부드러운 곡선
   - AreaChart: 그라디언트 배경
   - Tooltip: 커스텀 (날짜, 가격, 수익률)
   - 호버 효과

4. 반응형
   - ResponsiveContainer
   - 모바일: 높이 300px
   - 데스크톱: 높이 500px

데이터:
- Firestore dailyPurchases에서
- 선택한 기간만 필터링
- date-fns로 포맷팅

스타일:
- 수익(초록), 손실(빨강)
- 부드러운 애니메이션
```

---

### **Step 12: 뉴스 섹션**

#### Claude Code에게 보낼 메시지:

```
components/NewsSection.tsx를 만들어줘.

기능:
1. 필터 버튼
   - All / High / Medium / Low
   - 중요도별 필터링

2. 뉴스 리스트
   - 카드 형태 (모바일 친화적)
   - 각 카드:
     * 제목 (bold)
     * 출처 + 시간 (작게)
     * 중요도 Badge
     * 관련 종목 Badge
     * 클릭하면 새 탭 열기

3. 무한 스크롤
   - 처음 10개만 로드
   - 스크롤하면 추가 로드

4. 빈 상태
   - 뉴스 없으면 안내 메시지

Firestore newsItems에서 실시간 구독.
중요도별 정렬 후 시간순.
```

---

### **Step 13: 유틸리티 함수**

#### Claude Code에게 보낼 메시지:

```
lib/utils/ 폴더에 유틸리티 함수들을 만들어줘.

1. lib/utils/calculations.ts
   - calculateReturnRate(current, average): 수익률 계산
   - calculateAveragePrice(purchases): 평균 매수가
   - calculateTotalValue(shares, price): 총 평가액
   - calculateVolatility(prices): 변동성
   - calculateSellSignal(returnRate, threshold): 매도 신호

2. lib/utils/formatters.ts
   - formatCurrency(amount, currency): $1,234.56
   - formatPercent(value): +5.2%
   - formatDate(date): 2024년 10월 20일
   - formatRelativeTime(date): "2시간 전"
   - formatNumber(num): 1,234,567

3. lib/utils/validators.ts
   - isValidEmail(email)
   - isValidDate(date)
   - isPositiveNumber(num)
   - isValidTickerSymbol(ticker)

모든 함수 TypeScript로 타입 안전하게.
단위 테스트 가능하게.
```

---

### **Step 14: 알림 시스템 (선택)**

#### Claude Code에게 보낼 메시지:

```
lib/notifications.ts를 만들어줘.

기능:
1. 이메일 알림
   - SendGrid 또는 Resend API 사용
   - 매도 신호 알림
   - 충전 필요 알림
   - 주간 리포트 알림

2. 알림 템플릿
   - HTML 이메일 템플릿
   - 반응형 디자인
   - 버튼 링크 (대시보드로)

3. 알림 함수들
   - sendSellSignalAlert(data)
   - sendChargeReminderAlert(balance)
   - sendWeeklyReportEmail(report)

Cloud Functions에서 호출.
에러 핸들링.
```

---

### **Step 15: 테스트 & 최적화**

#### Claude Code에게 보낼 메시지:

```
전체 프로젝트를 테스트하고 최적화해줘.

1. TypeScript 에러 확인
   - npm run build 실행
   - 모든 타입 에러 수정

2. 성능 최적화
   - React.memo 필요한 컴포넌트
   - useMemo, useCallback 사용
   - 이미지 최적화
   - 코드 스플리팅

3. Firestore 최적화
   - 인덱스 생성 (필요한 쿼리)
   - 복합 쿼리 최적화
   - 캐싱 전략

4. 보안
   - Firestore 규칙 강화
   - API 키 환경 변수 확인
   - CORS 설정

5. 문서화
   - README.md 업데이트
   - 주석 추가
   - .env.example 업데이트
```

---

## 🚀 배포 가이드

### Vercel 배포

```bash
# 1. GitHub에 푸시
git init
git add .
git commit -m "Initial commit"
git remote add origin [your-repo]
git push -u origin main

# 2. Vercel 연결
- Vercel 대시보드
- Import GitHub repo
- 환경 변수 설정 (모든 NEXT_PUBLIC_*)

# 3. 배포!
```

### Firebase Cloud Functions 배포

```bash
# 1. Firebase 로그인
firebase login

# 2. 프로젝트 설정
firebase use [project-id]

# 3. 배포
firebase deploy --only functions
```

---

## 💰 비용 예상

### Firebase (무료 플랜 Spark)
```
Firestore:
- 읽기: 50,000/일 (무료)
- 쓰기: 20,000/일 (무료)
- 저장: 1GB (무료)
→ 개인 사용 충분!

Cloud Functions:
- 2,000,000 실행/월 (무료)
- 매일 3번 실행 = 90번/월
→ 무료 범위 내
```

### Alpha Vantage (무료)
```
- 25 API 요청/일
- 매일 1번만 사용 = OK
```

### ExchangeRate-API (무료)
```
- 1,500 요청/월
- 매일 1번 = 30번/월 = OK
```

### Vercel (무료)
```
- Hobby 플랜 무료
- 충분한 대역폭
```

**총 비용: $0/월** ✨

---

## 🎯 Google Sheets vs Firebase 비교

### Google Sheets 방식
```
✅ 초기 세팅 쉬움
✅ 데이터 직접 확인 쉬움
❌ 속도 느림
❌ API 제한 많음
❌ 확장성 낮음
❌ 실시간 어려움
```

### Firebase 방식
```
✅ 빠른 속도
✅ 실시간 동기화
✅ 확장성 우수
✅ 무료 제공 관대
✅ 전문적
❌ 초기 세팅 복잡
❌ 데이터 직접 보기 불편
```

---

## 📚 학습 리소스

### Firebase 공식 문서
- https://firebase.google.com/docs/firestore
- https://firebase.google.com/docs/functions

### Alpha Vantage
- https://www.alphavantage.co/documentation/

### 유용한 튜토리얼
- Next.js + Firebase: https://firebase.google.com/docs/web/setup
- Firestore 데이터 모델링: https://firebase.google.com/docs/firestore/data-model

---

## 🎉 완료!

이제 Google Sheets 없이 완전 독립적인 시스템입니다!

**장점:**
- 🚀 빠른 속도
- 🔒 완전한 제어
- 📊 실시간 업데이트
- 💪 확장 가능
- 🆓 무료

**다음 단계:**
1. Firebase 프로젝트 생성
2. Step 0부터 순서대로
3. Claude Code와 함께!

준비되셨나요? 🔥