'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAccessToken } from '@/lib/auth/useAccessToken';
import { userService } from '@/lib/http/userService';

export default function ProfilePage() {
  const { accessToken } = useAccessToken();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [me, setMe] = useState<null | {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  }>(null);

  async function loadMe() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.me(accessToken);
      setMe(res);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-xl">
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Hồ sơ</CardTitle>
            <CardDescription>
              Trang này gọi endpoint <span className="font-mono text-xs">/api/users/auth/me</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadMe} disabled={!accessToken || isLoading}>
              {isLoading ? 'Đang tải…' : 'Tải hồ sơ'}
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/security">Bảo mật (2FA)</Link>
            </Button>
          </div>

          {!accessToken ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Bạn chưa đăng nhập.</div>
              <div className="mt-2">
                <Button asChild variant="secondary">
                  <Link href="/auth/login">Đăng nhập</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {me ? (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>{' '}
                  <span className="font-mono text-xs">{me.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> {me.email}
                </div>
                <div>
                  <span className="text-muted-foreground">Tên hiển thị:</span> {me.displayName}
                </div>
                <div>
                  <span className="text-muted-foreground">Avatar URL:</span>{' '}
                  <span className="font-mono text-xs">{me.avatarUrl ?? 'null'}</span>
                </div>
              </div>
            </>
          ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
