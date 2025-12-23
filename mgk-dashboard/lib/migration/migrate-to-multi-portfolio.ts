/**
 * 마이그레이션 스크립트: 단일 종목(MGK) → 다중 종목 포트폴리오 시스템
 * 
 * 실행 방법:
 * 1. Firebase Admin SDK 초기화
 * 2. 이 스크립트를 Node.js 환경에서 실행
 * 3. 사용자별로 기본 포트폴리오 생성 및 데이터 이전
 */

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  Timestamp,
  writeBatch,
  getFirestore
} from 'firebase/firestore';
import type { 
  DailyPurchase, 
  Portfolio, 
  Position, 
  Transaction,
  Stock 
} from '@/types';

const db = getFirestore();

// MGK 종목 정보
const MGK_STOCK: Omit<Stock, 'id'> = {
  symbol: 'MGK',
  name: 'Vanguard Mega Cap Growth ETF',
  market: 'US',
  assetType: 'etf',
  sector: 'information-technology',
  currency: 'USD',
  exchange: 'NYSE',
  description: 'Vanguard Mega Cap Growth ETF - 대형 성장주 ETF',
  searchCount: 0,
  createdAt: Timestamp.now(),
};

interface MigrationResult {
  success: boolean;
  userId: string;
  portfolioId?: string;
  positionId?: string;
  transactionCount?: number;
  error?: string;
}

/**
 * MGK 종목을 stocks 컬렉션에 추가
 */
export async function ensureMGKStock(): Promise<string> {
  const stockId = 'MGK';
  const stockRef = doc(db, 'stocks', stockId);
  
  try {
    await setDoc(stockRef, MGK_STOCK, { merge: true });
    console.log('✅ MGK 종목 생성/업데이트 완료');
    return stockId;
  } catch (error) {
    console.error('❌ MGK 종목 생성 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 기본 포트폴리오 생성
 */
async function createDefaultPortfolio(userId: string): Promise<string> {
  const portfolioId = `${userId}_default`;
  const portfolioRef = doc(db, `users/${userId}/portfolios`, portfolioId);
  
  const portfolio: Omit<Portfolio, 'id'> = {
    userId,
    name: '메인 포트폴리오',
    description: 'MGK 데이터에서 마이그레이션됨',
    isDefault: true,
    totalInvested: 0,
    totalValue: 0,
    returnRate: 0,
    cashBalance: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(portfolioRef, portfolio);
  console.log(`  ✅ 포트폴리오 생성: ${portfolioId}`);
  
  return portfolioId;
}

/**
 * MGK 포지션 생성
 */
async function createMGKPosition(
  userId: string,
  portfolioId: string,
  stockId: string,
  latestPurchase: DailyPurchase
): Promise<string> {
  const positionId = `${portfolioId}_${stockId}`;
  const positionRef = doc(
    db,
    `users/${userId}/portfolios/${portfolioId}/positions`,
    positionId
  );
  
  const position: Omit<Position, 'id'> = {
    portfolioId,
    stockId,
    symbol: 'MGK',
    name: 'Vanguard Mega Cap Growth ETF',
    market: 'US',
    exchange: 'NYSE',
    assetType: 'etf',
    sector: 'information-technology',
    currency: 'USD',
    shares: latestPurchase.totalShares,
    averagePrice: latestPurchase.averagePrice,
    totalInvested: latestPurchase.totalShares * latestPurchase.averagePrice,
    currentPrice: latestPurchase.price,
    totalValue: latestPurchase.totalValue,
    returnRate: latestPurchase.returnRate,
    profitLoss: latestPurchase.totalValue - (latestPurchase.totalShares * latestPurchase.averagePrice),
    purchaseMethod: 'auto', // 기존 MGK는 자동투자로 가정
    autoInvestConfig: {
      frequency: 'daily',
      amount: 10, // 기본값
      startDate: latestPurchase.date,
      isActive: true,
    },
    firstPurchaseDate: latestPurchase.date,
    lastTransactionDate: latestPurchase.date,
    transactionCount: 0, // 거래 마이그레이션 후 업데이트
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(positionRef, position);
  console.log(`  ✅ 포지션 생성: ${positionId}`);
  
  return positionId;
}

/**
 * 일일 매수 기록을 거래 이력으로 변환
 */
async function migratePurchasesToTransactions(
  userId: string,
  portfolioId: string,
  positionId: string,
  stockId: string,
  purchases: DailyPurchase[]
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;
  
  for (const purchase of purchases) {
    const transactionId = `${positionId}_${purchase.date}`;
    const transactionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`,
      transactionId
    );
    
    const transaction: Omit<Transaction, 'id'> = {
      portfolioId,
      positionId,
      stockId,
      symbol: 'MGK',
      type: 'buy',
      date: purchase.date,
      price: purchase.price,
      shares: purchase.shares,
      amount: purchase.purchaseAmount,
      fee: 0, // 기존 데이터에 수수료 정보 없음
      totalAmount: purchase.purchaseAmount,
      exchangeRate: purchase.exchangeRate,
      purchaseMethod: 'auto',
      purchaseUnit: 'amount',
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
    
    batch.set(transactionRef, transaction);
    count++;
    
    // Firestore 배치는 최대 500개 제한
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  ⏳ ${count}개 거래 마이그레이션 중...`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`  ✅ ${count}개 거래 마이그레이션 완료`);
  return count;
}

/**
 * 포트폴리오 총계 업데이트
 */
async function updatePortfolioTotals(
  userId: string,
  portfolioId: string,
  position: Omit<Position, 'id'>
): Promise<void> {
  const portfolioRef = doc(db, `users/${userId}/portfolios`, portfolioId);
  
  const updates: Partial<Portfolio> = {
    totalInvested: position.totalInvested,
    totalValue: position.totalValue,
    returnRate: position.returnRate,
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(portfolioRef, updates, { merge: true });
  console.log(`  ✅ 포트폴리오 총계 업데이트`);
}

/**
 * 단일 사용자 데이터 마이그레이션
 */
export async function migrateUserData(userId: string): Promise<MigrationResult> {
  console.log(`\n🔄 사용자 마이그레이션 시작: ${userId}`);
  
  try {
    // 1. MGK 종목 확인
    const stockId = await ensureMGKStock();
    
    // 2. 기존 dailyPurchases 조회
    const purchasesRef = collection(db, 'dailyPurchases');
    const purchasesSnapshot = await getDocs(purchasesRef);
    const purchases: DailyPurchase[] = [];
    
    purchasesSnapshot.forEach((doc) => {
      purchases.push({ id: doc.id, ...doc.data() } as DailyPurchase);
    });
    
    if (purchases.length === 0) {
      console.log(`  ⚠️  매수 기록 없음, 건너뜀`);
      return {
        success: true,
        userId,
        error: 'No purchases found',
      };
    }
    
    // 날짜순 정렬
    purchases.sort((a, b) => a.date.localeCompare(b.date));
    const latestPurchase = purchases[purchases.length - 1];
    
    console.log(`  📊 ${purchases.length}개 매수 기록 발견`);
    
    // 3. 기본 포트폴리오 생성
    const portfolioId = await createDefaultPortfolio(userId);
    
    // 4. MGK 포지션 생성
    const positionId = await createMGKPosition(
      userId,
      portfolioId,
      stockId,
      latestPurchase
    );
    
    // 5. 거래 이력 마이그레이션
    const transactionCount = await migratePurchasesToTransactions(
      userId,
      portfolioId,
      positionId,
      stockId,
      purchases
    );
    
    // 6. 포지션의 거래 횟수 업데이트
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );
    await setDoc(
      positionRef,
      { transactionCount, updatedAt: Timestamp.now() },
      { merge: true }
    );
    
    // 7. 포트폴리오 총계 업데이트
    await updatePortfolioTotals(userId, portfolioId, {
      portfolioId,
      stockId,
      symbol: 'MGK',
      name: 'Vanguard Mega Cap Growth ETF',
      market: 'US',
      exchange: 'NYSE',
      assetType: 'etf',
      sector: 'information-technology',
      currency: 'USD',
      shares: latestPurchase.totalShares,
      averagePrice: latestPurchase.averagePrice,
      totalInvested: latestPurchase.totalShares * latestPurchase.averagePrice,
      currentPrice: latestPurchase.price,
      totalValue: latestPurchase.totalValue,
      returnRate: latestPurchase.returnRate,
      profitLoss: latestPurchase.totalValue - (latestPurchase.totalShares * latestPurchase.averagePrice),
      purchaseMethod: 'auto',
      firstPurchaseDate: purchases[0].date,
      lastTransactionDate: latestPurchase.date,
      transactionCount,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    console.log(`✅ 사용자 마이그레이션 완료: ${userId}\n`);
    
    return {
      success: true,
      userId,
      portfolioId,
      positionId,
      transactionCount,
    };
  } catch (error) {
    console.error(`❌ 사용자 마이그레이션 실패: ${userId}`, error);
    return {
      success: false,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 모든 사용자 데이터 마이그레이션
 */
export async function migrateAllUsers(): Promise<MigrationResult[]> {
  console.log('🚀 전체 마이그레이션 시작\n');
  
  // 실제 환경에서는 users 컬렉션에서 사용자 목록을 가져와야 함
  // 현재는 데모용으로 하드코딩
  const userIds = ['demo-user-1']; // 실제 사용자 ID로 교체
  
  const results: MigrationResult[] = [];
  
  for (const userId of userIds) {
    const result = await migrateUserData(userId);
    results.push(result);
  }
  
  // 결과 요약
  console.log('\n📊 마이그레이션 결과 요약');
  console.log('='.repeat(50));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 성공: ${successCount}명`);
  console.log(`❌ 실패: ${failCount}명`);
  
  if (failCount > 0) {
    console.log('\n실패한 사용자:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.userId}: ${r.error}`));
  }
  
  return results;
}

/**
 * 마이그레이션 롤백 (필요시)
 */
export async function rollbackMigration(userId: string): Promise<void> {
  console.log(`🔄 롤백 시작: ${userId}`);
  
  try {
    const batch = writeBatch(db);
    
    // 포트폴리오 삭제 (서브컬렉션은 수동으로 삭제 필요)
    const portfoliosRef = collection(db, `users/${userId}/portfolios`);
    const portfoliosSnapshot = await getDocs(portfoliosRef);
    
    portfoliosSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ 롤백 완료: ${userId}`);
  } catch (error) {
    console.error(`❌ 롤백 실패: ${userId}`, error);
    throw error;
  }
}

// CLI에서 직접 실행할 수 있도록
if (require.main === module) {
  migrateAllUsers()
    .then(() => {
      console.log('\n✅ 마이그레이션 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 마이그레이션 실패:', error);
      process.exit(1);
    });
}

