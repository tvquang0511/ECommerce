export declare class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: Record<string, unknown>;
    constructor(status: number, code: string, message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=ApiError.d.ts.map