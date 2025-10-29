/**
 * 포지션 관리 API
 * 
 * POST: 새 포지션 생성
 * GET: 포트폴리오의 모든 포지션 조회
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { 
  createPosition, 
  getPortfolioPositions,
  calculatePortfolioTotals,
  findPositionBySymbol,
  updatePositionAfterTransaction,
} from '@/lib/services/position';
import { saveStockMaster } from '@/lib/services/stock-master';
import { generateAutoInvestTransactions } from '@/lib/services/auto-invest';
import type { Stock } from '@/types';

/**
 * POST /api/positions
 * 새 포지션 생성 및 초기 거래 기록
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default_user', // 실제로는 인증에서 가져와야 함
      portfolioId,
      stock,
      purchaseMethod,
      initialPurchase,
      autoInvestConfig,
    } = body;

    // 유효성 검사
    if (!portfolioId || !stock) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 종목 마스터 저장
    const stockId = await saveStockMaster(stock);
    console.log(`✅ 종목 마스터 저장: ${stockId}`);

    // 동일 종목이 이미 있는지 확인
    const existingPosition = await findPositionBySymbol(userId, portfolioId, stock.symbol);
    
    if (existingPosition) {
      console.log(`⚠️ 동일 종목 발견: ${stock.symbol} - 기존 포지션에 병합합니다.`);
      
      // 기존 포지션에 새 거래 추가
      if (purchaseMethod === 'manual' && initialPurchase) {
        // 수동 매수 병합
        await fetch(`${request.nextUrl.origin}/api/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            portfolioId,
            positionId: existingPosition.id,
            type: 'buy',
            symbol: stock.symbol,
            shares: initialPurchase.shares,
            price: initialPurchase.price,
            amount: initialPurchase.amount || initialPurchase.shares * initialPurchase.price,
            date: initialPurchase.date,
            note: '추가 매수 (병합)',
          }),
        });
        
        // 포지션 업데이트
        await updatePositionAfterTransaction(userId, portfolioId, existingPosition.id!, {
          type: 'buy',
          shares: initialPurchase.shares,
          price: initialPurchase.price,
          date: initialPurchase.date,
        });
      } else if (purchaseMethod === 'auto' && autoInvestConfig) {
        // 자동 투자 병합
        const pricePerShare = parseFloat(body.purchasePrice) || 100;
        await generateAutoInvestTransactions(userId, portfolioId, existingPosition.id!, {
          symbol: stock.symbol,
          stockId: stock.symbol,
          frequency: autoInvestConfig.frequency,
          amount: autoInvestConfig.amount,
          startDate: autoInvestConfig.startDate,
          pricePerShare,
        });
      }
      
      const totals = await calculatePortfolioTotals(userId, portfolioId);
      
      return NextResponse.json({
        success: true,
        positionId: existingPosition.id,
        merged: true,
        message: '동일 종목이 기존 포지션에 병합되었습니다.',
        totals,
      });
    }

    // 포지션 생성 (신규)
    let positionData: any = {
      purchaseMethod,
    };

    if (purchaseMethod === 'manual' && initialPurchase) {
      // 수동 매수
      positionData.shares = initialPurchase.shares;
      positionData.averagePrice = initialPurchase.price;
      positionData.totalInvested = initialPurchase.amount || initialPurchase.shares * initialPurchase.price;
      positionData.firstPurchaseDate = initialPurchase.date;
    } else if (purchaseMethod === 'auto' && autoInvestConfig) {
      // 자동 투자
      positionData.shares = 0;
      positionData.averagePrice = 0;
      positionData.totalInvested = 0;
      positionData.autoInvestConfig = autoInvestConfig;
      positionData.firstPurchaseDate = autoInvestConfig.startDate;
    } else {
      return NextResponse.json(
        { error: '구매 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const positionId = await createPosition(
      userId,
      portfolioId,
      stock,
      positionData
    );

    // 초기 거래 기록 생성
    if (purchaseMethod === 'manual' && initialPurchase) {
      // 수동 매수: 단건 거래 기록
      await fetch(`${request.nextUrl.origin}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          portfolioId,
          positionId,
          type: 'buy',
          symbol: stock.symbol,
          shares: initialPurchase.shares,
          price: initialPurchase.price,
          amount: initialPurchase.amount || initialPurchase.shares * initialPurchase.price,
          date: initialPurchase.date,
          note: '초기 매수',
        }),
      });
    } else if (purchaseMethod === 'auto' && autoInvestConfig) {
      // 자동 투자: 시작일부터 오늘까지 정기 구매 거래 내역 생성
      const pricePerShare = parseFloat(body.purchasePrice) || 100; // 시작일 가격
      await generateAutoInvestTransactions(userId, portfolioId, positionId, {
        symbol: stock.symbol,
        stockId: stock.symbol,
        frequency: autoInvestConfig.frequency,
        amount: autoInvestConfig.amount,
        startDate: autoInvestConfig.startDate,
        pricePerShare,
      });
    }

    // 포트폴리오 총계 계산
    const totals = await calculatePortfolioTotals(userId, portfolioId);

    return NextResponse.json({
      success: true,
      positionId,
      totals,
    });
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '포지션 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/positions?portfolioId=xxx
 * 포트폴리오의 모든 포지션 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const positions = await getPortfolioPositions(userId, portfolioId);
    const totals = await calculatePortfolioTotals(userId, portfolioId);

    return NextResponse.json({
      positions,
      totals,
    });
  } catch (error) {
    console.error('Get positions error:', error);
    return NextResponse.json(
      { error: '포지션 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

