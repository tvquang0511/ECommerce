'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/http/userService';

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const tokenFromQuery = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenFromQuery) {
      setToken(tokenFromQuery);
      return;
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const raw = hash?.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(raw);
    const tokenFromHash = params.get('token');
    if (tokenFromHash) setToken(tokenFromHash);
  }, [tokenFromQuery]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmNewPassword) {
      setIsLoading(false);
      setError(new Error('Mật khẩu mới không khớp. Vui lòng nhập lại.'));
      return;
    }

    try {
      await userService.resetPassword({ token, newPassword });
      setSuccess(true);
      setConfirmNewPassword('');
      toast.success('Đã đặt lại mật khẩu thành công');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen variant="reset">
      <Card className="w-full max-w-md border-white/85 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-pink-500 text-lg font-bold text-white shadow-lg">
              E
            </div>
          </div>
          <CardTitle className="text-2xl">Đặt lại mật khẩu</CardTitle>
          <CardDescription>Dán token trong email và đặt mật khẩu mới.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            {success ? (
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại bằng mật khẩu mới.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="token">Token đặt lại</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="reset_…"
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
                placeholder="••••••••"
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
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </AuthScreen>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
