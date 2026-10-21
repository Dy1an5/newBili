// 九个页面各自定义了同一个 getErrorMessage: 认自己模块的错误类就取 message,
// 否则返回一句兜底文案. 差别只有「认哪些类」和「兜底文案」.
// 错误类用构造函数比对, 因为各模块的错误类没有共同基类.
export type ErrorConstructor = new (...args: never[]) => Error;

export function createGetErrorMessage(
    errorTypes: readonly ErrorConstructor[],
    fallbackMessage: string,
): (error: unknown) => string {
    return (error: unknown): string => {
        for (const errorType of errorTypes) {
            if (error instanceof errorType) {
                return error.message;
            }
        }

        return fallbackMessage;
    };
}

// 收藏夹页面的兜底文案要拼资源名 (「加载收藏夹失败」「加载收藏视频失败」),
// 所以单独给一个把参数带进兜底文案的版本.
export function createGetErrorMessageWithResource(
    errorTypes: readonly ErrorConstructor[],
    fallback: (resourceName: string) => string,
): (error: unknown, resourceName: string) => string {
    return (error: unknown, resourceName: string): string => {
        for (const errorType of errorTypes) {
            if (error instanceof errorType) {
                return error.message;
            }
        }

        return fallback(resourceName);
    };
}
