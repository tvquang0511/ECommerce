/* eslint-disable react/no-unescaped-entities */

'use client';

import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { userService } from '@/lib/http/userService';

export function SiteHeader() {
  const { accessToken, authed, logout } = useAuthedUserService();

  const [me, setMe] = useState<null | { displayName: string; avatarUrl: string | null }>(null);

  const avatarLabel = useMemo(() => {
    if (!accessToken) return 'G';
    const name = me?.displayName?.trim();
    return name ? name.slice(0, 1).toUpperCase() : 'U';
  }, [accessToken, me?.displayName]);

  useEffect(() => {
    let cancelled = false;

    if (!accessToken) {
      setMe(null);
      return;
    }

    authed((token) => userService.usersMe(token))
      .then((res) => {
        if (cancelled) return;
        setMe({ displayName: res.displayName, avatarUrl: res.avatarUrl });
      })
      .catch(() => {
        // ignore: header shouldn't block UI
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, authed]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-12 w-full items-center justify-between px-4">
        <Link href="/" className="font-bold">
          Ecommerce
        </Link>

        <nav className="flex items-center gap-2">
          {accessToken ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="User menu"
                  className="rounded-full"
                >
                  {me?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt="Avatar"
                      src={me.avatarUrl}
                      className="size-8 rounded-full border object-cover"
                    />
                  ) : (
                    <span className="inline-flex size-8 items-center justify-center rounded-full border bg-muted text-xs font-medium">
                      {avatarLabel}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/account/profile">Xem hồ sơ</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    await logout();
                  }}
                >
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
