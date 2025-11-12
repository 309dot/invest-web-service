"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatInputDate } from '@/lib/utils/formatters';
import { isValidDate, isPositiveNumber, isTodayOrPastDate } from '@/lib/utils/validators';
import { addDocument } from '@/lib/firestore';
import type { DollarChargeForm, ManualPurchaseForm } from '@/types';

type SubmissionMessage = { type: 'success' | 'error'; text: string };

export function ManualEntry() {
  const [activeTab, setActiveTab] = useState('charge');
  const [message, setMessage] = useState<SubmissionMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 달러 충전 폼
  const [chargeForm, setChargeForm] = useState({
    chargeDate: formatInputDate(),
    amount: '',
    exchangeRate: '',
    fee: '',
    memo: '',
  });

  // 매수 기록 폼
  const [purchaseForm, setPurchaseForm] = useState({
    date: formatInputDate(),
    price: '',
    purchaseAmount: '',
  });

  const chargeSummary = useMemo(() => {
    if (!chargeForm.amount || !chargeForm.exchangeRate) return null;

    const amount = parseFloat(chargeForm.amount);
    const rate = parseFloat(chargeForm.exchangeRate);
    const fee = chargeForm.fee ? parseFloat(chargeForm.fee) : 0;

    if ([amount, rate, fee].some((value) => Number.isNaN(value))) {
      return null;
    }

    const krwAmount = amount * rate;
    const netKrwAmount = krwAmount - fee;

    return {
      amount,
      rate,
      fee,
      krwAmount,
      netKrwAmount,
    };
  }, [chargeForm]);

  const handleChargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setMessage(null);

    if (!isValidDate(chargeForm.chargeDate) || !isTodayOrPastDate(chargeForm.chargeDate)) {
      setMessage({ type: 'error', text: '유효한 날짜를 입력하세요 (오늘 또는 과거 날짜)' });
      return;
    }

    const amount = parseFloat(chargeForm.amount);
    const rate = parseFloat(chargeForm.exchangeRate);
    const fee = parseFloat(chargeForm.fee);

    if ([amount, rate, fee].some((value) => Number.isNaN(value))) {
      setMessage({ type: 'error', text: '모든 금액에 올바른 숫자를 입력하세요' });
      return;
    }

    if (!isPositiveNumber(amount) || !isPositiveNumber(rate) || !isPositiveNumber(fee)) {
      setMessage({ type: 'error', text: '모든 금액은 0보다 커야 합니다' });
      return;
    }

    const memo = chargeForm.memo.trim();
    const payload: (DollarChargeForm & { krwAmount: number }) = {
      chargeDate: chargeForm.chargeDate,
      amount,
      exchangeRate: rate,
      fee,
      krwAmount: chargeSummary?.krwAmount ?? amount * rate,
      ...(memo ? { memo } : {}),
    };

    setIsSubmitting(true);

    try {
      await addDocument('dollarCharges', payload);
      setMessage({ type: 'success', text: '✅ 달러 충전 기록이 저장되었습니다!' });
      setChargeForm({
        chargeDate: formatInputDate(),
        amount: '',
        exchangeRate: '',
        fee: '',
        memo: '',
      });
    } catch (error) {
      console.error('달러 충전 저장 실패:', error);
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Firebase')
            ? 'Firebase 설정을 확인해주세요. 환경 변수를 세팅한 뒤 다시 시도하세요.'
            : error.message
          : '알 수 없는 오류가 발생했습니다.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const purchaseSummary = useMemo(() => {
    if (!purchaseForm.price || !purchaseForm.purchaseAmount) return null;

    const price = parseFloat(purchaseForm.price);
    const purchaseAmount = parseFloat(purchaseForm.purchaseAmount);

    if ([price, purchaseAmount].some((value) => Number.isNaN(value))) {
      return null;
    }

    const shares = purchaseAmount / price;

    return {
      price,
      purchaseAmount,
      shares,
      totalValue: shares * price,
    };
  }, [purchaseForm]);

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setMessage(null);

    if (!isValidDate(purchaseForm.date) || !isTodayOrPastDate(purchaseForm.date)) {
      setMessage({ type: 'error', text: '유효한 날짜를 입력하세요 (오늘 또는 과거 날짜)' });
      return;
    }

    const price = parseFloat(purchaseForm.price);
    const purchaseAmount = parseFloat(purchaseForm.purchaseAmount);

    if ([price, purchaseAmount].some((value) => Number.isNaN(value))) {
      setMessage({ type: 'error', text: '주가와 매수 금액에 올바른 숫자를 입력하세요' });
      return;
    }

    if (!isPositiveNumber(price) || !isPositiveNumber(purchaseAmount)) {
      setMessage({ type: 'error', text: '주가와 매수 금액은 0보다 커야 합니다' });
      return;
    }

    const shares = purchaseAmount / price;

    const payload: (ManualPurchaseForm & { shares: number; totalValue: number }) = {
      date: purchaseForm.date,
      price,
      purchaseAmount,
      shares,
      totalValue: shares * price,
    };

    setIsSubmitting(true);

    try {
      await addDocument('manualPurchases', payload);
      setMessage({ type: 'success', text: '✅ 매수 기록이 저장되었습니다!' });
      setPurchaseForm({
        date: formatInputDate(),
        price: '',
        purchaseAmount: '',
      });
    } catch (error) {
      console.error('매수 기록 저장 실패:', error);
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Firebase')
            ? 'Firebase 설정을 확인해주세요. 환경 변수를 세팅한 뒤 다시 시도하세요.'
            : error.message
          : '알 수 없는 오류가 발생했습니다.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>데이터 수동 입력</CardTitle>
        <CardDescription>
          달러 충전 및 매수 기록을 직접 입력할 수 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message && (
          <Alert
            className={`mb-4 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
            role="status"
            aria-live="polite"
          >
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="charge">달러 충전</TabsTrigger>
            <TabsTrigger value="purchase">매수 기록</TabsTrigger>
          </TabsList>

          {/* 달러 충전 탭 */}
          <TabsContent value="charge">
            <form onSubmit={handleChargeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">충전 날짜 *</label>
                <input
                  type="date"
                  value={chargeForm.chargeDate}
                  onChange={(e) => setChargeForm({ ...chargeForm, chargeDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">충전 금액 (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={chargeForm.amount}
                    onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                    placeholder="500"
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">환율 (KRW) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={chargeForm.exchangeRate}
                    onChange={(e) => setChargeForm({ ...chargeForm, exchangeRate: e.target.value })}
                    placeholder="1340"
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">수수료 (KRW) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={chargeForm.fee}
                  onChange={(e) => setChargeForm({ ...chargeForm, fee: e.target.value })}
                  placeholder="2500"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">메모 (선택)</label>
                <input
                  type="text"
                  value={chargeForm.memo}
                  onChange={(e) => setChargeForm({ ...chargeForm, memo: e.target.value })}
                  placeholder="토스 충전"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {chargeSummary && (
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm text-muted-foreground">
                    총 원화 환산: <Badge variant="secondary">₩{chargeSummary.krwAmount.toLocaleString()}</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    수수료 차감 후: <Badge variant="outline">₩{chargeSummary.netKrwAmount.toLocaleString()}</Badge>
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? '충전 기록 저장 중...' : '충전 기록 저장'}
              </Button>
            </form>
          </TabsContent>

          {/* 매수 기록 탭 */}
          <TabsContent value="purchase">
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">매수 날짜 *</label>
                <input
                  type="date"
                  value={purchaseForm.date}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">주가 (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseForm.price}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, price: e.target.value })}
                    placeholder="520.50"
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">매수 금액 (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseForm.purchaseAmount}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseAmount: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
              </div>

              {purchaseSummary && (
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm text-muted-foreground">
                    매수 주식 수: <Badge variant="secondary">{purchaseSummary.shares.toFixed(6)} 주</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    평가 금액: <Badge variant="outline">{purchaseSummary.totalValue.toFixed(2)} USD</Badge>
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? '매수 기록 저장 중...' : '매수 기록 저장'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
