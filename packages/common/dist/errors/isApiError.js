import { ApiError } from './ApiError.js';
export function isApiError(err) {
    return err instanceof ApiError;
}
//# sourceMappingURL=isApiError.js.map