import React, { useState } from "react";
import { Link } from "react-router-dom";
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

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorText(null);
      const normalized = email.trim().toLowerCase();
      await authApi.forgotPassword({ email: normalized });
    },
    onSuccess: () => {
      setDone(true);
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
          <CardTitle className="text-center text-2xl">Quên mật khẩu</CardTitle>
          <CardDescription className="text-center">
            Nhập email để nhận link đặt lại mật khẩu
          </CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={mutation.isPending || done}
              />
            </div>

            {errorText ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorText}
              </div>
            ) : null}

            {done ? (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Nếu email tồn tại trong hệ thống, TeamHub đã gửi email đặt lại mật khẩu.
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={mutation.isPending || done}>
              {mutation.isPending ? "Đang gửi..." : "Gửi email"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <Link to="/login" className="font-medium text-blue-600 hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
