// React Native 的 fetch 在请求被取消时抛的是普通 Error, name 为 'Error',
// 不是浏览器里的 'AbortError'. 所以以调用者自己的 signal 为准,
// 错误自身的形状只在拿不到 signal 时兜底.
// 实测 RN 0.86 的两种形状:
//   fetch failed: The operation was aborted.
//   fetch failed: Fetch request has been canceled
const CANCELLED_FETCH_MESSAGE = /^fetch failed: .*(abort|cancel)/i;

export function isRequestCancelled(
    error: unknown,
    signal?: AbortSignal,
): boolean {
    if (signal?.aborted) {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === 'AbortError'
        || CANCELLED_FETCH_MESSAGE.test(error.message);
}
