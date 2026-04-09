export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
//# sourceMappingURL=ApiError.js.map