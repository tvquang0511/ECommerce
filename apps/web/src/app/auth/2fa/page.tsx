'use client';

import { useEffect, useState } from 'react';

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

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { setToken } = useAccessToken();

  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('challengeId');
    if (fromQuery) setChallengeId(fromQuery);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await userService.verifyTwoFactor({ challengeId, code });
      setToken(res.accessToken);
      toast.success('Xác minh 2FA thành công');
      router.replace('/account/profile');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen variant="two-factor">
      <Card className="w-full max-w-md border-white/85 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-lime-500 text-lg font-bold text-white shadow-lg">
              E
            </div>
          </div>
          <CardTitle className="text-2xl">Xác minh 2FA</CardTitle>
          <CardDescription>Nhập OTP để hoàn tất đăng nhập.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="challengeId">Challenge ID</Label>
              <Input
                id="challengeId"
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                placeholder="challenge_…"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Mã OTP</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Đang xác minh…' : 'Xác minh'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <div className="mb-1">
                <Link href="/auth/login" className="font-medium text-primary hover:underline">
                  Quay lại đăng nhập
                </Link>
              </div>
              Sau khi xác minh thành công bạn sẽ được chuyển tới hồ sơ.
            </div>
          </CardFooter>
        </form>
      </Card>
    </AuthScreen>
  );
}
