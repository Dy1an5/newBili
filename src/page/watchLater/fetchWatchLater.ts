import type { WatchLaterVideo } from '@/types/watchLater';
import {
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';

const BILIBILI_REFERER = 'https://www.bilibili.com/';
const WATCH_LATER_URL = 'https://api.bilibili.com/x/v2/history/toview/web';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_AVATAR_URL =
    'https://i0.hdslb.com/bfs/face/member/noface.jpg';

const PAGE_SIZE = 20;

export type WatchLaterVideoPage = {
    videos: WatchLaterVideo[];
    totalCount: number;
    hasMore: boolean;
};

export type WatchLaterQueryOptions = {
    ascending: boolean;
};

type JsonRecord = Record<string, unknown>;

export class WatchLaterRequestError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'WatchLaterRequestError';
        this.code = code;
    }
}

function asRecord(value: unknown): JsonRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as JsonRecord;
}

function readString(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return null;
}

function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }
    }

    return null;
}

function normalizeImageUrl(value: unknown): string | null {
    const url = readString(value);

    if (!url) {
        return null;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    return url;
}

function getCookiePair(cookie: string, cookieName: string): string | null {
    for (const part of cookie.split(';')) {
        const trimmedPart = part.trim();
        const separatorIndex = trimmedPart.indexOf('=');

        if (separatorIndex < 0) {
            continue;
        }

        const name = trimmedPart.slice(0, separatorIndex).trim();
        const value = trimmedPart.slice(separatorIndex + 1).trim();

        if (name === cookieName && value.length > 0) {
            return trimmedPart;
        }
    }

    return null;
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
    const stat = asRecord(video?.stat);
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

    const aid = readNumber(video.aid);
    const cid = readNumber(video.cid);

    return {
        aid: aid !== null && aid > 0 ? aid : undefined,
        bvid,
        title,
        coverUrl,
        cid: cid !== null && cid > 0 ? cid : undefined,
        durationSeconds: readNumber(video.duration) ?? 0,
        progressSeconds: Math.max(
            0,
            readNumber(video.progress) ?? 0,
        ),
        author: {
            mid: readString(owner?.mid) ?? '',
            name: readString(owner?.name) ?? '未知UP主',
            avatarUrl:
                normalizeImageUrl(owner?.face) ??
                DEFAULT_AVATAR_URL,
        },
        publishedAt: readNumber(video.pubdate) ?? 0,
        stats: {
            viewCount: readNumber(stat?.view) ?? undefined,
            danmakuCount: readNumber(stat?.danmaku) ?? undefined,
        },
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
