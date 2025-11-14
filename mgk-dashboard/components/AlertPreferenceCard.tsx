"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'alert-preferences';

interface AlertPreferences {
  profitTarget: number;
  drawdownAlert: number;
  rebalanceReminder: 'monthly' | 'quarterly' | 'off';
  newsSummary: boolean;
}

const DEFAULT_PREFS: AlertPreferences = {
  profitTarget: 10,
  drawdownAlert: 20,
  rebalanceReminder: 'monthly',
  newsSummary: true,
};

export function AlertPreferenceCard() {
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AlertPreferences;
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      } catch {
        // ignore
      }
    }
  }, []);

  const updatePrefs = (next: Partial<AlertPreferences>) => {
    setPrefs((prev) => {
      const updated = { ...prev, ...next };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>맞춤형 알림 설정</CardTitle>
        <CardDescription>어떤 시점에 알림을 받을지 직접 조정해보세요.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profitTarget">목표 수익률 알림 (%)</Label>
          <Input
            id="profitTarget"
            type="number"
            min={1}
            value={prefs.profitTarget}
            onChange={(event) => updatePrefs({ profitTarget: Number(event.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            설정한 수익률 이상으로 올라가면 매도 타이밍 알림을 받습니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawdown">최대 손실 경고 (%)</Label>
          <Input
            id="drawdown"
            type="number"
            min={5}
            value={prefs.drawdownAlert}
            onChange={(event) => updatePrefs({ drawdownAlert: Number(event.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            평가 금액이 설정 값만큼 하락하면 즉시 대시보드 배너로 알려드립니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label>리밸런싱 리마인더</Label>
          <Select
            value={prefs.rebalanceReminder}
            onValueChange={(value: AlertPreferences['rebalanceReminder']) => updatePrefs({ rebalanceReminder: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="주기 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">매월</SelectItem>
              <SelectItem value="quarterly">분기별</SelectItem>
              <SelectItem value="off">알림 끄기</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>주간 뉴스 요약</Label>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">보유 종목 뉴스 요약</p>
              <p className="text-xs text-muted-foreground">매주 월요일 오전 8시에 요약 알림을 받습니다.</p>
            </div>
            <Switch
              checked={prefs.newsSummary}
              onCheckedChange={(checked) => updatePrefs({ newsSummary: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


