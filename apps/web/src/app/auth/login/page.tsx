'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAccessToken } from '@/lib/auth/useAccessToken';
import { userService } from '@/lib/http/userService';

type LoginSuccess = {
  accessToken: string;
  user: { id: string; email: string; displayName: string; avatarUrl: string | null };
};

type LoginTwoFactor = {
  twoFactorRequired: true;
  challengeId: string;
  expiresAt: string;
  devOtp?: string;
};

function isTwoFactorRequired(res: unknown): res is LoginTwoFactor {
  return Boolean((res as any)?.twoFactorRequired);
}

export default function LoginPage() {
  const router = useRouter();
  const { accessToken, setToken, clearToken } = useAccessToken();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);

  const twoFactor = useMemo(() => (isTwoFactorRequired(result) ? result : null), [result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await userService.login({ email, password });
      setResult(res);

      if (!isTwoFactorRequired(res)) {
        const success = res as LoginSuccess;
        setToken(success.accessToken);
        router.replace('/');
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-100 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow">
              E
            </div>
          </div>
          <CardTitle className="text-2xl">Đăng nhập</CardTitle>
          <CardDescription>Nhập email và mật khẩu để tiếp tục.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <div className="text-right text-sm">
                <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>

            <Button type="button" variant="outline" onClick={clearToken} disabled={isLoading} className="w-full">
              Xoá access token
            </Button>

            {twoFactor ? (
              <div className="w-full rounded-md border bg-muted/50 p-3 text-left text-sm">
                <div className="font-medium">Yêu cầu 2FA</div>
                <div className="mt-2 grid gap-1">
                  <div>
                    <span className="text-muted-foreground">challengeId:</span>{' '}
                    <span className="font-mono text-xs">{twoFactor.challengeId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">expiresAt:</span>{' '}
                    <span className="font-mono text-xs">{twoFactor.expiresAt}</span>
                  </div>
                  {twoFactor.devOtp ? (
                    <div>
                      <span className="text-muted-foreground">devOtp:</span>{' '}
                      <span className="font-mono text-xs">{twoFactor.devOtp}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Button asChild variant="secondary" className="w-full">
                    <Link href={`/auth/2fa?challengeId=${encodeURIComponent(twoFactor.challengeId)}`}>Đi tới xác minh 2FA</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <Separator />

            <div className="w-full text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Đã có access token</span>
                <span className="font-mono text-xs">{accessToken ? 'yes' : 'no'}</span>
              </div>
            </div>

            {result ? (
              <details className="w-full rounded-md border bg-muted p-3">
                <summary className="cursor-pointer text-sm font-medium">Response</summary>
                <pre className="mt-2 max-h-80 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
              </details>
            ) : null}

            <div className="text-center text-sm text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link href="/auth/register" className="font-medium text-primary hover:underline">
                Đăng ký ngay
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
