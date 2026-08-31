import {
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';
import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    getCookiePair,
    normalizeImageUrl,
    readNonEmptyString as readString,
    readNumber,
    readPositiveId,
    type JsonRecord,
} from '@/tool/bilibiliApi';

const WATCH_LATER_URL = 'https://api.bilibili.com/x/v2/history/toview/web';

const PAGE_SIZE = 20;

export type WatchLaterVideo = {
    bvid: string;
    title: string;
    coverUrl: string;
    cid?: string;
    durationSeconds: number;
    author: {
        name: string;
        avatarUrl: string;
    };
    publishedAt: number;
};

export type WatchLaterVideoPage = {
    videos: WatchLaterVideo[];
    totalCount: number;
    hasMore: boolean;
};

export type WatchLaterQueryOptions = {
    ascending: boolean;
};

export class WatchLaterRequestError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'WatchLaterRequestError';
        this.code = code;
    }
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new WatchLaterRequestError(
            '登录信息中没有有效的SESSDATA,请重新登录',
        );
    }

    return sessdata;
}

function parseWatchLaterVideo(
    value: unknown,
): WatchLaterVideo | null {
    const video = asRecord(value);
    const owner = asRecord(video?.owner);
    const bvid = readString(video?.bvid);
    const title = readString(video?.title);
    const coverUrl = normalizeImageUrl(video?.pic);

    if (
        !video ||
        !bvid ||
        !title ||
        !coverUrl
    ) {
        return null;
    }

    const cid = readPositiveId(video.cid);

    return {
        bvid,
        title,
        coverUrl,
        cid: cid ?? undefined,
        durationSeconds: readNumber(video.duration) ?? 0,
        author: {
            name: readString(owner?.name) ?? '未知UP主',
            avatarUrl:
                normalizeImageUrl(owner?.face) ??
                DEFAULT_AVATAR_URL,
        },
        publishedAt: readNumber(video.pubdate) ?? 0,
    };
}

async function requestBilibili(
    url: string,
    sessdata: string,
    signal?: AbortSignal,
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
        throw new WatchLaterRequestError(`稍后再看请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new WatchLaterRequestError('稍后再看接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body?.message) ?? '未知错误';
        throw new WatchLaterRequestError(`稍后再看接口错误 ${code}:${message}`, code);
    }

    return body;
}

async function createWatchLaterSignedQuery(
    page: number,
    sessdata: string,
    options: WatchLaterQueryOptions,
    signal?: AbortSignal,
): Promise<string> {
    try {
        return await createWbiSignedQuery(
            {
                pn: page,
                ps: PAGE_SIZE,
                viewed: 0,
                key: '',
                asc: options.ascending,
                need_split: true,
                web_location: 333.881,
            },
            sessdata,
            signal,
        );
    } catch (error) {
        if (error instanceof WbiSigningError) {
            throw new WatchLaterRequestError(
                error.message,
                error.code,
            );
        }

        throw error;
    }
}

export async function fetchWatchLaterVideoPage(
    page: number,
    cookie: string,
    options: WatchLaterQueryOptions,
    signal?: AbortSignal,
): Promise<WatchLaterVideoPage> {
    if (!Number.isInteger(page) || page < 1) {
        throw new WatchLaterRequestError('稍后再看页码无效');
    }

    const sessdata = getSessdataPair(cookie);

    const signedQuery = await createWatchLaterSignedQuery(
        page,
        sessdata,
        options,
        signal,
    );

    const body = await requestBilibili(
        `${WATCH_LATER_URL}?${signedQuery}`,
        sessdata,
        signal,
    );

    const data = asRecord(body.data);

    if (!data) {
        throw new WatchLaterRequestError('稍后再看列表返回格式不正确');
    }

    const list = Array.isArray(data.list) ? data.list : [];
    const videos = list
        .map(parseWatchLaterVideo)
        .filter(
            (video): video is WatchLaterVideo =>
                video !== null,
        );

    const totalCount = Math.max(
        0,
        readNumber(data.count) ?? videos.length,
    );

    return {
        videos,
        totalCount,
        hasMore: page * PAGE_SIZE < totalCount,
    };
}
