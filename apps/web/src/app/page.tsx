/* eslint-disable react/no-unescaped-entities */

'use client';

import Link from 'next/link';

import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { useAccessToken } from '@/lib/auth/useAccessToken';

export default function Home() {
  const { accessToken } = useAccessToken();

  return (
    <PageContainer className="pt-8 sm:pt-12">
      <div className="premium-hero-card relative isolate overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10 lg:p-12">
        <div className="absolute -left-16 -top-14 h-56 w-56 rounded-full bg-red-300/30 blur-3xl" />
        <div className="absolute right-0 top-8 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-56 w-56 rounded-full bg-[#7FFFD4]/30 blur-3xl" />

        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Ecommerce Identity
              <span className="size-1.5 rounded-full bg-blue-500" />
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Nền trắng chủ đạo,
              <br />
              trải nghiệm thật bắt mắt.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              Luồng đăng ký, đăng nhập, reset mật khẩu, 2FA và quản lý phiên được tối ưu theo hướng desktop-first.
              Hệ màu đa dạng đỏ, cam, vàng, lục, xanh, hồng, cyan, aquamarine giúp giao diện sống động hơn.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {accessToken ? (
                <Button asChild size="lg">
                  <Link href="/account/profile">Đi tới hồ sơ</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/auth/login">Đăng nhập</Link>
                  </Button>
                  <Button asChild variant="warning" size="lg">
                    <Link href="/auth/register">Đăng ký</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-red-700">Auth</div>
              <div className="mt-2 text-sm font-semibold text-red-900">Đăng nhập và đăng ký nhanh</div>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-orange-700">Recovery</div>
              <div className="mt-2 text-sm font-semibold text-orange-900">Forgot và reset riêng màu</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-emerald-700">Security</div>
              <div className="mt-2 text-sm font-semibold text-emerald-900">2FA và session control</div>
            </div>
            <div className="rounded-2xl border border-pink-200 bg-pink-50 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-semibold text-pink-700">Profile</div>
              <div className="mt-2 text-sm font-semibold text-pink-900">Avatar MinIO + profile fields</div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
