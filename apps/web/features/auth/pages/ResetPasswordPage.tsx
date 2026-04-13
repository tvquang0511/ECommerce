import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { authApi } from "../../../api/auth.api";
import { getApiError } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => {
    // Prefer hash token to reduce leakage via referrer/server logs.
    // Example: /reset-password#token=...
    const hash = window.location.hash || "";
    const m = hash.match(/(?:^#|[&#])token=([^&]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
    return searchParams.get("token") ?? "";
  }, [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const mismatch = Boolean(newPassword) && Boolean(confirmPassword) && newPassword !== confirmPassword;

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorText(null);
      if (!token) throw new Error("Thiếu token đặt lại mật khẩu");
      if (newPassword !== confirmPassword) throw new Error("Mật khẩu nhập lại không khớp");
      await authApi.resetPassword({ token, newPassword });
    },
    onSuccess: async () => {
      setDone(true);
      // Give user a moment to see success, then redirect.
      setTimeout(() => navigate("/login"), 800);
    },
    onError: (err) => {
      setErrorText(getApiError(err));
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-2xl font-bold text-white">
              T
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Đặt lại mật khẩu</CardTitle>
          <CardDescription className="text-center">
            Nhập mật khẩu mới để hoàn tất
          </CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            {!token ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Link không hợp lệ (thiếu token). Hãy mở link trong email hoặc thử gửi lại.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={mutation.isPending || done || !token}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={mutation.isPending || done || !token}
                minLength={6}
                aria-invalid={mismatch}
              />
              {mismatch ? (
                <div className="text-sm text-destructive">Mật khẩu nhập lại không khớp.</div>
              ) : null}
            </div>

            {errorText ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorText}
              </div>
            ) : null}

            {done ? (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập...
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={mutation.isPending || done || !token || mismatch}>
              {mutation.isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <Link to="/forgot-password" className="font-medium text-blue-600 hover:underline">
                Gửi lại email đặt lại mật khẩu
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
