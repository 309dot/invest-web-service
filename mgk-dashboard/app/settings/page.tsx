"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState({
    notificationEmail: '',
    autoCollectNews: true,
    newsImportanceThreshold: 2,
  });

  useEffect(() => {
    if (user?.email) {
      setSettings((prev) => ({
        ...prev,
        notificationEmail: prev.notificationEmail || user.email!,
      }));
    }
  }, [user?.email]);

  const [monitoringStocks, setMonitoringStocks] = useState(['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN']);
  const [newStock, setNewStock] = useState('');

  const handleSaveSettings = () => {
    // Firestore에 저장 (Firebase 설정 후 활성화)
    console.log('설정 저장:', settings);
    setMessage({ type: 'success', text: '✅ 설정이 저장되었습니다!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddStock = () => {
    if (newStock && !monitoringStocks.includes(newStock.toUpperCase())) {
      if (monitoringStocks.length >= 10) {
        setMessage({ type: 'error', text: '최대 10개까지만 추가할 수 있습니다' });
        return;
      }
      setMonitoringStocks([...monitoringStocks, newStock.toUpperCase()]);
      setNewStock('');
    }
  };

  const handleRemoveStock = (stock: string) => {
    setMonitoringStocks(monitoringStocks.filter(s => s !== stock));
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <main className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">설정</h1>
            <p className="text-muted-foreground">앱 동작 방식을 조정하세요</p>
          </div>
        </div>

        {message && (
          <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>알림 설정</CardTitle>
            <CardDescription>계정 기본 이메일로 알림이 전송됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">알림 이메일</label>
              <input
                type="email"
                value={settings.notificationEmail}
                onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="이메일 주소를 입력하세요"
              />
              <p className="text-xs text-muted-foreground">
                기본값은 로그인한 계정의 이메일입니다.
              </p>
            </div>
            <Alert>
              <AlertDescription className="text-sm text-muted-foreground">
                투자 관련 세부 설정은 각 종목 상세 화면에서 개별적으로 관리할 수 있습니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 뉴스 자동 수집 */}
        <Card>
          <CardHeader>
            <CardTitle>뉴스 자동 수집</CardTitle>
            <CardDescription>시장 변동 시 자동으로 뉴스 수집</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">뉴스 자동 수집</p>
                <p className="text-sm text-muted-foreground">주가 변동률이 기준치 이상일 때 자동 수집</p>
              </div>
              <Button
                variant={settings.autoCollectNews ? 'default' : 'outline'}
                onClick={() => setSettings({ ...settings, autoCollectNews: !settings.autoCollectNews })}
              >
                {settings.autoCollectNews ? 'ON' : 'OFF'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">뉴스 수집 변동률 기준 (±%)</label>
              <input
                type="number"
                value={settings.newsImportanceThreshold}
                onChange={(e) => setSettings({ ...settings, newsImportanceThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
                disabled={!settings.autoCollectNews}
              />
              <p className="text-xs text-muted-foreground">변동률이 이 값 이상이면 뉴스 수집</p>
            </div>
          </CardContent>
        </Card>

        {/* 모니터링 종목 */}
        <Card>
          <CardHeader>
            <CardTitle>모니터링 종목</CardTitle>
            <CardDescription>관심 있는 종목을 추가하세요 (최대 10개)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAddStock()}
                placeholder="TICKER"
                className="flex-1 px-3 py-2 border rounded-md uppercase"
                maxLength={5}
              />
              <Button onClick={handleAddStock}>
                <Plus className="h-4 w-4 mr-2" />
                추가
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {monitoringStocks.map((stock) => (
                <Badge key={stock} variant="secondary" className="text-sm px-3 py-1">
                  {stock}
                  <button
                    onClick={() => handleRemoveStock(stock)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {monitoringStocks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                아직 추가된 종목이 없습니다
              </p>
            )}
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-3">
          <Link href="/">
            <Button variant="outline">취소</Button>
          </Link>
          <Button onClick={handleSaveSettings}>설정 저장</Button>
        </div>
      </main>
    </div>
  );
}
