'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { toast } from 'sonner';

import { AccountQuickNav } from '@/components/AccountQuickNav';
import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import type { Gender, PublicUser } from '@/lib/http/userService';
import { userService } from '@/lib/http/userService';

export default function ProfilePage() {
  const { accessToken, authed, ensureAccessToken, logoutAll } = useAuthedUserService();
  const [authChecked, setAuthChecked] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [me, setMe] = useState<null | PublicUser>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [bio, setBio] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  const avatarPreview = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  async function loadAll() {
    setIsLoading(true);
    setError(null);

    try {
      const meRes = await authed((token) => userService.usersMe(token));

      setMe(meRes);
      setDisplayName(meRes.displayName);
      setBio(meRes.bio ?? '');
      setDateOfBirth(meRes.dateOfBirth ? meRes.dateOfBirth.slice(0, 10) : '');
      setPhoneNumber(meRes.phoneNumber ?? '');
      setGender(meRes.gender ?? '');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

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

  useEffect(() => {
    if (!authChecked) return;
    if (!accessToken) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, accessToken]);

  async function saveProfile() {
    setIsLoading(true);
    setError(null);

    try {
      const updated = await authed((token) =>
        userService.updateMeProfile(token, {
          displayName,
          bio: bio ? bio : null,
          dateOfBirth: dateOfBirth ? dateOfBirth : null,
          phoneNumber: phoneNumber ? phoneNumber : null,
          gender: gender ? gender : null,
        }),
      );
      setMe(updated);
      setDisplayName(updated.displayName);
      setBio(updated.bio ?? '');
      setDateOfBirth(updated.dateOfBirth ? updated.dateOfBirth.slice(0, 10) : '');
      setPhoneNumber(updated.phoneNumber ?? '');
      setGender(updated.gender ?? '');

      toast.success('Đã lưu hồ sơ');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const updated = await authed((token) => userService.uploadAvatar(token, avatarFile));
      setMe(updated);
      setAvatarFile(null);

      toast.success('Đã cập nhật avatar');
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Hồ sơ</span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Avatar</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Thông tin liên hệ</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Cập nhật thông tin cá nhân, đổi avatar và điều hướng nhanh đến các tác vụ bảo mật.
          </p>
        </div>

        <AccountQuickNav />

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Hồ sơ</CardTitle>
            <CardDescription>Thông tin cá nhân và thiết lập tài khoản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiErrorAlert error={error} />

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

            {me ? (
              <>
                <Separator />

                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {avatarPreview || me.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="Avatar"
                        src={avatarPreview ?? me.avatarUrl ?? ''}
                        className="size-16 rounded-full border object-cover"
                      />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-full border bg-muted text-sm font-medium">
                        {me.displayName?.trim()?.slice(0, 1).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{me.displayName}</div>
                    <div className="truncate text-sm text-muted-foreground">{me.email}</div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Tên hiển thị</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Mô tả</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Giới thiệu ngắn về bạn"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth">Ngày sinh</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Giới tính</Label>
                        <select
                          id="gender"
                          value={gender}
                          onChange={(e) => setGender(e.target.value as any)}
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                        >
                          <option value="">—</option>
                          <option value="UNSPECIFIED">Không muốn nói</option>
                          <option value="MALE">Nam</option>
                          <option value="FEMALE">Nữ</option>
                          <option value="OTHER">Khác</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Số điện thoại</Label>
                      <Input
                        id="phoneNumber"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+84..."
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={saveProfile} disabled={isLoading}>
                        {isLoading ? 'Đang lưu…' : 'Lưu thay đổi'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                      />
                      <Button onClick={uploadAvatar} disabled={!avatarFile || isLoading}>
                        Upload
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">Hỗ trợ jpeg/png/webp, tối đa 2MB.</div>
                  </div>

                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href="/account/security">Đổi mật khẩu</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/account/two-factor">2FA</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/account/sessions">Phiên đăng nhập</Link>
                    </Button>
                    <Button variant="outline" onClick={logoutAll} disabled={isLoading}>
                      Đăng xuất mọi thiết bị
                    </Button>
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
