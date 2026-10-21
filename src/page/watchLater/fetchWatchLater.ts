import {
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';
import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    normalizeImageUrl,
    readNonEmptyString as readString,
    readNumber,
    readPositiveId,
} from '@/tool/bilibiliApi';
import { requestBilibiliJson } from '@/tool/bilibiliRequest';
import { createGetSessdataPair } from '@/tool/sessdata';

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
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'WatchLaterRequestError';
        this.status = status;
        this.code = code;
    }
}

const getSessdataPair = createGetSessdataPair(WatchLaterRequestError);

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

    const body = await requestBilibiliJson(
        `${WATCH_LATER_URL}?${signedQuery}`,
        {
            sessdata,
            resourceName: '稍后再看',
            createError: WatchLaterRequestError,
            signal,
        },
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
