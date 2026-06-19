'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { accessToken, setToken } = useAccessToken();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);

  const twoFactor = useMemo(() => (isTwoFactorRequired(result) ? result : null), [result]);

  useEffect(() => {
    if (accessToken) {
      router.replace('/account/profile');
      return;
    }
  }, [accessToken, router, setToken]);

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
        toast.success(`Xin chào ${success.user.displayName}, đăng nhập thành công`);
        router.replace('/account/profile');
        return;
      }

      const tf = res as LoginTwoFactor;
      toast.info('Tài khoản của bạn yêu cầu xác minh 2FA');
      router.push(`/auth/2fa?challengeId=${encodeURIComponent(tf.challengeId)}`);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen variant="login">
      <Card className="w-full max-w-md border-white/85 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 text-lg font-bold text-white shadow-lg">
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

            {twoFactor?.devOtp ? (
              <div className="w-full rounded-md border bg-muted/50 p-3 text-left text-sm">
                <div className="font-medium">Dev OTP</div>
                <div className="mt-1 font-mono text-xs">{twoFactor.devOtp}</div>
              </div>
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
    </AuthScreen>
  );
}
