import { cn } from '@/lib/utils';

type AuthScreenVariant =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'
  | 'two-factor'
  | 'verify-email';

const paletteByVariant: Record<
  AuthScreenVariant,
  {
    gradient: string;
    heroGradient: string;
    glowA: string;
    glowB: string;
    glowC: string;
  }
> = {
  login: {
    gradient: 'from-blue-200 via-white to-cyan-200 lg:from-blue-300 lg:via-sky-100 lg:to-cyan-300 xl:from-blue-400 xl:to-cyan-400',
    heroGradient: 'from-blue-600 via-cyan-500 to-emerald-500',
    glowA: 'bg-red-300/35',
    glowB: 'bg-cyan-300/40',
    glowC: 'bg-[#7FFFD4]/40',
  },
  register: {
    gradient: 'from-rose-200 via-white to-yellow-200 lg:from-red-300 lg:via-rose-100 lg:to-yellow-300 xl:from-red-400 xl:to-yellow-400',
    heroGradient: 'from-red-600 via-orange-500 to-yellow-500',
    glowA: 'bg-pink-300/40',
    glowB: 'bg-orange-300/40',
    glowC: 'bg-yellow-300/40',
  },
  forgot: {
    gradient: 'from-emerald-200 via-white to-cyan-200 lg:from-green-300 lg:via-emerald-100 lg:to-cyan-300 xl:from-green-400 xl:to-cyan-400',
    heroGradient: 'from-green-600 via-cyan-500 to-[#7FFFD4]',
    glowA: 'bg-emerald-300/40',
    glowB: 'bg-cyan-300/40',
    glowC: 'bg-[#7FFFD4]/40',
  },
  reset: {
    gradient: 'from-fuchsia-200 via-white to-pink-200 lg:from-fuchsia-300 lg:via-pink-100 lg:to-rose-300 xl:from-fuchsia-400 xl:to-pink-400',
    heroGradient: 'from-pink-600 via-fuchsia-500 to-violet-500',
    glowA: 'bg-fuchsia-300/40',
    glowB: 'bg-pink-300/40',
    glowC: 'bg-violet-300/40',
  },
  'two-factor': {
    gradient: 'from-orange-200 via-white to-lime-200 lg:from-orange-300 lg:via-yellow-100 lg:to-lime-300 xl:from-orange-400 xl:to-lime-400',
    heroGradient: 'from-red-600 via-orange-500 to-lime-500',
    glowA: 'bg-red-300/40',
    glowB: 'bg-orange-300/40',
    glowC: 'bg-lime-300/40',
  },
  'verify-email': {
    gradient: 'from-cyan-200 via-white to-emerald-200 lg:from-cyan-300 lg:via-sky-100 lg:to-emerald-300 xl:from-cyan-400 xl:to-emerald-400',
    heroGradient: 'from-cyan-600 via-sky-500 to-emerald-500',
    glowA: 'bg-cyan-300/40',
    glowB: 'bg-sky-300/40',
    glowC: 'bg-emerald-300/40',
  },
};

export function AuthScreen({
  variant,
  children,
}: {
  variant: AuthScreenVariant;
  children: React.ReactNode;
}) {
  const palette = paletteByVariant[variant];

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-4 py-10',
        `bg-linear-to-br ${palette.gradient}`,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className={cn('hero-float-a absolute -left-16 top-10 h-56 w-56 rounded-full blur-3xl', palette.glowA)} />
        <div className={cn('hero-float-b absolute right-0 top-1/4 h-64 w-64 rounded-full blur-3xl', palette.glowB)} />
        <div className={cn('hero-float-c absolute bottom-0 left-1/3 h-56 w-56 rounded-full blur-3xl', palette.glowC)} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg">
        <div className="auth-card-enter">{children}</div>
      </div>
    </div>
  );
}
