"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);

    try {
      await signInWithGoogle();
      // 로그인 성공 시 useEffect에서 자동으로 리다이렉트
    } catch (error) {
      console.error('Login error:', error);
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold">
            개인 주식 관리 시스템
          </CardTitle>
          <CardDescription className="text-base">
            AI 기반 포트폴리오 분석 및 투자 인사이트
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google로 시작하기
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  안전한 로그인
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <p>다중 종목 포트폴리오 관리</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <p>AI 기반 투자 분석 및 전략 제안</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <p>실시간 뉴스 큐레이션</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <p>자동투자 및 수동투자 통합 관리</p>
            </div>
          </div>

          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            <p>
              로그인하면{' '}
              <a href="#" className="underline hover:text-primary">
                서비스 약관
              </a>{' '}
              및{' '}
              <a href="#" className="underline hover:text-primary">
                개인정보 처리방침
              </a>
              에 동의하게 됩니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

