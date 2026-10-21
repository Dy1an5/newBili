import { getCookiePair, getCookieValue } from '@/tool/bilibiliApi';

// 八个模块各自复制过一份同样的「取 SESSDATA 或抛自己的错误」,
// 差别只有错误类和文案. 这里收成一处, 由调用方传入自己的错误构造函数.
export type SessdataErrorConstructor = new (message: string) => Error;

export function createGetSessdataPair(
    createError: SessdataErrorConstructor,
    message = '登录信息中没有有效的SESSDATA,请重新登录',
): (cookie: string) => string {
    return (cookie: string): string => {
        const sessdata = getCookiePair(cookie, 'SESSDATA');

        if (!sessdata) {
            throw new createError(message);
        }

        return sessdata;
    };
}

// 需要按 mid 取列表的接口还要 DedeUserID. 三个模块各自内联了同一段检查,
// 且都只用于构造请求身份, 所以和 SESSDATA 一起收在这里.
const DEDE_USER_ID_PATTERN = /^\d+$/;

export function createGetRequestIdentity(
    createError: SessdataErrorConstructor,
    message = '登录信息中没有有效的DedeUserID,请重新登录',
): (cookie: string) => { mid: string; sessdata: string } {
    const getSessdataPair = createGetSessdataPair(createError);

    return (cookie: string): { mid: string; sessdata: string } => {
        const mid = getCookieValue(cookie, 'DedeUserID');

        if (!mid || !DEDE_USER_ID_PATTERN.test(mid)) {
            throw new createError(message);
        }

        return { mid, sessdata: getSessdataPair(cookie) };
    };
}
