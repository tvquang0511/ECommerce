/* eslint-disable react/no-unescaped-entities */

'use client';

import Link from 'next/link';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAccessToken } from '@/lib/auth/useAccessToken';

export function SiteHeader() {
  const { accessToken } = useAccessToken();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const avatarLabel = useMemo(() => {
    return accessToken ? 'U' : 'G';
  }, [accessToken]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <Link href="/" className="font-bold">
          Ecommerce
        </Link>

        <nav className="flex items-center gap-2">
          {accessToken ? (
            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="User menu"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="rounded-full"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full border bg-muted text-xs font-medium">
                  {avatarLabel}
                </span>
              </Button>

              {open ? (
                <Card className="absolute right-0 mt-2 w-48 p-1">
                  <div role="menu" className="flex flex-col">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => setOpen(false)}
                    >
                      <Link href="/account/profile">Xem hồ sơ</Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => setOpen(false)}
                    >
                      <Link href="/account/security">Bảo mật (2FA)</Link>
                    </Button>
                  </div>
                </Card>
              ) : null}
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Đăng nhập</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/register">Đăng ký</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
