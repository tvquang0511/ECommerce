'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { toast } from 'sonner';

import { AccountQuickNav } from '@/components/AccountQuickNav';
import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { userService } from '@/lib/http/userService';

type Session = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdByIp: string | null;
  createdByUserAgent: string | null;
  lastUsedIp: string | null;
  lastUsedUserAgent: string | null;
};

export default function SessionsPage() {
  const { accessToken, authed, ensureAccessToken, logoutAll } = useAuthedUserService();
  const [authChecked, setAuthChecked] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);

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

  async function loadSessions() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authed((token) => userService.listSessions(token));
      setSessions(res.sessions);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setIsLoading(true);
    setError(null);

    try {
      await authed((token) => userService.revokeSession(token, sessionId));
      const res = await authed((token) => userService.listSessions(token));
      setSessions(res.sessions);

      toast.success('Đã thu hồi phiên');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!authChecked) return;
    if (!accessToken) return;
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, accessToken]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">Phiên</span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Quản lý thiết bị</span>
            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Thu hồi nhanh</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Theo dõi các phiên đăng nhập và thu hồi ngay khi phát hiện thiết bị không mong muốn.
          </p>
        </div>

        <AccountQuickNav />

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Phiên đăng nhập</CardTitle>
            <CardDescription>Quản lý phiên đăng nhập trên các thiết bị.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            <div className="flex flex-wrap gap-2">
              <Button onClick={loadSessions} disabled={!accessToken || isLoading}>
                {isLoading ? 'Đang tải…' : 'Tải danh sách'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void logoutAll()}
                disabled={!accessToken || isLoading}
              >
                Đăng xuất mọi thiết bị
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/profile">Quay lại hồ sơ</Link>
              </Button>
            </div>

            {authChecked && !accessToken ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="text-muted-foreground">Bạn chưa đăng nhập.</div>
                <div className="mt-2">
                  <Button asChild variant="secondary">
                    <Link href="/auth/login">Đăng nhập</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {sessions ? (
              <div className="space-y-3">
                <Separator />
                <div className="text-sm text-muted-foreground">{sessions.length} phiên</div>

                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border bg-white/70 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur"
                    >
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs">{s.id}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void revokeSession(s.id)}
                            disabled={isLoading || Boolean(s.revokedAt)}
                          >
                            {s.revokedAt ? 'Đã thu hồi' : 'Thu hồi'}
                          </Button>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            {s.createdByIp ?? 'IP không rõ'}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {s.lastUsedIp ?? 'Chưa sử dụng'}
                          </span>
                          {s.revokedAt ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                              Đã thu hồi
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Đang hoạt động
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-muted-foreground">Tạo lúc:</span>{' '}
                          <span className="font-mono text-xs">{s.createdAt}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dùng gần nhất:</span>{' '}
                          <span className="font-mono text-xs">{s.lastUsedAt ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Thu hồi:</span>{' '}
                          <span className="font-mono text-xs">{s.revokedAt ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
