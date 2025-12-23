# Firestore 데이터베이스 구조

## 개요

다중 종목 포트폴리오 관리를 위한 Firestore 컬렉션 구조입니다.

## 컬렉션 구조

```
firestore/
├── users/{userId}                          # 사용자 정보
│   ├── profile                             # 사용자 프로필
│   ├── settings                            # 사용자 설정
│   └── portfolios/{portfolioId}            # 포트폴리오 (서브컬렉션)
│       ├── positions/{positionId}          # 포지션 (서브컬렉션)
│       └── transactions/{transactionId}    # 거래 이력 (서브컬렉션)
│
├── stocks/{stockId}                        # 글로벌 종목 마스터
├── portfolioAnalyses/{analysisId}          # 포트폴리오 분석 결과
├── dollarCharges/{chargeId}                # 달러 충전 기록 (기존)
├── dailyPurchases/{purchaseId}             # 일일 매수 기록 (기존, 하위 호환)
├── newsItems/{newsId}                      # 뉴스 아이템
├── weeklyReports/{reportId}                # 주간 리포트
├── aiInsights/{insightId}                  # AI 인사이트
├── priceCache/{cacheKey}                   # 시세 캐시 (심볼·타입별 스냅샷)
└── appSettings/{settingId}                 # 앱 설정 (기존)
```

## 상세 스키마

### 1. users/{userId}

사용자 기본 정보

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  defaultPortfolioId?: string;  // 기본 포트폴리오 ID
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

### 2. users/{userId}/portfolios/{portfolioId}

사용자별 포트폴리오

```typescript
{
  id: string;
  userId: string;
  name: string;                 // "메인 포트폴리오", "은퇴 자금"
  description?: string;
  isDefault: boolean;
  totalInvested: number;        // USD
  totalValue: number;           // USD
  returnRate: number;           // %
  cashBalance: number;          // USD
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**인덱스**:
- `userId` ASC, `isDefault` DESC
- `userId` ASC, `createdAt` DESC

### 3. users/{userId}/portfolios/{portfolioId}/positions/{positionId}

포트폴리오 내 종목별 포지션

```typescript
{
  id: string;
  portfolioId: string;
  stockId: string;
  symbol: string;
  shares: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice: number;
  totalValue: number;
  returnRate: number;
  profitLoss: number;
  priceSource?: 'realtime' | 'historical' | 'fallback' | 'cached';
  priceTimestamp?: string;
  purchaseMethod: 'auto' | 'manual';
  autoInvestConfig?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    amount: number;
    startDate: string;
    isActive: boolean;
    lastExecuted?: string;
  };
  sellAlert?: {
    enabled: boolean;
    targetReturnRate: number;
    sellRatio: number;
    notifyEmail?: string;
    triggerOnce?: boolean;
    lastTriggeredAt?: string;
  };
  firstPurchaseDate: string;
  lastTransactionDate: string;
  transactionCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**인덱스**:
- `portfolioId` ASC, `symbol` ASC
- `portfolioId` ASC, `updatedAt` DESC
- `portfolioId` ASC, `returnRate` DESC

### 4. users/{userId}/portfolios/{portfolioId}/transactions/{transactionId}

거래 이력

```typescript
{
  id: string;
  portfolioId: string;
  positionId: string;
  stockId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend';
  date: string;                 // YYYY-MM-DD
  price: number;
  shares: number;
  amount: number;
  fee: number;
  tax?: number;
  totalAmount: number;
  executedAt?: string;          // ISO timestamp (UTC)
  exchangeRate?: number;
  krwAmount?: number;
  purchaseMethod: 'auto' | 'manual';
  purchaseUnit: 'shares' | 'amount';
  memo?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

**인덱스**:
- `portfolioId` ASC, `date` DESC
- `portfolioId` ASC, `symbol` ASC, `date` DESC
- `positionId` ASC, `date` DESC

### 5. stocks/{stockId}

글로벌 종목 마스터 (모든 사용자 공유)

```typescript
{
  id: string;
  symbol: string;               // AAPL, 005930
  name: string;
  market: 'US' | 'KR' | 'GLOBAL';
  assetType: 'stock' | 'etf' | 'reit' | 'fund';
  sector?: 'information-technology' | 'health-care' | ...;
  currency: 'USD' | 'KRW';
  exchange?: string;            // NASDAQ, KOSPI
  description?: string;
  logoUrl?: string;
  website?: string;
  lastUpdated?: Timestamp;
  searchCount?: number;
  createdAt: Timestamp;
}
```

**인덱스**:
- `symbol` ASC (unique)
- `market` ASC, `searchCount` DESC
- `assetType` ASC, `searchCount` DESC

### 6. portfolioAnalyses/{analysisId}

포트폴리오 분석 결과 (캐싱용)

```typescript
{
  portfolioId: string;
  userId: string;
  sectorAllocation: Array<{
    sector: string;
    value: number;
    percentage: number;
    returnRate: number;
  }>;
  regionAllocation: Array<{...}>;
  assetAllocation: Array<{...}>;
  riskMetrics: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    beta?: number;
  };
  topContributors: Array<{...}>;
  rebalancingSuggestions?: Array<{...}>;
  generatedAt: Timestamp;
}
```

**인덱스**:
- `portfolioId` ASC, `generatedAt` DESC
- `userId` ASC, `generatedAt` DESC

## 마이그레이션 전략

### priceCache/{cacheKey}

실시간/일간 시세 데이터를 캐싱하기 위한 컬렉션입니다. `cacheKey`는 `symbol:market:resolution` 조합(예: `NVDA:US:intraday`)을 사용합니다.

```typescript
type PriceCacheResolution = 'intraday' | 'daily';

interface PriceCacheEntry {
  cacheKey: string;                 // symbol:market:resolution
  symbol: string;                   // NVDA, 005930
  market: 'US' | 'KR' | 'GLOBAL';
  currency: 'USD' | 'KRW';
  resolution: PriceCacheResolution; // intraday | daily
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  source: 'alphavantage' | 'yahoo' | 'fallback';
  sourceTimestamp: Timestamp;       // 공급자 기준 시간
  cachedAt: Timestamp;              // Firestore에 저장한 시각
  expireAt: Timestamp;              // TTL 용 필드 (Firestore 자동 삭제)
  metadata?: {
    exchange?: string;
    timezone?: string;
    decimals?: number;
    remarks?: string;
  };
}
```

**저장/갱신 규칙**
- 동일 `cacheKey`는 `set(..., { merge: true })`로 갱신하며 `cachedAt`, `expireAt`를 항상 최신으로 교체합니다.
- `resolution === 'intraday'`인 경우 `expireAt = cachedAt + 10분`.
- `resolution === 'daily'`인 경우 `expireAt = cachedAt + 12시간`.
- Fallback(가격을 구하지 못한 경우)의 `expireAt`은 30분으로 짧게 설정하여 재시도를 유도합니다.

**Firestore TTL 설정**
- 콘솔에서 `priceCache` 컬렉션의 `expireAt` 필드를 TTL로 지정합니다.
- TTL 삭제는 최대 24시간 지연될 수 있으므로, Cloud Functions에서 만료 값이 지난 문서를 읽을 때는 즉시 무시하도록 추가 검증합니다.

**권장 인덱스**
- `symbol` ASC, `resolution` ASC
- `market` ASC, `cachedAt` DESC

**사용 시나리오**
1. 시세 API 호출 전 `priceCache`에서 최신 문서를 조회 (`cachedAt`이 만료되지 않았는지 확인).
2. 존재하면 캐시 데이터를 반환하고 `priceSource = 'cached'`.
3. 캐시가 없거나 만료되었으면 외부 API 호출 → 성공 시 `priceCache`에 저장 → 클라이언트에 최신 데이터 전달.
4. API 호출 실패 시 최근 캐시 데이터를 fallback으로 제공하며, `metadata.remarks`에 오류 정보를 남겨 UI에서 "캐시 데이터 표시" 배지를 출력.

**보안 규칙**
- 읽기: 인증된 사용자 모두 허용 (시세 정보는 공유 가능).
- 쓰기: Cloud Functions 또는 백엔드에서만 허용 (`allow write: if false` 후 Functions에서 Admin SDK 사용).

**스토리지 비용 가이드**
- 심볼 2,000개, intraday/daily 각각 1문서 → 약 4,000 문서.
- 문서당 1KB 가정 시 총 4MB → Firestore 저장 비용에 거의 영향 없음.


### Phase 1: 새 구조 생성 (기존 데이터 유지)

1. 새 컬렉션 생성
2. 기존 데이터는 그대로 유지
3. 병렬 운영

### Phase 2: 데이터 마이그레이션

1. `dailyPurchases` → `users/{userId}/portfolios/{portfolioId}/transactions`
2. MGK 데이터를 기본 포트폴리오로 변환
3. MGK를 `stocks` 컬렉션에 추가

### Phase 3: 코드 전환

1. 새 API 엔드포인트 구현
2. 프론트엔드 점진적 전환
3. 기존 API 유지 (하위 호환)

### Phase 4: 정리

1. 기존 컬렉션 아카이브
2. 미사용 코드 제거

## 보안 규칙

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 사용자 데이터
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 포트폴리오
      match /portfolios/{portfolioId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        // 포지션
        match /positions/{positionId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
        
        // 거래 이력
        match /transactions/{transactionId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    
    // 종목 마스터 (모두 읽기 가능, 쓰기는 서버만)
    match /stocks/{stockId} {
      allow read: if true;
      allow write: if false;  // Cloud Function에서만 쓰기
    }
    
    // 분석 결과
    match /portfolioAnalyses/{analysisId} {
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      allow write: if false;  // Cloud Function에서만 쓰기
    }
  }
}
```

## 쿼리 예시

### 사용자의 모든 포트폴리오 조회

```typescript
const portfoliosRef = collection(db, `users/${userId}/portfolios`);
const q = query(portfoliosRef, orderBy('createdAt', 'desc'));
const snapshot = await getDocs(q);
```

### 특정 포트폴리오의 모든 포지션 조회

```typescript
const positionsRef = collection(
  db, 
  `users/${userId}/portfolios/${portfolioId}/positions`
);
const q = query(positionsRef, orderBy('totalValue', 'desc'));
const snapshot = await getDocs(q);
```

### 특정 종목의 거래 이력 조회

```typescript
const transactionsRef = collection(
  db,
  `users/${userId}/portfolios/${portfolioId}/transactions`
);
const q = query(
  transactionsRef,
  where('symbol', '==', 'AAPL'),
  orderBy('date', 'desc'),
  limit(50)
);
const snapshot = await getDocs(q);
```

### 종목 검색

```typescript
const stocksRef = collection(db, 'stocks');
const q = query(
  stocksRef,
  where('symbol', '>=', searchTerm),
  where('symbol', '<=', searchTerm + '\uf8ff'),
  limit(10)
);
const snapshot = await getDocs(q);
```

## 성능 최적화

### 1. 복합 인덱스 생성

Firestore Console에서 자동 생성되는 인덱스 외에 수동으로 생성:

- `users/{userId}/portfolios/{portfolioId}/positions`: `portfolioId` + `returnRate` DESC
- `users/{userId}/portfolios/{portfolioId}/transactions`: `portfolioId` + `date` DESC

### 2. 캐싱 전략

- 종목 마스터: 클라이언트 메모리 캐싱 (1시간)
- 포트폴리오 분석: Firestore 캐싱 (1일)
- 주가 데이터: API 레벨 캐싱 (5분)

### 3. 배치 작업

- 거래 추가 시 포지션/포트폴리오 업데이트를 배치로 처리
- Cloud Function으로 비동기 처리

## 데이터 크기 추정

### 사용자당 예상 데이터

- 포트폴리오: 1-3개 (평균 2개)
- 포지션: 포트폴리오당 5-20개 (평균 10개)
- 거래: 연간 100-500건 (평균 200건)

### 1000명 사용자 기준

- 포트폴리오: 2,000개
- 포지션: 20,000개
- 거래: 200,000건/년
- 종목 마스터: 1,000-5,000개

### Firestore 비용 추정 (월간)

- 읽기: ~500K reads/month → $0.18
- 쓰기: ~100K writes/month → $0.54
- 저장: ~1GB → $0.18
- **총 예상 비용: ~$1/month** (1000명 기준)

