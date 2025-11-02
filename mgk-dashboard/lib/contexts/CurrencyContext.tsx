"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';

export type DisplayCurrency = 'original' | 'USD' | 'KRW';

interface CurrencyContextValue {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  exchangeRate: number | null; // USD -> KRW
  loading: boolean;
  refreshExchangeRate: () => Promise<void>;
  convertAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => {
    value: number;
    currency: 'USD' | 'KRW';
  };
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('original');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchExchangeRate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/exchange-rate');
      if (response.ok) {
        const data = await response.json();
        if (typeof data?.rate === 'number') {
          setExchangeRate(data.rate);
        }
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const convertAmount = useMemo<
    (amount: number, sourceCurrency: 'USD' | 'KRW') => {
      value: number;
      currency: 'USD' | 'KRW';
    }
  >(
    () =>
      (amount: number, sourceCurrency: 'USD' | 'KRW') => {
        if (displayCurrency === 'original' || !exchangeRate) {
          return { value: amount, currency: sourceCurrency };
        }

        if (displayCurrency === 'USD') {
          if (sourceCurrency === 'USD') {
            return { value: amount, currency: 'USD' };
          }
          return { value: amount / exchangeRate, currency: 'USD' };
        }

        // displayCurrency === 'KRW'
        if (sourceCurrency === 'KRW') {
          return { value: amount, currency: 'KRW' };
        }
        return { value: amount * exchangeRate, currency: 'KRW' };
      },
    [displayCurrency, exchangeRate]
  );

  const formatAmount = (amount: number, sourceCurrency: 'USD' | 'KRW'): string => {
    const converted = convertAmount(amount, sourceCurrency);
    return formatCurrency(converted.value, converted.currency);
  };

  const value: CurrencyContextValue = {
    displayCurrency,
    setDisplayCurrency,
    exchangeRate,
    loading,
    refreshExchangeRate: fetchExchangeRate,
    convertAmount,
    formatAmount,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

