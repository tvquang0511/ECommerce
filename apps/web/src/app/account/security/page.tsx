'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAccessToken } from '@/lib/auth/useAccessToken';
import { userService } from '@/lib/http/userService';

export default function SecurityPage() {
  const { accessToken, setToken, clearToken } = useAccessToken();

  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);

  async function loadTwoFactorStatus() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.twoFactorStatus(accessToken);
      setTwoFactorEnabled(res.enabled);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function enableTwoFactor() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.enableTwoFactor(accessToken, { password });
      setTwoFactorEnabled(true);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function disableTwoFactor() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.disableTwoFactor(accessToken, { password });
      setTwoFactorEnabled(false);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function refresh() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.refresh();
      setToken(res.accessToken);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.logout();
      clearToken();
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function logoutAll() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.logoutAll(accessToken);
      clearToken();
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-2xl">
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Bảo mật</CardTitle>
            <CardDescription>Bật/tắt 2FA và test refresh/logout/logout-all.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Đã có access token</span>
              <span className="font-mono text-xs">{accessToken ? 'yes' : 'no'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">2FA (lần cuối load)</span>
              <span className="font-mono text-xs">{twoFactorEnabled === null ? 'unknown' : twoFactorEnabled ? 'true' : 'false'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              Làm mới token
            </Button>
            <Button variant="outline" onClick={logout} disabled={isLoading}>
              Đăng xuất
            </Button>
            <Button variant="outline" onClick={clearToken} disabled={isLoading}>
              Xoá access token
            </Button>
            <Button variant="outline" onClick={logoutAll} disabled={!accessToken || isLoading}>
              Đăng xuất mọi thiết bị
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={loadTwoFactorStatus} disabled={!accessToken || isLoading}>
                {isLoading ? 'Đang tải…' : 'Tải trạng thái 2FA'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu (để bật/tắt 2FA)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={enableTwoFactor} disabled={!accessToken || isLoading}>
                Bật 2FA
              </Button>
              <Button variant="secondary" onClick={disableTwoFactor} disabled={!accessToken || isLoading}>
                Tắt 2FA
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="link" className="px-0">
              <Link href="/account/profile">Hồ sơ</Link>
            </Button>
            <Button asChild variant="link" className="px-0">
              <Link href="/account/sessions">Phiên đăng nhập</Link>
            </Button>
          </div>

          {result ? (
            <details className="rounded-md border bg-muted p-3">
              <summary className="cursor-pointer text-sm font-medium">Response</summary>
              <pre className="mt-2 max-h-96 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
            </details>
          ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
