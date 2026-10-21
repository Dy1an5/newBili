import {
    asRecord,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    readNumber,
    readString,
    type JsonRecord,
} from '@/tool/bilibiliApi';

// 六个 fetch 模块各自复制过一份同样的 fetch + ok + json + code 检查,
// 差别只有错误类和资源名. 这里收成一处, 错误类由调用方传入.
export type BilibiliRequestErrorConstructor = new (
    message: string,
    status?: number,
    code?: number,
) => Error;

export type BilibiliRequestOptions = {
    sessdata: string;
    resourceName: string;
    createError: BilibiliRequestErrorConstructor;
    signal?: AbortSignal;
    // 少数接口对某些业务码有专门文案, 在这里给一个 code 到文案的映射,
    // 免得为了一个特判再复制整段请求逻辑.
    messageByCode?: Readonly<Record<number, string>>;
};

export async function requestBilibiliJson(
    url: string,
    {
        sessdata,
        resourceName,
        createError,
        signal,
        messageByCode,
    }: BilibiliRequestOptions,
): Promise<JsonRecord> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Cookie: sessdata,
            Referer: BILIBILI_REFERER,
            'User-Agent': USER_AGENT,
        },
        signal,
    });

    if (!response.ok) {
        throw new createError(
            `${resourceName}请求失败,HTTP ${response.status}`,
            response.status,
        );
    }

    // 风控页面是 HTML, 直接 response.json() 会抛 SyntaxError 并丢掉状态码.
    let parsedBody: unknown;

    try {
        parsedBody = await response.json();
    } catch {
        throw new createError(
            `${resourceName}接口返回了无法解析的JSON,HTTP ${response.status}`,
            response.status,
        );
    }

    const body = asRecord(parsedBody);
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new createError(
            `${resourceName}接口返回格式不正确,HTTP ${response.status}`,
            response.status,
        );
    }

    if (code !== 0) {
        const customMessage = messageByCode?.[code];

        if (customMessage !== undefined) {
            throw new createError(customMessage, response.status, code);
        }

        const message = readString(body.message) ?? '未知错误';
        throw new createError(
            `${resourceName}接口错误 ${code}:${message}`,
            response.status,
            code,
        );
    }

    return body;
}
