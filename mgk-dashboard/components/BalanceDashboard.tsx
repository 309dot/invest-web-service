/**
 * 잔액 대시보드 컴포넌트
 * 
 * 원화/달러 잔액 및 충전 관리
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';
import {
  Wallet,
  Plus,
  Minus,
  RefreshCw,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { formatCurrency, formatInputDate } from '@/lib/utils/formatters';

interface BalanceDashboardProps {
  portfolioId: string;
}

export function BalanceDashboard({ portfolioId }: BalanceDashboardProps) {
  const [balances, setBalances] = useState({ KRW: 0, USD: 0 });
  const [loading, setLoading] = useState(true);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 충전 폼
  const [chargeType, setChargeType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(formatInputDate());
  const [note, setNote] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [isExchange, setIsExchange] = useState(false);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/balance?portfolioId=${portfolioId}`);
      if (response.ok) {
        const data = await response.json();
        setBalances(data.balances);
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [portfolioId]);

  // 환율 자동 조회
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (isExchange) {
        try {
          const response = await fetch('/api/exchange-rate?date=' + date);
          if (response.ok) {
            const data = await response.json();
            setExchangeRate(data.rate.toString());
          }
        } catch (error) {
          console.error('Failed to fetch exchange rate:', error);
        }
      }
    };

    fetchExchangeRate();
  }, [isExchange, date]);

  const handleReset = () => {
    setChargeType('deposit');
    setCurrency('KRW');
    setAmount('');
    setDate(formatInputDate());
    setNote('');
    setExchangeRate('');
    setIsExchange(false);
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) {
      return '유효한 금액을 입력해주세요.';
    }
    if (!date) {
      return '날짜를 선택해주세요.';
    }
    if (isExchange && (!exchangeRate || parseFloat(exchangeRate) <= 0)) {
      return '유효한 환율을 입력해주세요.';
    }
    if (chargeType === 'withdrawal') {
      const currentBalance = balances[currency];
      if (parseFloat(amount) > currentBalance) {
        return `잔액이 부족합니다. (현재 잔액: ${formatCurrency(currentBalance, currency)})`;
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

    setChargeLoading(true);
    setError(null);

    try {
      const amountValue = parseFloat(amount);
      let convertedAmount: number | undefined;

      if (isExchange && exchangeRate) {
        const rate = parseFloat(exchangeRate);
        if (currency === 'KRW') {
          // 원화 -> 달러
          convertedAmount = amountValue / rate;
        } else {
          // 달러 -> 원화
          convertedAmount = amountValue * rate;
        }
      }

      const chargeData = {
        portfolioId,
        type: chargeType,
        currency,
        amount: amountValue,
        exchangeRate: isExchange ? parseFloat(exchangeRate) : undefined,
        convertedAmount,
        date,
        note,
      };

      const response = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chargeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '충전 기록에 실패했습니다.');
      }

      const result = await response.json();
      setBalances(result.balances);

      // 성공
      handleReset();
      setShowChargeModal(false);
    } catch (err) {
      console.error('Charge error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setChargeLoading(false);
    }
  };

  const calculatedConversion = isExchange && exchangeRate && amount
    ? currency === 'KRW'
      ? parseFloat(amount) / parseFloat(exchangeRate)
      : parseFloat(amount) * parseFloat(exchangeRate)
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              <CardTitle>잔액</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={fetchBalances}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setShowChargeModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                충전/출금
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* 원화 잔액 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">원화 (KRW)</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(balances.KRW, 'KRW')}
                </p>
              </div>

              {/* 달러 잔액 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">달러 (USD)</span>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(balances.USD, 'USD')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 충전/출금 모달 */}
      <Dialog open={showChargeModal} onOpenChange={(open) => {
        setShowChargeModal(open);
        if (!open) {
          handleReset();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>충전/출금</DialogTitle>
            <DialogDescription>
              잔액을 충전하거나 출금합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 충전/출금 선택 */}
            <div className="space-y-3">
              <Label>유형</Label>
              <RadioGroup
                value={chargeType}
                onValueChange={(value) => setChargeType(value as 'deposit' | 'withdrawal')}
              >
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="deposit" id="deposit" />
                    <Label htmlFor="deposit" className="font-normal cursor-pointer flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-500" />
                      충전 (입금)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="withdrawal" id="withdrawal" />
                    <Label htmlFor="withdrawal" className="font-normal cursor-pointer flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-500" />
                      출금
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* 통화 선택 */}
            <div className="space-y-2">
              <Label>통화</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as 'KRW' | 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KRW">원화 (KRW)</SelectItem>
                  <SelectItem value="USD">달러 (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 금액 */}
            <div className="space-y-2">
              <Label htmlFor="amount">금액 ({currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* 날짜 */}
            <div className="space-y-2">
              <Label htmlFor="date">날짜</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* 환전 옵션 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="exchange"
                checked={isExchange}
                onChange={(e) => setIsExchange(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="exchange" className="font-normal cursor-pointer flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                환전 (반대 통화에서 차감)
              </Label>
            </div>

            {/* 환율 */}
            {isExchange && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <Label htmlFor="exchangeRate">환율 (KRW/USD)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  placeholder="자동 조회"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
                {calculatedConversion !== null && (
                  <p className="text-sm text-muted-foreground">
                    환전 후: {formatCurrency(
                      calculatedConversion,
                      currency === 'KRW' ? 'USD' : 'KRW'
                    )}
                  </p>
                )}
              </div>
            )}

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="note">메모 (선택사항)</Label>
              <Input
                id="note"
                type="text"
                placeholder="충전 관련 메모"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChargeModal(false)}
              disabled={chargeLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={chargeLoading}
              className={chargeType === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {chargeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {chargeType === 'deposit' ? '충전' : '출금'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

