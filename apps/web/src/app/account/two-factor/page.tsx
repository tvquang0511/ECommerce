'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { toast } from 'sonner';

import { AccountQuickNav } from '@/components/AccountQuickNav';
import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { userService } from '@/lib/http/userService';

export default function TwoFactorPage() {
  const { accessToken, authed, ensureAccessToken } = useAuthedUserService();
  const [authChecked, setAuthChecked] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');

  async function loadStatus() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authed((token) => userService.twoFactorStatus(token));
      setEnabled(res.enabled);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAccessToken();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureAccessToken]);

  useEffect(() => {
    if (!authChecked) return;
    if (!accessToken) return;
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, accessToken]);

  async function setTwoFactor(nextEnabled: boolean) {
    setIsLoading(true);
    setError(null);

    try {
      await authed(async (token) => {
        if (nextEnabled) {
          await userService.enableTwoFactor(token, { password });
          return null;
        }

        await userService.disableTwoFactor(token, { password });
        return null;
      });

      setEnabled(nextEnabled);
      setPassword('');

      toast.success(nextEnabled ? 'Đã bật 2FA' : 'Đã tắt 2FA');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-lime-100 px-2 py-1 text-xs font-medium text-lime-700">2FA</span>
            <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-700">OTP email</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Xác nhận bằng mật khẩu</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Bật 2FA để tăng an toàn đăng nhập. Bạn có thể bật/tắt nhanh sau khi xác nhận mật khẩu.
          </p>
        </div>

        <AccountQuickNav />

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Xác thực 2 lớp (2FA)</CardTitle>
            <CardDescription>Bật/tắt OTP email khi đăng nhập.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            {authChecked && !accessToken ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="text-muted-foreground">Bạn chưa đăng nhập.</div>
                <div className="mt-2">
                  <Button asChild variant="secondary">
                    <Link href="/auth/login">Đăng nhập</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  Trạng thái:{' '}
                  <span
                    className={
                      enabled === null
                        ? 'font-medium text-violet-700'
                        : enabled
                          ? 'font-medium text-emerald-700'
                          : 'font-medium text-amber-700'
                    }
                  >
                    {enabled === null ? 'đang tải…' : enabled ? 'Bật' : 'Tắt'}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu (bắt buộc)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu để xác nhận"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void setTwoFactor(true)}
                    disabled={isLoading || !password || enabled === true}
                  >
                    Bật 2FA
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void setTwoFactor(false)}
                    disabled={isLoading || !password || enabled === false}
                  >
                    Tắt 2FA
                  </Button>
                </div>
              </>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/account/profile">Quay lại hồ sơ</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/security">Đổi mật khẩu</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/sessions">Quản lý phiên</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
