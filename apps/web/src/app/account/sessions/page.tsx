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
  const { accessToken } = useAccessToken();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  async function loadSessions() {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.listSessions(accessToken);
      setSessions(res.sessions);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function revokeSession(sessionId: string) {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      await userService.revokeSession(accessToken, sessionId);
      const res = await userService.listSessions(accessToken);
      setSessions(res.sessions);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-3xl">
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Phiên đăng nhập</CardTitle>
            <CardDescription>Danh sách session và thu hồi để test multi-device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadSessions} disabled={!accessToken || isLoading}>
              {isLoading ? 'Đang tải…' : 'Tải sessions'}
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/profile">Quay lại hồ sơ</Link>
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

          {sessions ? (
            <div className="space-y-3">
              <Separator />
              <div className="text-sm text-muted-foreground">{sessions.length} session(s)</div>

              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs">{s.id}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeSession(s.id)}
                          disabled={isLoading || Boolean(s.revokedAt)}
                        >
                          {s.revokedAt ? 'Đã thu hồi' : 'Thu hồi'}
                        </Button>
                      </div>
                      <div>
                        <span className="text-muted-foreground">createdAt:</span>{' '}
                        <span className="font-mono text-xs">{s.createdAt}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">lastUsedAt:</span>{' '}
                        <span className="font-mono text-xs">{s.lastUsedAt ?? 'null'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">revokedAt:</span>{' '}
                        <span className="font-mono text-xs">{s.revokedAt ?? 'null'}</span>
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
