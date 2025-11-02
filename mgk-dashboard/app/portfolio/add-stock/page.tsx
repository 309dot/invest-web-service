"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { StockSearch } from '@/components/StockSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import type { Stock, PurchaseMethod, PurchaseUnit, AutoInvestFrequency } from '@/types';
import { formatInputDate } from '@/lib/utils/formatters';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';

function AddStockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const derivedPortfolioId = deriveDefaultPortfolioId(user?.uid);
  const portfolioId = searchParams.get('portfolioId') || derivedPortfolioId;

  const [step, setStep] = useState<'search' | 'details'>('search');
  const [selectedStock, setSelectedStock] = useState<Omit<Stock, 'id'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // 구매 정보
  const [purchaseMethod, setPurchaseMethod] = useState<PurchaseMethod>('manual');
  const [purchaseUnit, setPurchaseUnit] = useState<PurchaseUnit>('shares');
  const [purchaseDate, setPurchaseDate] = useState(formatInputDate());
  const [purchasePrice, setPurchasePrice] = useState('');
  const [shares, setShares] = useState('');
  const [amount, setAmount] = useState('');

  // 자동투자 설정
  const [autoFrequency, setAutoFrequency] = useState<AutoInvestFrequency>('monthly');
  const [autoAmount, setAutoAmount] = useState('');
  const [autoStartDate, setAutoStartDate] = useState(formatInputDate());

  // 날짜 변경 시 자동으로 가격 불러오기
  useEffect(() => {
    const fetchHistoricalPrice = async () => {
      // 수동 구매: purchaseDate 기준, 자동 구매: autoStartDate 기준
      const dateToFetch = purchaseMethod === 'manual' ? purchaseDate : autoStartDate;
      
      console.log('🔍 Price fetch check:', {
        selectedStock: selectedStock?.symbol,
        dateToFetch,
        purchaseMethod,
        market: selectedStock?.market,
      });
      
      if (!selectedStock || !dateToFetch) {
        console.log('⚠️ Missing stock or date');
        return;
      }

      console.log('📡 Fetching price from API...');
      setLoadingPrice(true);
      try {
        const marketParam = selectedStock.market ?? 'US';
        const url = `/api/stocks/historical-price?symbol=${selectedStock.symbol}&date=${dateToFetch}&method=${purchaseMethod}&market=${marketParam}`;
        console.log('API URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();

        console.log('📊 Historical price response:', data);

        if (data.success && data.price) {
          const decimals = selectedStock.currency === 'KRW' ? 0 : 2;
          setPurchasePrice(data.price.toFixed(decimals));
          console.log(`✅ 가격 자동 입력 성공: ${data.price} (${data.note})`);
        } else {
          console.error('❌ 가격 조회 실패:', data.error);
        }
      } catch (err) {
        console.error('❌ Failed to fetch historical price:', err);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchHistoricalPrice();
  }, [purchaseDate, autoStartDate, selectedStock, purchaseMethod]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleStockSelect = (stock: Omit<Stock, 'id'>) => {
    setSelectedStock(stock);
    setStep('details');
    setError(null);
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('search');
      setError(null);
    } else {
      router.back();
    }
  };

  const validateForm = (): string | null => {
    if (!selectedStock) {
      return '종목을 선택해주세요.';
    }

    if (purchaseMethod === 'manual') {
      if (!purchaseDate) {
        return '매수 날짜를 입력해주세요.';
      }
      if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
        return '유효한 매수 가격을 입력해주세요.';
      }
      if (purchaseUnit === 'shares') {
        if (!shares || parseFloat(shares) <= 0) {
          return '유효한 주식 수를 입력해주세요.';
        }
      } else {
        if (!amount || parseFloat(amount) <= 0) {
          return '유효한 금액을 입력해주세요.';
        }
      }
    } else {
      if (!autoAmount || parseFloat(autoAmount) <= 0) {
        return '유효한 정기 투자 금액을 입력해주세요.';
      }
      if (!autoStartDate) {
        return '시작 날짜를 입력해주세요.';
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!selectedStock || !user) {
        throw new Error('종목 또는 사용자 정보가 없습니다.');
      }

      // 1. 종목 마스터에 저장
      const stockMasterResponse = await fetch('/api/stocks/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedStock),
      });

      if (!stockMasterResponse.ok) {
        throw new Error('종목 마스터 저장 실패');
      }

      const stockMasterData = await stockMasterResponse.json();
      const stockId = stockMasterData.stockId;

      // 2. 포지션 생성
      const calculatedShares = purchaseMethod === 'manual' && purchaseUnit === 'shares' 
        ? parseFloat(shares)
        : purchaseMethod === 'manual' && purchaseUnit === 'amount'
        ? parseFloat(amount) / parseFloat(purchasePrice)
        : 0;

      const positionData = {
        userId: user.uid,
        portfolioId: portfolioId,
        stock: selectedStock,
        purchaseMethod,
        initialPurchase: purchaseMethod === 'manual' ? {
          shares: calculatedShares,
          price: parseFloat(purchasePrice),
          amount: purchaseUnit === 'shares'
            ? calculatedShares * parseFloat(purchasePrice)
            : parseFloat(amount),
          date: purchaseDate,
        } : undefined,
        autoInvestConfig: purchaseMethod === 'auto' ? {
          enabled: true,
          frequency: autoFrequency,
          amount: parseFloat(autoAmount),
          startDate: autoStartDate,
        } : undefined,
      };

      const positionResponse = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positionData),
      });

      if (!positionResponse.ok) {
        const errorData = await positionResponse.json();
        console.error('Position creation error:', errorData);
        throw new Error(errorData.error || '포지션 생성 실패');
      }

      const positionResult = await positionResponse.json();

      // 성공 시 대시보드로 이동
      router.push(`/?portfolioId=${portfolioId}`);
    } catch (err: any) {
      console.error('종목 추가 실패:', err);
      setError(err.message || '종목 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {step === 'details' ? '종목 재선택' : '돌아가기'}
            </Button>
            <h1 className="text-3xl font-bold">
              {step === 'search' ? '종목 검색' : '매수 정보 입력'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {step === 'search' 
                ? '포트폴리오에 추가할 종목을 검색하세요.'
                : '종목의 매수 정보를 입력하세요.'
              }
            </p>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="pt-6">
              {step === 'search' ? (
                <div className="space-y-4">
                  <StockSearch 
                    onSelect={handleStockSelect}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 선택된 종목 정보 */}
                  {selectedStock && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {selectedStock.symbol}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedStock.name}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setStep('search')}
                        >
                          변경
                        </Button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* 구매 방식 선택 */}
                  <div className="space-y-3">
                    <Label>구매 방식</Label>
                    <RadioGroup
                      value={purchaseMethod}
                      onValueChange={(value) => setPurchaseMethod(value as PurchaseMethod)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="manual" />
                        <Label htmlFor="manual" className="font-normal cursor-pointer">
                          일괄 구매 (원하는 시점에 수동 매수)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="auto" id="auto" />
                        <Label htmlFor="auto" className="font-normal cursor-pointer">
                          자동 구매 (정기 적립식 투자)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* 수동 매수 */}
                  {purchaseMethod === 'manual' && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="purchaseDate">매수 날짜</Label>
                        <Input
                          id="purchaseDate"
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purchasePrice">
                          매수 가격 ({selectedStock?.currency})
                          {selectedStock?.market === 'US' && loadingPrice && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                              가격 조회 중...
                            </span>
                          )}
                        </Label>
                        <Input
                          id="purchasePrice"
                          type="number"
                          step={selectedStock?.currency === 'KRW' ? 1 : 0.01}
                          placeholder="0.00"
                          value={purchasePrice}
                          onChange={(e) => setPurchasePrice(e.target.value)}
                          disabled={loadingPrice}
                        />
                        <p className="text-xs text-muted-foreground">
                          💡 날짜 선택 시 실제 종가가 자동으로 입력됩니다.
                        </p>
                      </div>

                      {/* 구매 단위 선택 */}
                      <div className="space-y-3">
                        <Label>구매 단위</Label>
                        <RadioGroup
                          value={purchaseUnit}
                          onValueChange={(value) => setPurchaseUnit(value as PurchaseUnit)}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="shares" id="shares" />
                            <Label htmlFor="shares" className="font-normal cursor-pointer">
                              주식 수로 입력
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="amount" id="amount" />
                            <Label htmlFor="amount" className="font-normal cursor-pointer">
                              금액으로 입력
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {purchaseUnit === 'shares' ? (
                        <div className="space-y-2">
                          <Label htmlFor="shares">주식 수</Label>
                          <Input
                            id="shares"
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="amount">금액 ({selectedStock?.currency})</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 자동 투자 */}
                  {purchaseMethod === 'auto' && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="autoStartDate">시작 날짜</Label>
                        <Input
                          id="autoStartDate"
                          type="date"
                          value={autoStartDate}
                          onChange={(e) => setAutoStartDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purchasePrice">
                          시작일 매수 가격 ({selectedStock?.currency})
                          {selectedStock?.market === 'US' && loadingPrice && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                              가격 조회 중...
                            </span>
                          )}
                        </Label>
                        <Input
                          id="purchasePrice"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={purchasePrice}
                          onChange={(e) => setPurchasePrice(e.target.value)}
                          disabled={loadingPrice}
                        />
                        {selectedStock?.market === 'US' && (
                          <p className="text-xs text-muted-foreground">
                            💡 시작 날짜 선택 시 시장가(시가+종가 평균)가 자동으로 입력됩니다.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="autoFrequency">투자 주기</Label>
                        <Select
                          value={autoFrequency}
                          onValueChange={(value) => setAutoFrequency(value as AutoInvestFrequency)}
                        >
                          <SelectTrigger id="autoFrequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">매일</SelectItem>
                            <SelectItem value="weekly">매주</SelectItem>
                            <SelectItem value="monthly">매월</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="autoAmount">회당 투자 금액 ({selectedStock?.currency})</Label>
                        <Input
                          id="autoAmount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={autoAmount}
                          onChange={(e) => setAutoAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('search')}
                      className="flex-1"
                    >
                      이전
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          추가
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AddStockPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <AddStockContent />
    </Suspense>
  );
}

