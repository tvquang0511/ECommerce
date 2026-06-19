'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { cartService, type Cart } from '@/lib/http/cartService';
import { GraphqlRequestError } from '@/lib/http/graphqlClient';

function formatCurrency(amount: number, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CartPage() {
  const { authed } = useAuthedUserService();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    authed((token) => cartService.getCart(token))
      .then((nextCart) => {
        if (cancelled) return;
        setCart(nextCart);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authed]);

  function runCartAction(action: () => Promise<Cart>) {
    startTransition(() => {
      action()
        .then((nextCart) => {
          setCart(nextCart);
          setError(null);
        })
        .catch((err) => {
          setError(err);
          toast.error(err instanceof GraphqlRequestError ? err.message : 'Không thể cập nhật giỏ hàng');
        });
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    runCartAction(() => authed((token) => cartService.updateCartItem(token, { productId, quantity })));
  }

  function removeItem(productId: string) {
    runCartAction(() => authed((token) => cartService.removeCartItem(token, { productId })));
  }

  function clearCart() {
    runCartAction(() => authed((token) => cartService.clearCart(token)));
  }

  return (
    <PageContainer className="pt-8">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          Cart Snapshot
          <span className="size-1.5 rounded-full bg-orange-500" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Giỏ hàng của bạn</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Cart lưu snapshot tên và giá tại thời điểm thêm vào giỏ. Đây là nền để sau này sang checkout và order.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="ghost">
            <Link href="/products">Tiếp tục xem sản phẩm</Link>
          </Button>
          <Button onClick={clearCart} disabled={isPending || !cart?.items.length} variant="destructive">
            Xóa toàn bộ giỏ hàng
          </Button>
        </div>
      </div>

      <ApiErrorAlert error={error} />

      {loading ? <div className="h-48 animate-pulse rounded-3xl border border-white/70 bg-white/75" /> : null}

      {!loading && (!cart || cart.items.length === 0) ? (
        <Card className="rounded-3xl border-white/80 bg-white/90 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.36)]">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <ShoppingBag className="size-10 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-bold">Giỏ hàng đang trống</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Hãy quay lại danh sách sản phẩm và thêm một vài món để thử luồng buyer.
              </p>
            </div>
            <Button asChild>
              <Link href="/products">Khám phá sản phẩm</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && cart?.items.length ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <Card key={item.id} className="rounded-3xl border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.productId}</div>
                    <div className="text-lg font-bold">{item.titleSnapshot}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.unitPrice.amount, item.unitPrice.currency)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending || item.quantity <= 1}
                      onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <div className="min-w-10 text-center text-sm font-bold">{item.quantity}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      disabled={isPending}
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-3xl border-white/80 bg-white/90 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.36)]">
            <CardHeader>
              <CardTitle className="text-xl font-black">Tóm tắt đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span className="font-semibold">{formatCurrency(cart.totals.subtotal.amount, cart.totals.subtotal.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-black">
                <span>Tổng cộng</span>
                <span>{formatCurrency(cart.totals.total.amount, cart.totals.total.currency)}</span>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                Checkout và order sẽ được làm ở giai đoạn tiếp theo. Hiện tại page này dùng để xác nhận cart snapshot và buyer flow đang hoạt động đúng.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}
