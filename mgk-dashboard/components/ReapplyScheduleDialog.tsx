"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info } from 'lucide-react';
import type { AutoInvestSchedule } from '@/types';
import { formatInputDate, formatCurrency } from '@/lib/utils/formatters';

interface ReapplyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: AutoInvestSchedule | null;
  onConfirm: (data: {
    scheduleId: string;
    effectiveFrom: string;
    pricePerShare?: number;
  }) => Promise<void>;
  currency: 'USD' | 'KRW';
}

const FREQUENCY_LABELS = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  quarterly: '분기',
};

export function ReapplyScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onConfirm,
  currency,
}: ReapplyScheduleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    effectiveFrom: formatInputDate(),
    pricePerShare: '',
  });

  const handleConfirm = async () => {
    if (!schedule) return;

    if (!formData.effectiveFrom) {
      setError('적용 시작일을 선택해주세요.');
      return;
    }

    const priceValue = formData.pricePerShare
      ? parseFloat(formData.pricePerShare)
      : undefined;

    if (priceValue !== undefined && (Number.isNaN(priceValue) || priceValue <= 0)) {
      setError('유효한 기준 단가를 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onConfirm({
        scheduleId: schedule.id!,
        effectiveFrom: formData.effectiveFrom,
        pricePerShare: priceValue,
      });

      onOpenChange(false);
      setFormData({
        effectiveFrom: formatInputDate(),
        pricePerShare: '',
      });
    } catch (err) {
      console.error('Failed to reapply schedule:', err);
      setError(err instanceof Error ? err.message : '스케줄 재적용에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!schedule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>스케줄 재적용</DialogTitle>
          <DialogDescription>
            선택한 스케줄을 다시 활성화하고 거래 내역을 재생성합니다.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>재적용할 스케줄:</strong>
                </p>
                <p>
                  • 투자 금액: {formatCurrency(schedule.amount, currency)}
                </p>
                <p>
                  • 투자 주기: {FREQUENCY_LABELS[schedule.frequency]}
                </p>
                <p>
                  • 원래 적용 기간: {schedule.effectiveFrom}
                  {schedule.effectiveTo && ` ~ ${schedule.effectiveTo}`}
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="effectiveFrom">새 적용 시작일</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={formData.effectiveFrom}
              max={formatInputDate()}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))
              }
            />
            <p className="text-sm text-muted-foreground">
              이 날짜부터 현재까지의 자동 거래가 생성됩니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricePerShare">
              기준 단가 ({currency}) - 선택사항
            </Label>
            <Input
              id="pricePerShare"
              type="number"
              step="0.01"
              value={formData.pricePerShare}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, pricePerShare: e.target.value }))
              }
              placeholder="가격 조회 실패 시 사용할 fallback 가격"
            />
            <p className="text-sm text-muted-foreground">
              실시간 가격 조회에 실패할 경우 이 가격이 사용됩니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                재적용 중
              </>
            ) : (
              '재적용'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

