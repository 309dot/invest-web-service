import { Button } from '@/components/ui/button';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import type { DisplayCurrency } from '@/lib/contexts/CurrencyContext';

interface FeatureCurrencyToggleProps {
  size?: 'default' | 'sm';
  label?: string;
}

const OPTIONS: Array<{ value: DisplayCurrency; label: string }> = [
  { value: 'original', label: '원본' },
  { value: 'USD', label: '달러' },
  { value: 'KRW', label: '원화' },
];

export function FeatureCurrencyToggle({ size = 'sm', label }: FeatureCurrencyToggleProps) {
  const { displayCurrency, setDisplayCurrency, exchangeRate, refreshExchangeRate, loading } =
    useCurrency();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {label && <span className="font-medium">{label}</span>}
      <div className="flex items-center gap-1">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={displayCurrency === option.value ? 'default' : 'outline'}
            size={size}
            onClick={() => setDisplayCurrency(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <button
        type="button"
        className="underline-offset-2 hover:underline"
        onClick={refreshExchangeRate}
        disabled={loading}
      >
        {exchangeRate
          ? `1달러 = ${exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`
          : loading
            ? '환율 갱신 중...'
            : '환율 새로고침'}
      </button>
    </div>
  );
}
