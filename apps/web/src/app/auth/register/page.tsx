'use client';

import { useState } from 'react';

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

export default function RegisterPage() {
  const router = useRouter();
  const { accessToken, setToken } = useAccessToken();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await userService.register({ displayName, email, password });
      setResult(res);
      setToken(res.accessToken);
      router.replace('/');
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
          <CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
          <CardDescription>Nhập thông tin để tạo tài khoản mới.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            </div>

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
                autoComplete="new-password"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Đang đăng ký…' : 'Tạo tài khoản'}
            </Button>

            <Separator />

            <div className="w-full space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Đã có access token</span>
                <span className="font-mono text-xs">{accessToken ? 'yes' : 'no'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tiếp theo</span>
                <Link href="/auth/login" className="font-medium text-primary hover:underline">
                  Đi tới đăng nhập
                </Link>
              </div>
            </div>

            {result ? (
              <details className="w-full rounded-md border bg-muted p-3">
                <summary className="cursor-pointer text-sm font-medium">Response</summary>
                <pre className="mt-2 max-h-80 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
              </details>
            ) : null}

            <div className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{' '}
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                Đăng nhập
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
