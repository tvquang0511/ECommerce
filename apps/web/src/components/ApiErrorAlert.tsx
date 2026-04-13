'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserServiceError } from '@/lib/http/userService';

export function ApiErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;

  const title = 'Request failed';

  if (error instanceof UserServiceError) {
    return (
      <Alert variant={error.status >= 500 ? 'destructive' : 'default'}>
        <AlertTitle>
          {error.code} ({error.status})
        </AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{String((error as any)?.message ?? error)}</AlertDescription>
    </Alert>
  );
}
