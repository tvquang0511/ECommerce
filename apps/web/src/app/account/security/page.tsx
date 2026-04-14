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
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { userService } from '@/lib/http/userService';

export default function SecurityPage() {
  const { accessToken, ensureAccessToken, logoutAll, authed } = useAuthedUserService();
  const [authChecked, setAuthChecked] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [done, setDone] = useState(false);

  // Ensure refresh-cookie bootstrap before showing gated content.
  // This keeps UX consistent on hard refresh.
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDone(false);

    if (newPassword !== confirmNewPassword) {
      setIsLoading(false);
      setError(new Error('Mật khẩu mới không khớp. Vui lòng nhập lại.'));
      return;
    }

    try {
      await authed((token) => userService.changePassword(token, { currentPassword, newPassword }));
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Đổi mật khẩu thành công, đang đăng xuất tất cả phiên');

      // After password change, user-service revokes all sessions.
      // We also clear refresh cookie + local access token and force re-login.
      await logoutAll();
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">Bảo mật</span>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">Đổi mật khẩu</span>
            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">Kiểm soát phiên</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Đổi mật khẩu sẽ tự động vô hiệu hóa các phiên đăng nhập cũ để bảo vệ tài khoản.
          </p>
        </div>

        <AccountQuickNav />

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Bảo mật</CardTitle>
            <CardDescription>Đổi mật khẩu tài khoản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            {authChecked && !accessToken ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="text-muted-foreground">Bạn chưa đăng nhập.</div>
                <div className="mt-2">
                  <Button asChild variant="secondary" type="button">
                    <Link href="/auth/login">Đăng nhập</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {(!authChecked || !accessToken) ? null : (

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Nhập lại mật khẩu mới</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </Button>
                <Button asChild variant="outline" type="button">
                  <Link href="/account/profile">Quay lại hồ sơ</Link>
                </Button>
                <Button asChild variant="outline" type="button">
                  <Link href="/account/sessions">Quản lý phiên</Link>
                </Button>
              </div>

              {done ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Đổi mật khẩu thành công. Vui lòng đăng nhập lại.
                </div>
              ) : null}
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
