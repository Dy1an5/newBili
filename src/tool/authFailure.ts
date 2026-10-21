// B站在两种情况下说明登录态已经不可用:
//   HTTP 401, 或者业务码 -101 (账号未登录) / -400 (请求错误, 常见于 cookie 失效).
// 各模块的错误类都带 status 和 code, 所以这里只看这两个字段, 不依赖错误文案.
const AUTH_FAILURE_STATUS = 401;
const AUTH_FAILURE_CODES: ReadonlySet<number> = new Set([-101, -400]);

// 请求层是 B站响应的唯一出口, 在这里通知比让 9 个页面各自判断要可靠:
// 页面漏接一处, 那条路径就仍然卡在错误卡片上.
let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null): void {
    authFailureHandler = handler;
}

export function isAuthFailure(
    status: number | undefined,
    code: number | undefined,
): boolean {
    return status === AUTH_FAILURE_STATUS
        || (typeof code === 'number' && AUTH_FAILURE_CODES.has(code));
}

export function reportAuthFailure(
    status: number | undefined,
    code: number | undefined,
): void {
    if (isAuthFailure(status, code)) {
        authFailureHandler?.();
    }
}
