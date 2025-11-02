import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Loader2, AlertCircle, Calculator } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { formatInputDate } from '@/lib/utils/formatters';
import type { Position } from '@/types';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

interface SellStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  onSuccess?: () => void;
}

export function SellStockModal({ open, onOpenChange, portfolioId, onSuccess }: SellStockModalProps) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();

  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [loadingPositions, setLoadingPositions] = useState(false);

  const [sellDate, setSellDate] = useState(formatInputDate());
  const [sellPrice, setSellPrice] = useState('');
  const [sellShares, setSellShares] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [fee, setFee] = useState('0');
  const [tax, setTax] = useState('0');
  const [note, setNote] = useState('');

  const [historicalPriceLoading, setHistoricalPriceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const resetForm = () => {
    setSelectedPositionId('');
    setSelectedPosition(null);
    setSellDate(formatInputDate());
    setSellPrice('');
    setSellShares('');
    setExchangeRate('');
    setFee('0');
    setTax('0');
    setNote('');
    setError(null);
  };

  const fetchPositions = useCallback(async () => {
    try {
      if (!user) return;
      setLoadingPositions(true);
      const response = await fetch(`/api/positions?portfolioId=${portfolioId}&userId=${user.uid}`);
      if (!response.ok) return;
      const data = await response.json();
      setPositions(data.positions || []);
    } catch (err) {
      console.error('Failed to fetch positions for sell modal:', err);
    } finally {
      setLoadingPositions(false);
    }
  }, [portfolioId, user]);

  useEffect(() => {
    if (open && user) {
      fetchPositions();
    } else if (!open) {
      resetForm();
    }
  }, [open, user, fetchPositions]);

  useEffect(() => {
    const found = positions.find((pos) => pos.id === selectedPositionId) || null;
    setSelectedPosition(found || null);
    if (found) {
      setSellShares(found.shares > 0 ? found.shares.toFixed(4) : '');
      if (found.currency === 'KRW') {
        setExchangeRate('');
      }
    } else {
      setSellShares('');
    }
  }, [selectedPositionId, positions]);

  const canSellShares = useMemo(() => {
    if (!selectedPosition) return 0;
    return selectedPosition.shares;
  }, [selectedPosition]);

  // 자동 시세 조회
  useEffect(() => {
    const fetchHistoricalPrice = async () => {
      if (!selectedPosition || !sellDate) return;
      setHistoricalPriceLoading(true);
      try {
        const marketParam = selectedPosition.market ?? 'US';
        const response = await fetch(
          `/api/stocks/historical-price?symbol=${selectedPosition.symbol}&date=${sellDate}&method=manual&market=${marketParam}`
        );
        const data = await response.json();
        if (data.success && data.price) {
          const decimals = selectedPosition.currency === 'KRW' ? 0 : 2;
          setSellPrice(data.price.toFixed(decimals));
        }
      } catch (err) {
        console.warn('Failed to fetch historical price for sell modal:', err);
      } finally {
        setHistoricalPriceLoading(false);
      }
    };

    if (selectedPosition) {
      fetchHistoricalPrice();
    }
  }, [selectedPosition, sellDate]);

  // 환율 자동 조회 (미국 주식 매도 시)
  useEffect(() => {
    const fetchRate = async () => {
      if (!selectedPosition || selectedPosition.currency !== 'USD') {
        return;
      }
      try {
        const response = await fetch('/api/exchange-rate?date=' + sellDate);
        if (response.ok) {
          const data = await response.json();
          if (typeof data.rate === 'number') {
            setExchangeRate(data.rate.toString());
          }
        }
      } catch (err) {
        console.warn('Failed to fetch exchange rate for sell modal:', err);
      }
    };

    if (sellDate) {
      fetchRate();
    }
  }, [sellDate, selectedPosition]);

  const validate = (): string | null => {
    if (!selectedPosition) return '매도할 포지션을 선택해주세요.';
    if (!sellDate) return '매도 날짜를 입력해주세요.';
    const priceValue = parseFloat(sellPrice);
    if (!sellPrice || Number.isNaN(priceValue) || priceValue <= 0) {
      return '유효한 매도 가격을 입력해주세요.';
    }
    const sharesValue = parseFloat(sellShares);
    if (!sellShares || Number.isNaN(sharesValue) || sharesValue <= 0) {
      return '유효한 매도 주식 수를 입력해주세요.';
    }
    if (sharesValue > canSellShares) {
      return `보유 수량(${canSellShares.toFixed(4)}주)보다 많이 매도할 수 없습니다.`;
    }
    if (selectedPosition.currency === 'USD') {
      const rate = parseFloat(exchangeRate);
      if (Number.isNaN(rate) || rate <= 0) {
        return '유효한 환율을 입력해주세요.';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user || !selectedPosition) {
      setError('로그인이 필요합니다.');
      return;
    }

    try {
      setSubmitLoading(true);
      setError(null);

      const sharesValue = parseFloat(sellShares);
      const priceValue = parseFloat(sellPrice);
      const feeValue = parseFloat(fee) || 0;
      const taxValue = parseFloat(tax) || 0;
      const amount = sharesValue * priceValue;

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          portfolioId,
          positionId: selectedPosition.id,
          type: 'sell',
          symbol: selectedPosition.symbol,
          shares: sharesValue,
          price: priceValue,
          amount,
          fee: feeValue,
          tax: taxValue,
          date: sellDate,
          note: note.trim() || undefined,
          exchangeRate: selectedPosition.currency === 'USD' && exchangeRate ? parseFloat(exchangeRate) : undefined,
          currency: selectedPosition.currency,
          purchaseMethod: selectedPosition.purchaseMethod ?? 'manual',
          purchaseUnit: 'shares',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || '매도 거래 기록에 실패했습니다.');
      }

      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error('Sell transaction error:', err);
      setError(err instanceof Error ? err.message : '매도 거래 기록 중 오류가 발생했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const currency = selectedPosition?.currency === 'KRW' ? 'KRW' : 'USD';
  const sharesValue = sellShares ? parseFloat(sellShares) : 0;
  const priceValue = sellPrice ? parseFloat(sellPrice) : 0;
  const feeValue = fee ? parseFloat(fee) : 0;
  const taxValue = tax ? parseFloat(tax) : 0;
  const totalAmount = sharesValue * priceValue;
  const totalCost = totalAmount - (feeValue + taxValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>매도 거래 기록</DialogTitle>
          <DialogDescription>
            기존 보유 포지션을 선택하고 매도 거래를 기록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 포지션 선택 */}
          <div className="space-y-2">
            <Label>매도할 포지션</Label>
            <Select
              value={selectedPositionId}
              onValueChange={setSelectedPositionId}
              disabled={loadingPositions || positions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPositions ? '포지션 불러오는 중...' : '포지션 선택'} />
              </SelectTrigger>
              <SelectContent>
                {positions.length === 0 ? (
                  <SelectItem value="" disabled>
                    보유 중인 포지션이 없습니다.
                  </SelectItem>
                ) : (
                  positions.map((position) => (
                    <SelectItem key={position.id} value={position.id!}>
                      {position.symbol} · 평가 {formatAmount(position.totalValue, position.currency)} ({position.shares.toFixed(4)}주)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedPosition && (
              <p className="text-xs text-muted-foreground">
                보유 수량: {selectedPosition.shares.toFixed(4)}주 · 평균 단가 {formatAmount(selectedPosition.averagePrice, currency)}
              </p>
            )}
          </div>

          {/* 매도 입력 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sellDate">매도 날짜</Label>
              <Input
                id="sellDate"
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellPrice">매도 가격 ({currency})</Label>
              <Input
                id="sellPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
              {historicalPriceLoading && (
                <p className="text-xs text-muted-foreground">시세 불러오는 중...</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellShares">매도 주식 수</Label>
              <Input
                id="sellShares"
                type="number"
                step="0.0001"
                placeholder="0"
                value={sellShares}
                onChange={(e) => setSellShares(e.target.value)}
              />
              {selectedPosition && (
                <p className="text-xs text-muted-foreground">
                  매도 후 보유 예상: {(selectedPosition.shares - (parseFloat(sellShares) || 0)).toFixed(4)} 주
                </p>
              )}
            </div>
            {currency === 'USD' && (
              <div className="space-y-2">
                <Label htmlFor="sellExchangeRate">환율 (KRW/USD)</Label>
                <Input
                  id="sellExchangeRate"
                  type="number"
                  step="0.01"
                  placeholder="자동 조회"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sellFee">수수료 ({currency})</Label>
              <Input
                id="sellFee"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellTax">세금 ({currency})</Label>
              <Input
                id="sellTax"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellNote">메모 (선택)</Label>
            <Input
              id="sellNote"
              type="text"
              placeholder="거래와 관련된 메모를 입력하세요"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {selectedPosition && sharesValue > 0 && priceValue > 0 && (
            <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4" />
                <h4 className="font-semibold">거래 요약</h4>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">거래 금액</span>
                  <span className="font-medium">{formatAmount(totalAmount, currency)}</span>
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
                  <span className="font-semibold">정산 금액 (수수료·세금 제외)</span>
                  <span className="font-semibold">{formatAmount(totalCost, currency)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitLoading}
          >
            취소
          </Button>
          <Button
            disabled={submitLoading || loadingPositions || !selectedPosition}
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            매도 기록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
