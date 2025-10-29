"use client";

import { useState } from 'react';
import { StockSearch } from './StockSearch';
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
import { Loader2, AlertCircle } from 'lucide-react';
import type { Stock, PurchaseMethod, PurchaseUnit, AutoInvestFrequency } from '@/types';
import { formatInputDate } from '@/lib/utils/formatters';

interface AddStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  onSuccess?: () => void;
}

export function AddStockModal({ 
  open, 
  onOpenChange, 
  portfolioId,
  onSuccess 
}: AddStockModalProps) {
  const [step, setStep] = useState<'search' | 'details'>('search');
  const [selectedStock, setSelectedStock] = useState<Omit<Stock, 'id'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleStockSelect = (stock: Omit<Stock, 'id'>) => {
    setSelectedStock(stock);
    setStep('details');
    setError(null);
  };

  const handleBack = () => {
    setStep('search');
    setError(null);
  };

  const handleReset = () => {
    setStep('search');
    setSelectedStock(null);
    setPurchaseMethod('manual');
    setPurchaseUnit('shares');
    setPurchaseDate(formatInputDate());
    setPurchasePrice('');
    setShares('');
    setAmount('');
    setAutoFrequency('monthly');
    setAutoAmount('');
    setAutoStartDate(formatInputDate());
    setError(null);
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
          return '유효한 매수 금액을 입력해주세요.';
        }
      }
    } else {
      // 자동투자
      if (!autoAmount || parseFloat(autoAmount) <= 0) {
        return '유효한 투자 금액을 입력해주세요.';
      }
      if (!autoStartDate) {
        return '시작일을 입력해주세요.';
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
      // 포지션 생성 API 호출
      const positionData = {
        portfolioId,
        stock: selectedStock,
        purchaseMethod,
        ...(purchaseMethod === 'manual' ? {
          initialPurchase: {
            date: purchaseDate,
            price: parseFloat(purchasePrice),
            shares: purchaseUnit === 'shares' 
              ? parseFloat(shares) 
              : parseFloat(amount) / parseFloat(purchasePrice),
            amount: purchaseUnit === 'shares'
              ? parseFloat(shares) * parseFloat(purchasePrice)
              : parseFloat(amount),
            unit: purchaseUnit,
          }
        } : {
          autoInvestConfig: {
            frequency: autoFrequency,
            amount: parseFloat(autoAmount),
            startDate: autoStartDate,
            isActive: true,
          }
        }),
      };

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '종목 추가에 실패했습니다.');
      }

      // 성공
      handleReset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Add stock error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const calculatedShares = purchaseUnit === 'amount' && purchasePrice && amount
    ? parseFloat(amount) / parseFloat(purchasePrice)
    : null;

  const calculatedAmount = purchaseUnit === 'shares' && purchasePrice && shares
    ? parseFloat(shares) * parseFloat(purchasePrice)
    : null;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        handleReset();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' ? '종목 검색' : '매수 정보 입력'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' 
              ? '포트폴리오에 추가할 종목을 검색하세요.'
              : '종목의 매수 정보를 입력하세요.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
                      <h3 className="font-semibold text-lg">
                        {selectedStock.symbol}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedStock.name}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleBack}
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
                    <Label htmlFor="purchasePrice">매수 가격 ({selectedStock?.currency})</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                    />
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
                          주 단위 (정확한 주식 수량)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="amount" id="amount" />
                        <Label htmlFor="amount" className="font-normal cursor-pointer">
                          금액 단위 (투자 금액 기준)
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
                        step="0.0001"
                        placeholder="0"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                      />
                      {calculatedAmount !== null && (
                        <p className="text-sm text-muted-foreground">
                          총 금액: {calculatedAmount.toFixed(2)} {selectedStock?.currency}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="amount">매수 금액 ({selectedStock?.currency})</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      {calculatedShares !== null && (
                        <p className="text-sm text-muted-foreground">
                          주식 수: {calculatedShares.toFixed(4)} 주
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 자동 투자 */}
              {purchaseMethod === 'auto' && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="autoFrequency">투자 주기</Label>
                    <Select
                      value={autoFrequency}
                      onValueChange={(value) => setAutoFrequency(value as AutoInvestFrequency)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">매일</SelectItem>
                        <SelectItem value="weekly">매주</SelectItem>
                        <SelectItem value="biweekly">격주</SelectItem>
                        <SelectItem value="monthly">매월</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="autoAmount">투자 금액 ({selectedStock?.currency})</Label>
                    <Input
                      id="autoAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={autoAmount}
                      onChange={(e) => setAutoAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="autoStartDate">시작일</Label>
                    <Input
                      id="autoStartDate"
                      type="date"
                      value={autoStartDate}
                      onChange={(e) => setAutoStartDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'details' && (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                이전
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                추가
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

