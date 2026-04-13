/* eslint-disable react/no-unescaped-entities */

'use client';

import Link from 'next/link';

import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { useAccessToken } from '@/lib/auth/useAccessToken';

export default function Home() {
  const { accessToken } = useAccessToken();

  return (
    <PageContainer>
      <div className="relative isolate overflow-hidden">
        <div className="mx-auto max-w-4xl pb-24 pt-10 sm:pb-32 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:px-8 lg:py-40">
          <div className="px-6 lg:px-0 lg:pt-4">
            <div className="mx-auto max-w-lg">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                Chào mừng tới Ecommerce
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                Đây là trang web thử nghiệm các tính năng của user-service. Bạn có thể đăng ký, đăng nhập, bật 2FA, và quản lý các phiên đăng nhập.
              </p>
              <div className="mt-10 flex items-center gap-x-6">
                {accessToken ? (
                  <Button asChild size="lg">
                    <Link href="/account/profile">Đi tới hồ sơ</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link href="/auth/login">Đăng nhập</Link>
                    </Button>
                    <Button asChild variant="secondary" size="lg">
                      <Link href="/auth/register">Đăng ký</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <svg
            className="absolute left-[max(50%,25rem)] top-0 h-[64rem] w-[128rem] -translate-x-1/2 stroke-border [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="e813992c-7d03-4cc4-a2bd-151760b470a0"
                width={200}
                height={200}
                x="50%"
                y={-1}
                patternUnits="userSpaceOnUse"
              >
                <path d="M100 200V.5M.5 .5H200" fill="none" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" strokeWidth={0} fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)" />
          </svg>
        </div>
      </div>
    </PageContainer>
  );
}
