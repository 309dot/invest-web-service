"use client";

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface WatchlistItem {
  id: string;
  symbol: string;
  targetPrice?: number;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

type Message = { type: 'success' | 'error'; text: string } | null;

const INITIAL_FORM = {
  symbol: '',
  targetPrice: '',
  memo: '',
};

export function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ targetPrice: string; memo: string }>({ targetPrice: '', memo: '' });

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.symbol > b.symbol ? 1 : -1));
  }, [items]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await fetch('/api/watchlist');
        if (!res.ok) {
          throw new Error('관심 종목을 불러오지 못했습니다.');
        }
        const json = await res.json();
        setItems(json.data ?? []);
      } catch (error) {
        console.error(error);
        setMessage({ type: 'error', text: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' });
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setMessage({ type: 'error', text: '심볼을 입력하세요.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
          memo: form.memo,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? '추가에 실패했습니다.');
      }

      const { id } = await response.json();
      setItems([
        ...items,
        {
          id,
          symbol,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
          memo: form.memo || undefined,
        },
      ]);
      setMessage({ type: 'success', text: `${symbol} 종목을 관심 목록에 추가했습니다.` });
      setForm(INITIAL_FORM);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '관심 종목 추가 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: WatchlistItem) => {
    setEditingId(item.id);
    setEditDraft({
      targetPrice: item.targetPrice?.toString() ?? '',
      memo: item.memo ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ targetPrice: '', memo: '' });
  };

  const handleSave = async (id: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          targetPrice: editDraft.targetPrice ? Number(editDraft.targetPrice) : null,
          memo: editDraft.memo,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? '수정에 실패했습니다.');
      }

      setItems(items.map(item => (item.id === id ? {
        ...item,
        targetPrice: editDraft.targetPrice ? Number(editDraft.targetPrice) : undefined,
        memo: editDraft.memo || undefined,
      } : item)));
      setMessage({ type: 'success', text: '관심 종목 정보를 업데이트했습니다.' });
      cancelEdit();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '관심 종목 수정 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? '삭제에 실패했습니다.');
      }

      setItems(items.filter(item => item.id !== id));
      setMessage({ type: 'success', text: `${symbol} 종목을 삭제했습니다.` });
      if (editingId === id) {
        cancelEdit();
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '관심 종목 삭제 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>내 관심 종목</CardTitle>
        <CardDescription>추적할 주식을 등록하고 목표가를 기록해보세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message ? (
          <Alert
            className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}
            role="status"
            aria-live="polite"
          >
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleAdd} className="grid gap-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-4 md:grid-cols-[150px_1fr_1fr_auto]">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary">심볼 *</label>
            <input
              type="text"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              placeholder="예: AAPL"
              maxLength={5}
              className="w-full rounded-md border px-3 py-2 uppercase"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">목표가 (선택)</label>
            <input
              type="number"
              step="0.01"
              value={form.targetPrice}
              onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
              placeholder="150.00"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">메모</label>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 분기 실적 확인"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div className="flex items-end justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              추가
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-md border bg-muted/40 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            불러오는 중...
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            아직 등록된 관심 종목이 없습니다. 위 폼에서 심볼을 추가해보세요.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <div key={item.id} className="rounded-md border border-muted bg-background p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-base font-semibold px-3 py-1">
                        {item.symbol}
                      </Badge>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-3">
                          <label className="text-xs text-muted-foreground">
                            목표가
                            <input
                              type="number"
                              step="0.01"
                              value={editDraft.targetPrice}
                              onChange={(e) => setEditDraft({ ...editDraft, targetPrice: e.target.value })}
                              className="ml-2 w-28 rounded border px-2 py-1 text-sm"
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            메모
                            <input
                              type="text"
                              value={editDraft.memo}
                              onChange={(e) => setEditDraft({ ...editDraft, memo: e.target.value })}
                              className="ml-2 w-48 rounded border px-2 py-1 text-sm"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            목표가: {item.targetPrice ? `${item.targetPrice.toFixed(2)} USD` : '미설정'}
                          </p>
                          {item.memo ? <p>메모: {item.memo}</p> : null}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleSave(item.id)} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            저장
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            <X className="mr-1 h-4 w-4" /> 취소
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
                            수정
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(item.id, item.symbol)}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> 삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

