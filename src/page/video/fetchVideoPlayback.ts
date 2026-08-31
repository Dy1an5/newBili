import {
    clearWbiKeyCache,
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';
import {
    asRecord,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    getCookiePair,
    readNonEmptyString as readString,
    readNumber,
    readPositiveId,
    type JsonRecord,
} from '@/tool/bilibiliApi';

const VIDEO_VIEW_URL = 'https://api.bilibili.com/x/web-interface/view';
const VIDEO_PLAY_URL = 'https://api.bilibili.com/x/player/wbi/playurl';

export type VideoPlayback = {
    cid: string;
    url: string;
    headers: Record<string, string>;
};

export type VideoPart = {
    cid: string;
    page: number;
    title: string;
    durationSeconds: number;
    width?: number;
    height?: number;
};

export class VideoPlaybackError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'VideoPlaybackError';
        this.code = code;
    }
}

function readVideoDimension(value: unknown): Pick<VideoPart, 'width' | 'height'> {
    const dimension = asRecord(value);
    let width = readNumber(dimension?.width);
    let height = readNumber(dimension?.height);

    if (width === null || width <= 0 || height === null || height <= 0) {
        return {};
    }

    if (readNumber(dimension?.rotate) === 1) {
        [width, height] = [height, width];
    }

    return { width, height };
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
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (sessdata) {
        return sessdata;
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

export async function fetchVideoParts(
    bvid: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoPart[]> {
    const sessdata = getSessdataPair(cookie);
    const parameters = new URLSearchParams({ bvid });
    const body = await requestBilibili(
        `${VIDEO_VIEW_URL}?${parameters.toString()}`,
        sessdata,
        signal,
    );
    const data = asRecord(body.data);
    const videoDimension = readVideoDimension(data?.dimension);
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const videoParts = pages.flatMap((value, index): VideoPart[] => {
        const page = asRecord(value);
        const cid = readPositiveId(page?.cid);

        if (cid === null) {
            return [];
        }

        const pageNumber = readNumber(page?.page) ?? index + 1;
        const title = readString(page?.part) ?? `P${pageNumber}`;
        const durationSeconds = readNumber(page?.duration) ?? 0;
        const partDimension = readVideoDimension(page?.dimension);

        return [{
            cid,
            page: pageNumber,
            title,
            durationSeconds,
            ...(
                partDimension.width !== undefined
                    ? partDimension
                    : videoDimension
            ),
        }];
    });

    if (videoParts.length > 0) {
        return videoParts;
    }

    const directCid = readPositiveId(data?.cid);

    if (directCid === null) {
        throw new VideoPlaybackError('视频详情中没有找到可播放的cid');
    }

    return [{
        cid: directCid,
        page: 1,
        title: '正片',
        durationSeconds: readNumber(data?.duration) ?? 0,
        ...videoDimension,
    }];
}

async function fetchProgressiveUrl(
    bvid: string,
    cid: string,
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
    cid: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoPlayback> {
    const sessdata = getSessdataPair(cookie);
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
