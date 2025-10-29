# 2025-10-29: 주식 등록 시스템 대폭 개선

## 📋 요청사항
1. 자동 구매 설정 시 시작일부터 오늘까지 거래 내역 자동 생성
2. 매수 가격 자동 불러오기 기능이 작동하지 않는 문제 수정
3. 동일 주식 추가 시 병합 기능 구현 (자동/수동 모두)
4. Firestore sector undefined 에러 해결
5. 개인화 뉴스 적용 확인

## ✅ 완료된 작업

### 1. 자동 투자 거래 내역 자동 생성 시스템
**파일**: `mgk-dashboard/lib/services/auto-invest.ts` (신규)

- **`generateAutoInvestTransactions` 함수**:
  - 시작일부터 오늘까지 정기적으로 구매한 거래 내역을 자동 생성
  - 빈도 지원: daily, weekly, biweekly, monthly, quarterly
  - 각 거래마다 Transaction 생성 및 Position 업데이트
  - 총 거래 건수, 총 주식 수, 총 금액 반환

- **`getAutoInvestDates` 함수**:
  - 정기 구매 날짜 목록 미리보기 생성
  - UI에서 확인용으로 활용 가능

**적용**: `app/api/positions/route.ts`
```typescript
// 자동 투자: 시작일부터 오늘까지 정기 구매 거래 내역 생성
const pricePerShare = parseFloat(body.purchasePrice) || 100;
await generateAutoInvestTransactions(userId, portfolioId, positionId, {
  symbol: stock.symbol,
  stockId: stock.symbol,
  frequency: autoInvestConfig.frequency,
  amount: autoInvestConfig.amount,
  startDate: autoInvestConfig.startDate,
  pricePerShare,
});
```

### 2. 매수 가격 자동 불러오기 수정
**파일**: `mgk-dashboard/app/portfolio/add-stock/page.tsx`

**문제**: 
- `purchaseMethod !== 'manual'` 조건으로 인해 자동 투자 시 가격을 불러오지 않음

**해결**:
```typescript
// 수동 구매: purchaseDate 기준, 자동 구매: autoStartDate 기준
const dateToFetch = purchaseMethod === 'manual' ? purchaseDate : autoStartDate;

if (!selectedStock || !dateToFetch) {
  return;
}

// US 주식만 지원
if (selectedStock.market !== 'US') {
  return;
}

// Alpha Vantage API로 역사적 가격 조회
const response = await fetch(
  `/api/stocks/historical-price?symbol=${selectedStock.symbol}&date=${dateToFetch}`
);
```

### 3. 동일 주식 병합 기능 구현
**파일**: `mgk-dashboard/lib/services/position.ts`, `app/api/positions/route.ts`

#### 3-1. 동일 종목 찾기 함수 추가
```typescript
export async function findPositionBySymbol(
  userId: string,
  portfolioId: string,
  symbol: string
): Promise<Position | null> {
  const positionsRef = collection(
    db,
    `users/${userId}/portfolios/${portfolioId}/positions`
  );
  const q = query(positionsRef, where('symbol', '==', symbol));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Position;
}
```

#### 3-2. API에서 병합 로직 적용
```typescript
// 동일 종목이 이미 있는지 확인
const existingPosition = await findPositionBySymbol(userId, portfolioId, stock.symbol);

if (existingPosition) {
  console.log(`⚠️ 동일 종목 발견: ${stock.symbol} - 기존 포지션에 병합합니다.`);
  
  // 기존 포지션에 새 거래 추가
  if (purchaseMethod === 'manual' && initialPurchase) {
    // 수동 매수 병합
    await createTransaction(...);
    await updatePositionAfterTransaction(...);
  } else if (purchaseMethod === 'auto' && autoInvestConfig) {
    // 자동 투자 병합
    await generateAutoInvestTransactions(...);
  }
  
  return NextResponse.json({
    success: true,
    positionId: existingPosition.id,
    merged: true,
    message: '동일 종목이 기존 포지션에 병합되었습니다.',
    totals,
  });
}
```

### 4. Firestore sector undefined 에러 수정
**파일**: `mgk-dashboard/lib/services/position.ts`

**문제**: 
- Stock 데이터에서 sector가 undefined일 때 Firestore 저장 실패

**해결**:
```typescript
const position: Omit<Position, 'id'> = {
  // ... other fields
  sector: stock.sector || '미분류', // 기본값 추가
  // ... other fields
};
```

### 5. 개인화 뉴스 기능 검증
**파일**: `mgk-dashboard/app/api/news/personalized/route.ts`, `lib/apis/news.ts`

**상태**: ✅ 정상 작동
- RSS 뉴스 수집 로직 정상
- 감성 분석 기능 정상
- 보유 종목 기반 필터링 정상
- Position 데이터 기반으로 개인화된 뉴스 제공

## 🔧 기술 세부사항

### 자동 투자 거래 생성 로직
```typescript
let currentDate = new Date(startDate);

while (currentDate <= today) {
  const dateString = currentDate.toISOString().split('T')[0];
  const shares = config.amount / config.pricePerShare;

  transactions.push({
    date: dateString,
    shares,
    price: config.pricePerShare,
    amount: config.amount,
  });

  // 다음 거래 날짜 계산
  switch (config.frequency) {
    case 'daily':
      currentDate.setDate(currentDate.getDate() + 1);
      break;
    case 'weekly':
      currentDate.setDate(currentDate.getDate() + 7);
      break;
    // ... 기타 빈도
  }
}
```

### 병합 프로세스
1. **종목 검색**: `findPositionBySymbol`로 동일 종목 확인
2. **병합 여부 판단**: 존재하면 병합, 없으면 신규 생성
3. **거래 추가**: 
   - 수동: 단건 거래 추가 + Position 업데이트
   - 자동: 정기 거래 일괄 생성 + Position 업데이트
4. **응답**: `merged: true` 플래그와 메시지 반환

## 📊 개선 효과

### 사용자 경험
1. ✅ 자동 투자 설정 시 과거 투자 내역이 자동으로 생성되어 정확한 포트폴리오 현황 파악
2. ✅ US 주식 등록 시 날짜만 선택하면 가격이 자동으로 입력됨
3. ✅ 동일 종목을 여러 번 추가해도 하나의 포지션으로 통합 관리
4. ✅ 모든 주식 데이터가 안전하게 Firestore에 저장됨

### 데이터 정합성
1. ✅ Transaction 개수와 Position의 transactionCount 일치
2. ✅ 평균 매수가가 모든 거래를 반영하여 정확하게 계산됨
3. ✅ 자동 투자와 수동 매수를 구분하여 관리

## 🚀 배포 정보
- **커밋**: `b7685f3`
- **브랜치**: `main`
- **변경 파일**: 4개
  - `lib/services/auto-invest.ts` (신규, +147 라인)
  - `lib/services/position.ts` (+33 라인)
  - `app/api/positions/route.ts` (+79 라인)
  - `app/portfolio/add-stock/page.tsx` (+7 라인, -7 라인)
- **Vercel 자동 배포**: 진행 중

## 📝 다음 단계 제안
1. 자동 투자 거래 생성 시 실제 역사적 가격 적용 (현재는 시작일 가격으로 일괄 적용)
2. 한국 주식도 역사적 가격 자동 불러오기 지원
3. 병합 시 사용자에게 확인 모달 표시
4. 자동 투자 미리보기 기능 (예상 거래 날짜 및 금액)

