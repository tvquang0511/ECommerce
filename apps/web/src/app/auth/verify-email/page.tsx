'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/http/userService';

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeFromQuery = useMemo(
    () => searchParams.get('challengeId') ?? '',
    [searchParams],
  );
  const emailFromQuery = useMemo(() => searchParams.get('email') ?? '', [searchParams]);
  const devOtp = useMemo(() => searchParams.get('devOtp') ?? '', [searchParams]);

  const [email, setEmail] = useState(emailFromQuery);
  const [challengeId, setChallengeId] = useState(challengeFromQuery);
  const [code, setCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState(devOtp);
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    setChallengeId(challengeFromQuery);
  }, [challengeFromQuery]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await userService.verifyEmail({ challengeId, code });
      toast.success('Email đã được xác minh. Bạn có thể đăng nhập ngay.');
      router.replace('/auth/login');
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (!email) {
      setError(new Error('Cần có email để gửi lại mã xác minh.'));
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      const res = await userService.resendEmailVerification({ email });
      if (res.challengeId) {
        setChallengeId(res.challengeId);
      }
      setDevOtpHint(res.devOtp ?? '');
      toast.success('Đã gửi lại mã xác minh email.');
    } catch (err) {
      setError(err);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthScreen variant="verify-email">
      <Card className="w-full max-w-md border-white/85 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-emerald-500 text-lg font-bold text-white shadow-lg">
              V
            </div>
          </div>
          <CardTitle className="text-2xl">Xác minh email</CardTitle>
          <CardDescription>
            Nhập mã OTP đã được gửi tới email của bạn trước khi đăng nhập.
          </CardDescription>
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
              <Label htmlFor="challengeId">Challenge ID</Label>
              <Input
                id="challengeId"
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                placeholder="challenge-id"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Mã OTP</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
              />
            </div>

            {devOtpHint ? (
              <div className="rounded-md border bg-muted/50 p-3 text-left text-sm">
                <div className="font-medium">Dev OTP</div>
                <div className="mt-1 font-mono text-xs">{devOtpHint}</div>
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Đang xác minh…' : 'Xác minh email'}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isResending}
              className="w-full"
              onClick={resendCode}
            >
              {isResending ? 'Đang gửi lại…' : 'Gửi lại mã OTP'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Đã xác minh xong?{' '}
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                Quay về đăng nhập
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </AuthScreen>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
