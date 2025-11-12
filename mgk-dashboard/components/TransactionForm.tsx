/**
 * 거래 입력 폼 컴포넌트
 * 
 * 기존 포지션에 매수/매도 거래 추가
 */

"use client";

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import type { Position } from '@/types';
import { formatInputDate, formatInputTime } from '@/lib/utils/formatters';
import {
  adjustToNextTradingDay,
  determineMarketFromContext,
  formatDate as formatMarketDate,
  getMarketToday,
  isFutureTradingDate,
  isTradingDay,
} from '@/lib/utils/tradingCalendar';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { useAuth } from '@/lib/contexts/AuthContext';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
  portfolioId: string;
  onSuccess?: () => void;
}

export function TransactionForm({
  open,
  onOpenChange,
  position,
  portfolioId,
  onSuccess,
}: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { formatAmount } = useCurrency();

  // 거래 정보
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [date, setDate] = useState(formatInputDate());
  const [time, setTime] = useState(formatInputTime());
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [shares, setShares] = useState('');
  const [fee, setFee] = useState('0');
  const [tax, setTax] = useState('0');
  const [note, setNote] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [tradingNotice, setTradingNotice] = useState<string | null>(null);

  // 환율 자동 조회
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate?date=' + date);
        if (response.ok) {
          const data = await response.json();
          setExchangeRate(data.rate.toString());
        }
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
      }
    };

    if (date) {
      fetchExchangeRate();
    }
  }, [date]);

  const handleReset = () => {
    setTransactionType('buy');
    setDate(formatInputDate());
    setPrice('');
    setPriceTouched(false);
    setPriceLoading(false);
    setShares('');
    setFee('0');
    setTax('0');
    setNote('');
    setExchangeRate('');
    setTime(formatInputTime());
    setError(null);
  };

  const marketCode = determineMarketFromContext(position.market, position.currency, position.symbol);

  const validateForm = (): string | null => {
    if (!date) {
      return '거래 날짜를 입력해주세요.';
    }
    if (!isTradingDay(date, marketCode)) {
      const nextTrading = formatMarketDate(adjustToNextTradingDay(date, marketCode));
      return `선택한 날짜는 휴장일입니다. 거래일 (${nextTrading})을 선택해주세요.`;
    }
    if (isFutureTradingDate(date, marketCode)) {
      const today = formatMarketDate(getMarketToday(marketCode));
      return `미래 날짜에는 거래를 기록할 수 없습니다. ${today} 이전 날짜를 선택해주세요.`;
    }
    if (!price || parseFloat(price) <= 0) {
      return '유효한 거래 가격을 입력해주세요.';
    }
    if (!time) {
      return '거래 시간을 입력해주세요.';
    }
    if (!shares || parseFloat(shares) <= 0) {
      return '유효한 주식 수를 입력해주세요.';
    }
    if (transactionType === 'sell') {
      const sellShares = parseFloat(shares);
      if (sellShares > position.shares) {
        return `보유 주식 수(${position.shares.toFixed(6)})보다 많이 매도할 수 없습니다.`;
      }
    }
    if (parseFloat(fee) < 0 || parseFloat(tax) < 0) {
      return '수수료와 세금은 0 이상이어야 합니다.';
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
      if (!user) {
        setError('로그인이 필요합니다.');
        return;
      }

      if (!position.id) {
        console.error('Position ID is missing:', position);
        setError('포지션 ID가 없습니다. 페이지를 새로고침하세요.');
        return;
      }

      if (!portfolioId) {
        console.error('Portfolio ID is missing');
        setError('포트폴리오 ID가 없습니다.');
        return;
      }

      const sharesValue = parseFloat(shares);
      const priceValue = parseFloat(price);
      const feeValue = parseFloat(fee);
      const taxValue = parseFloat(tax);
      const amount = sharesValue * priceValue;

      const executedAtIso = new Date(`${date}T${time || '00:00'}:00`).toISOString();

      const transactionData = {
        userId: user.uid,
        portfolioId,
        positionId: position.id,
        type: transactionType,
        symbol: position.symbol,
        shares: sharesValue,
        price: priceValue,
        amount,
        fee: feeValue,
        tax: taxValue,
        date,
        note,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : undefined,
        currency: currency,
        executedAt: executedAtIso,
      };

      console.log('📤 Sending transaction:', transactionData);

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Transaction API error:', errorData);
        throw new Error(errorData.error || '거래 기록에 실패했습니다.');
      }

      // 성공
      handleReset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const currency: 'USD' | 'KRW' = position.currency === 'KRW'
    ? 'KRW'
    : position.currency === 'USD'
    ? 'USD'
    : position.symbol.match(/^[0-9]/)
    ? 'KRW'
    : 'USD';

  useEffect(() => {
    if (transactionType === 'sell') {
      setPriceTouched(false);
    }
  }, [transactionType]);

  useEffect(() => {
    if (!open) return;
    if (transactionType !== 'sell') return;
    if (!position.symbol || !date) return;
    if (priceTouched && price) return;

    let cancelled = false;

    const fetchSellPrice = async () => {
      try {
        setPriceLoading(true);
        const marketParam = position.market ?? 'US';
        const response = await fetch(
          `/api/stocks/historical-price?symbol=${position.symbol}&date=${date}&method=sell&market=${marketParam}`
        );
        const data = await response.json();
        if (!cancelled && data.success && data.price) {
          const decimals = currency === 'KRW' ? 0 : 2;
          setPrice(data.price.toFixed(decimals));
          setPriceTouched(false);
        }
      } catch (error) {
        console.error('Failed to fetch sell price:', error);
      } finally {
        if (!cancelled) {
          setPriceLoading(false);
        }
      }
    };

    fetchSellPrice();

    return () => {
      cancelled = true;
    };
  }, [open, transactionType, position.symbol, position.market, date, priceTouched, price, currency]);

  useEffect(() => {
    if (!date) {
      return;
    }

    const normalizedMarket = marketCode;

    if (!isTradingDay(date, normalizedMarket)) {
      const adjusted = formatMarketDate(adjustToNextTradingDay(date, normalizedMarket));
      if (adjusted !== date) {
        setDate(adjusted);
        setTradingNotice(`휴장일로 인해 거래일을 ${adjusted}로 자동 조정했습니다.`);
      }
      return;
    }

    if (isFutureTradingDate(date, normalizedMarket)) {
      const todayString = formatMarketDate(getMarketToday(normalizedMarket));
      if (todayString !== date) {
        setDate(todayString);
        setTradingNotice(`미래 날짜는 기록할 수 없어 ${todayString}로 조정했습니다.`);
      }
      return;
    }

    setTradingNotice(null);
  }, [date, marketCode]);

  // 계산된 값
  const sharesValue = shares ? parseFloat(shares) : 0;
  const priceValue = price ? parseFloat(price) : 0;
  const feeValue = fee ? parseFloat(fee) : 0;
  const taxValue = tax ? parseFloat(tax) : 0;
  const amount = sharesValue * priceValue;
  const totalCost = transactionType === 'buy'
    ? amount + feeValue + taxValue
    : Math.max(amount - feeValue - taxValue, 0);

  // 예상 포지션 계산
  const predictedShares = transactionType === 'buy' 
    ? position.shares + sharesValue 
    : position.shares - sharesValue;

  const predictedAveragePrice = transactionType === 'buy'
    ? (position.shares * position.averagePrice + amount) / predictedShares
    : position.averagePrice; // 매도 시 평균가는 유지

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        handleReset();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>거래 입력</DialogTitle>
          <DialogDescription>
            {position.symbol}의 매수/매도 거래를 기록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 현재 포지션 정보 */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">종목</p>
                <p className="font-semibold">{position.symbol}</p>
              </div>
              <div>
                <p className="text-muted-foreground">보유 수량</p>
                <p className="font-medium">{position.shares.toFixed(6)} 주</p>
              </div>
              <div>
                <p className="text-muted-foreground">평균 단가</p>
                <p className="font-medium">{formatAmount(position.averagePrice, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">투자 금액</p>
                <p className="font-medium">{formatAmount(position.totalInvested, currency)}</p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 거래 타입 선택 */}
          <div className="space-y-3">
            <Label>거래 유형</Label>
            <RadioGroup
              value={transactionType}
              onValueChange={(value) => setTransactionType(value as 'buy' | 'sell')}
            >
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="buy" id="buy" />
                  <Label htmlFor="buy" className="font-normal cursor-pointer flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    매수
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sell" id="sell" />
                  <Label htmlFor="sell" className="font-normal cursor-pointer flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    매도
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 거래 날짜 */}
            <div className="space-y-2">
              <Label htmlFor="date">거래 날짜</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {tradingNotice && (
                <p className="text-xs text-muted-foreground">{tradingNotice}</p>
              )}
            </div>

          {/* 거래 시간 */}
          <div className="space-y-2">
            <Label htmlFor="time">거래 시간</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

            {/* 거래 가격 */}
            <div className="space-y-2">
              <Label htmlFor="price">거래 가격 ({currency})</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceTouched(true);
                }}
              />
              {transactionType === 'sell' && priceLoading && (
                <p className="text-xs text-muted-foreground">가격 불러오는 중...</p>
              )}
            </div>

            {/* 주식 수 */}
            <div className="space-y-2">
              <Label htmlFor="shares">주식 수</Label>
              <Input
                id="shares"
                type="number"
                step="0.0001"
                placeholder="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
              />
              {transactionType === 'sell' && sharesValue > 0 && (
                <p className="text-xs text-muted-foreground">
                  거래 후 보유: {(position.shares - sharesValue).toFixed(6)} 주
                </p>
              )}
            </div>

            {/* 환율 */}
            {currency === 'USD' && (
              <div className="space-y-2">
                <Label htmlFor="exchangeRate">환율 (KRW/USD)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  placeholder="자동 조회"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
            )}

            {/* 수수료 */}
            <div className="space-y-2">
              <Label htmlFor="fee">수수료 ({currency})</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>

            {/* 세금 */}
            <div className="space-y-2">
              <Label htmlFor="tax">세금 ({currency})</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="note">메모 (선택사항)</Label>
            <Input
              id="note"
              type="text"
              placeholder="거래 관련 메모"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* 계산 요약 */}
          {sharesValue > 0 && priceValue > 0 && (
            <div className="p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4" />
                <h4 className="font-semibold">거래 요약</h4>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">거래 금액</span>
                  <span className="font-medium">{formatAmount(amount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">수수료</span>
                  <span className="font-medium">{formatAmount(feeValue, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">세금</span>
                  <span className="font-medium">{formatAmount(taxValue, currency)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">
                    {transactionType === 'buy' ? '총 지출 금액' : '순 매도 금액'}
                  </span>
                  <span className="font-semibold">{formatAmount(totalCost, currency)}</span>
                </div>
                {currency === 'USD' && exchangeRate && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">원화 환산</span>
                    <span className="text-muted-foreground">
                      ₩{(totalCost * parseFloat(exchangeRate)).toLocaleString('ko-KR')}
                    </span>
                  </div>
                )}
              </div>

              {transactionType === 'buy' && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">예상 평균 단가</span>
                    <span className="font-medium text-primary">
                      {formatAmount(predictedAveragePrice, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">거래 후 보유</span>
                    <span className="font-medium">{predictedShares.toFixed(6)} 주</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className={transactionType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {transactionType === 'buy' ? '매수 기록' : '매도 기록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

