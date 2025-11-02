"use client";

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { AutoInvestFrequency, AutoInvestSchedule } from '@/types';
import { formatInputDate } from '@/lib/utils/formatters';

interface AutoInvestScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: AutoInvestSchedule | null;
  onSave: (data: {
    scheduleId: string;
    frequency?: AutoInvestFrequency;
    amount?: number;
    effectiveFrom?: string;
    note?: string;
    regenerateTransactions: boolean;
  }) => Promise<void>;
  currency: 'USD' | 'KRW';
}

const FREQUENCY_LABELS: Record<AutoInvestFrequency, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  quarterly: '분기',
};

export function AutoInvestScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSave,
  currency,
}: AutoInvestScheduleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    frequency: 'monthly' as AutoInvestFrequency,
    amount: '',
    effectiveFrom: '',
    note: '',
    regenerateTransactions: false,
  });

  useEffect(() => {
    if (schedule) {
      setFormData({
        frequency: schedule.frequency,
        amount: schedule.amount.toString(),
        effectiveFrom: schedule.effectiveFrom,
        note: schedule.note || '',
        regenerateTransactions: false,
      });
    }
  }, [schedule]);

  const handleSave = async () => {
    if (!schedule) return;

    const amountValue = parseFloat(formData.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setError('유효한 투자 금액을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        scheduleId: schedule.id!,
        frequency: formData.frequency,
        amount: amountValue,
        effectiveFrom: formData.effectiveFrom,
        note: formData.note,
        regenerateTransactions: formData.regenerateTransactions,
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setError(err instanceof Error ? err.message : '스케줄 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const effectiveFromChanged = schedule && formData.effectiveFrom !== schedule.effectiveFrom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>자동 투자 스케줄 수정</DialogTitle>
          <DialogDescription>
            스케줄 정보를 수정할 수 있습니다. 적용 시작일을 변경하면 거래 내역이 재생성됩니다.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">투자 주기</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, frequency: value as AutoInvestFrequency }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">매일</SelectItem>
                <SelectItem value="weekly">매주</SelectItem>
                <SelectItem value="biweekly">격주</SelectItem>
                <SelectItem value="monthly">매월</SelectItem>
                <SelectItem value="quarterly">분기</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">투자 금액 ({currency})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="예: 10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveFrom">적용 시작일</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={formData.effectiveFrom}
              max={formatInputDate()}
              onChange={(e) => setFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
            />
            {effectiveFromChanged && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  적용 시작일이 변경되었습니다. 이 날짜 이후의 자동 거래가 재생성됩니다.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">메모 (선택)</Label>
            <Input
              id="note"
              type="text"
              value={formData.note}
              onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="변경 이유를 남겨주세요"
            />
          </div>

          {effectiveFromChanged && (
            <div className="flex items-center space-x-2">
              <input
                id="regenerate"
                type="checkbox"
                checked={formData.regenerateTransactions}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, regenerateTransactions: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <Label htmlFor="regenerate" className="text-sm font-normal">
                거래 내역 재생성 (변경된 시작일부터 현재까지)
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중
              </>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

