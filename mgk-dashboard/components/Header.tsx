"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import type { DisplayCurrency } from '@/lib/contexts/CurrencyContext';
import { Button } from '@/components/ui/button';
import {
  Menu,
  X,
  TrendingUp,
  LayoutDashboard,
  Newspaper,
  Settings,
  LogOut,
  User,
  FileText,
  BarChart3,
  ArrowLeftRight,
  DollarSign,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    displayCurrency,
    setDisplayCurrency,
    exchangeRate,
    loading: currencyLoading,
    refreshExchangeRate,
  } = useCurrency();

  const currencyLabelMap: Record<DisplayCurrency, string> = {
    original: '표시: 원본',
    USD: '표시: 달러',
    KRW: '표시: 원화',
  };
  const currencyDisplayLabel = currencyLabelMap[displayCurrency];
  const formattedExchangeRate = exchangeRate
    ? `1달러 = ${exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`
    : '환율 정보 없음';

  const navigation = [
    { name: '대시보드', href: '/', icon: LayoutDashboard },
    { name: '거래 이력', href: '/transactions', icon: ArrowLeftRight },
    { name: '뉴스', href: '/news', icon: Newspaper },
    { name: '분석', href: '/portfolio/analysis', icon: BarChart3 },
    { name: '주간 리포트', href: '/weekly-reports', icon: FileText },
    { name: '설정', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo */}
        <div className="flex lg:flex-1">
          <Link href="/" className="flex items-center gap-2 -m-1.5 p-1.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden sm:block text-lg font-semibold">
              주식 관리
            </span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">메뉴 열기</span>
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Currency & User menu */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-end lg:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {currencyDisplayLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>통화 표시</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDisplayCurrency('original')}
                className={displayCurrency === 'original' ? 'bg-muted focus:bg-muted' : ''}
              >
                <span className="flex items-center gap-2">
                  {displayCurrency === 'original' && <Check className="h-4 w-4" />}
                  원본 통화
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDisplayCurrency('USD')}
                className={displayCurrency === 'USD' ? 'bg-muted focus:bg-muted' : ''}
              >
                <span className="flex items-center gap-2">
                  {displayCurrency === 'USD' && <Check className="h-4 w-4" />}
                  달러 보기
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDisplayCurrency('KRW')}
                className={displayCurrency === 'KRW' ? 'bg-muted focus:bg-muted' : ''}
              >
                <span className="flex items-center gap-2">
                  {displayCurrency === 'KRW' && <Check className="h-4 w-4" />}
                  원화 보기
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={refreshExchangeRate} disabled={currencyLoading}>
                {currencyLoading ? '환율 갱신 중...' : '환율 새로고침'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground">
            {formattedExchangeRate}
          </span>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.displayName || '사용자'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>설정</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="border-t pt-3 mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">통화 표시</p>
              <div className="flex gap-2">
                {(['original', 'USD', 'KRW'] as DisplayCurrency[]).map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={displayCurrency === option ? 'default' : 'outline'}
                    onClick={() => setDisplayCurrency(option)}
                  >
                    {option === 'original' ? '원본' : option === 'USD' ? '달러' : '원화'}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formattedExchangeRate}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshExchangeRate}
                  disabled={currencyLoading}
                >
                  {currencyLoading ? '갱신 중' : '환율 새로고침'}
                </Button>
              </div>
            </div>
            <div className="border-t pt-3 mt-3">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {user.displayName || '사용자'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 mt-2"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-5 w-5" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/login">로그인</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

