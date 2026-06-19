import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-full max-w-5xl px-4 py-10', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-r from-red-100/65 via-amber-100/60 to-emerald-100/65 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 top-28 -z-10 size-28 rounded-full bg-pink-200/35 blur-2xl" />
      <div className="pointer-events-none absolute -right-12 top-36 -z-10 size-32 rounded-full bg-cyan-200/35 blur-2xl" />
      {children}
    </div>
  );
}
