"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, TrendingUp, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Stock } from '@/types';
import { debounce } from '@/lib/utils';
import { formatSectorLabel } from '@/lib/utils/formatters';

interface StockSearchProps {
  onSelect: (stock: Omit<Stock, 'id'>) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function StockSearch({ 
  onSelect, 
  placeholder = "종목명 또는 티커 검색 (예: Apple, AAPL, 삼성전자)", 
  autoFocus = false 
}: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Omit<Stock, 'id'>[]>([]);
  const [popularStocks, setPopularStocks] = useState<Omit<Stock, 'id'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 인기 종목 로드
  useEffect(() => {
    fetchPopularStocks();
  }, []);

  const fetchPopularStocks = async () => {
    try {
      const response = await fetch('/api/stocks/search?popular=true');
      if (response.ok) {
        const data = await response.json();
        setPopularStocks(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch popular stocks:', error);
    }
  };

  // 검색 함수 (디바운스 적용)
  const searchStocks = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(searchQuery)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setResults(data.data || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // 쿼리 변경 시 검색
  useEffect(() => {
    if (query.trim().length > 0) {
      searchStocks(query);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, searchStocks]);

  // 종목 선택
  const handleSelect = (stock: Omit<Stock, 'id'>) => {
    onSelect(stock);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const displayResults = query.trim().length > 0 ? results : popularStocks;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < displayResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(displayResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayResults = query.trim().length > 0 ? results : popularStocks;
  const showResults = isOpen && displayResults.length > 0;

  return (
    <div className="relative w-full">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
          autoFocus={autoFocus}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {showResults && (
        <Card 
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 max-h-[400px] overflow-y-auto shadow-lg"
        >
          <CardContent className="p-2">
            {query.trim().length === 0 && (
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                인기 종목
              </div>
            )}
            
            <div className="space-y-1">
              {displayResults.map((stock, index) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  className={`w-full text-left px-3 py-3 rounded-md transition-colors ${
                    index === selectedIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {stock.symbol}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {stock.market}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                        >
                          {stock.assetType === 'stock' && '주식'}
                          {stock.assetType === 'etf' && 'ETF'}
                          {stock.assetType === 'reit' && 'REIT'}
                          {stock.assetType === 'fund' && '펀드'}
                        </Badge>
                      </div>
                      <p className="text-sm truncate">
                        {stock.name}
                      </p>
                      {stock.exchange && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stock.exchange}
                        </p>
                      )}
                    </div>
                    {stock.sector && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {formatSectorLabel(stock.sector)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {query.trim().length > 0 && results.length === 0 && !loading && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다.
                <br />
                다른 키워드로 검색해보세요.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

