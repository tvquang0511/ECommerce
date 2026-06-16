'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Package2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';
import { cartService } from '@/lib/http/cartService';
import { GraphqlRequestError } from '@/lib/http/graphqlClient';
import { productService, type ProductSummary } from '@/lib/http/productService';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductsPage() {
  const { accessToken, authed } = useAuthedUserService();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    productService
      .list(accessToken)
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setProducts(data);
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
  }, [accessToken]);

  function handleAddToCart(productId: string) {
    setPendingProductId(productId);
    startTransition(() => {
      authed((token) => cartService.addToCart(token, { productId, quantity: 1 }))
        .then((cart) => {
          const item = cart.items.find((entry) => entry.productId === productId);
          toast.success(
            item
              ? `Đã thêm vào giỏ. Số lượng hiện tại: ${item.quantity}`
              : 'Đã thêm sản phẩm vào giỏ hàng',
          );
        })
        .catch((err) => {
          if (err instanceof GraphqlRequestError) {
            toast.error(err.message);
            return;
          }
          if ((err as Error)?.message === 'AUTH_REQUIRED') {
            toast.error('Bạn cần đăng nhập để thêm vào giỏ');
            return;
          }
          toast.error('Không thể thêm sản phẩm vào giỏ');
        })
        .finally(() => {
          setPendingProductId(null);
        });
    });
  }

  return (
    <PageContainer className="pt-8">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Buyer Flow
          <span className="size-1.5 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Sản phẩm đang được mở bán
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Danh sách này lấy trực tiếp từ <code>product-subgraph</code>. Nếu bạn chưa đăng nhập, bạn chỉ thấy sản phẩm đã được duyệt. Khi đăng nhập buyer, bạn có thể thêm ngay vào giỏ hàng.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="warning">
            <Link href="/cart">
              <ShoppingCart className="mr-2 size-4" />
              Đi tới giỏ hàng
            </Link>
          </Button>
        </div>
      </div>

      <ApiErrorAlert error={error} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-3xl border border-white/70 bg-white/75" />
          ))}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const canAdd = product.status === 'APPROVED';
            const busy = isPending && pendingProductId === product.id;

            return (
              <Card key={product.id} className="overflow-hidden rounded-3xl border-white/80 bg-white/90 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.36)]">
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                      <Package2 className="size-3.5" />
                      {product.status}
                    </div>
                    <div className="text-xs text-muted-foreground">{product.id}</div>
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black leading-tight">{product.name}</CardTitle>
                    <CardDescription className="mt-2 min-h-12 text-sm leading-6">
                      {product.shortDescription || 'Sản phẩm chưa có mô tả ngắn.'}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-amber-50/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Giá bán</div>
                    <div className="mt-2 text-2xl font-black text-amber-950">{formatCurrency(product.price)}</div>
                  </div>
                  <Button className="w-full" disabled={!canAdd || busy} onClick={() => handleAddToCart(product.id)}>
                    {busy ? 'Đang thêm...' : canAdd ? 'Thêm vào giỏ hàng' : 'Chưa thể thêm vào giỏ'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </PageContainer>
  );
}
