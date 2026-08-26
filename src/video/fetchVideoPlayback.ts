import {
    clearWbiKeyCache,
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';

const VIDEO_VIEW_URL = 'https://api.bilibili.com/x/web-interface/view';
const VIDEO_PLAY_URL = 'https://api.bilibili.com/x/player/wbi/playurl';
const BILIBILI_REFERER = 'https://www.bilibili.com/';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type JsonRecord = Record<string, unknown>;

export type VideoPlayback = {
    cid: number;
    url: string;
    headers: Record<string, string>;
};

export class VideoPlaybackError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'VideoPlaybackError';
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

function normalizeUrl(value: unknown): string | null {
    const url = readString(value);

    if (!url) {
        return null;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    return url;
}

function getSessdataPair(cookie: string): string {
    for (const part of cookie.split(';')) {
        const trimmedPart = part.trim();
        const separatorIndex = trimmedPart.indexOf('=');

        if (separatorIndex < 0) {
            continue;
        }

        const name = trimmedPart.slice(0, separatorIndex).trim();
        const value = trimmedPart.slice(separatorIndex + 1).trim();

        if (name === 'SESSDATA' && value.length > 0) {
            return trimmedPart;
        }
    }

    throw new VideoPlaybackError('登录信息中没有有效的 SESSDATA');
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
        throw new VideoPlaybackError(`视频接口请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new VideoPlaybackError('视频接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body.message) ?? '未知错误';
        throw new VideoPlaybackError(`视频接口错误 ${code}:${message}`, code);
    }

    return body;
}

async function fetchFirstCid(
    bvid: string,
    sessdata: string,
    signal?: AbortSignal,
): Promise<number> {
    const parameters = new URLSearchParams({ bvid });
    const body = await requestBilibili(
        `${VIDEO_VIEW_URL}?${parameters.toString()}`,
        sessdata,
        signal,
    );
    const data = asRecord(body.data);
    const directCid = readNumber(data?.cid);

    if (directCid !== null && directCid > 0) {
        return directCid;
    }

    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const firstPage = asRecord(pages[0]);
    const firstPageCid = readNumber(firstPage?.cid);

    if (firstPageCid === null || firstPageCid <= 0) {
        throw new VideoPlaybackError('视频详情中没有找到可播放的cid');
    }

    return firstPageCid;
}

async function fetchProgressiveUrl(
    bvid: string,
    cid: number,
    sessdata: string,
    signal?: AbortSignal,
): Promise<string> {
    let signedQuery: string;

    try {
        signedQuery = await createWbiSignedQuery(
            {
                bvid,
                cid,
                qn: 64,
                fnver: 0,
                fnval: 1,
                fourk: 1,
                platform: 'html5',
                high_quality: 1,
            },
            sessdata,
            signal,
        );
    } catch (error) {
        if (error instanceof WbiSigningError) {
            throw new VideoPlaybackError(error.message, error.code);
        }

        throw error;
    }

    let body: JsonRecord;

    try {
        body = await requestBilibili(
            `${VIDEO_PLAY_URL}?${signedQuery}`,
            sessdata,
            signal,
        );
    } catch (error) {
        if (error instanceof VideoPlaybackError && error.code === -403) {
            clearWbiKeyCache();
        }

        throw error;
    }

    const data = asRecord(body.data);
    const durl = Array.isArray(data?.durl) ? data.durl : [];
    const firstSegment = asRecord(durl[0]);
    const url = normalizeUrl(firstSegment?.url);

    if (url) {
        return url;
    }

    const backupUrls = Array.isArray(firstSegment?.backup_url)
        ? firstSegment.backup_url
        : [];
    const backupUrl = normalizeUrl(backupUrls[0]);

    if (backupUrl) {
        return backupUrl;
    }

    throw new VideoPlaybackError('接口没有返回单文件播放地址,该视频可能只支持DASH');
}

export async function fetchVideoPlayback(
    bvid: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoPlayback> {
    const sessdata = getSessdataPair(cookie);
    const cid = await fetchFirstCid(bvid, sessdata, signal);
    const url = await fetchProgressiveUrl(bvid, cid, sessdata, signal);

    return {
        cid,
        url,
        headers: {
            Referer: BILIBILI_REFERER,
            'User-Agent': USER_AGENT,
        },
    };
}
