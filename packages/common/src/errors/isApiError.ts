import { ApiError } from './ApiError.js';

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
