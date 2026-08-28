import type { FavoriteFolder, FavoriteVideo } from '@/types/favorites';

const FAVORITE_FOLDERS_URL =
    'https://api.bilibili.com/x/v3/fav/folder/created/list-all';
const FAVORITE_VIDEOS_URL =
    'https://api.bilibili.com/x/v3/fav/resource/list';
const BILIBILI_REFERER = 'https://www.bilibili.com/';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_AVATAR_URL = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';

type JsonRecord = Record<string, unknown>;

export type FavoriteVideoPage = {
    videos: FavoriteVideo[];
    hasMore: boolean;
};

export class FavoritesRequestError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'FavoritesRequestError';
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

function getCookieValue(cookie: string, cookieName: string): string | null {
    const pair = getCookiePair(cookie, cookieName);

    if (!pair) {
        return null;
    }

    return pair.slice(pair.indexOf('=') + 1);
}

function getRequestIdentity(cookie: string): { mid: string; sessdata: string } {
    const mid = getCookieValue(cookie, 'DedeUserID');
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!mid || !/^\d+$/.test(mid)) {
        throw new FavoritesRequestError('登录信息中没有有效的DedeUserID,请重新登录');
    }

    if (!sessdata) {
        throw new FavoritesRequestError('登录信息中没有有效的SESSDATA,请重新登录');
    }

    return { mid, sessdata };
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new FavoritesRequestError('登录信息中没有有效的SESSDATA,请重新登录');
    }

    return sessdata;
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
        throw new FavoritesRequestError(`收藏接口请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new FavoritesRequestError('收藏接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body.message) ?? '未知错误';
        throw new FavoritesRequestError(`收藏接口错误 ${code}:${message}`, code);
    }

    return body;
}

function parseFavoriteFolder(value: unknown): FavoriteFolder | null {
    const folder = asRecord(value);
    const id = readNumber(folder?.id);
    const title = readString(folder?.title);

    if (id === null || id <= 0 || !title) {
        return null;
    }

    return {
        id,
        title,
        mediaCount: readNumber(folder?.media_count) ?? 0,
    };
}

function parseFavoriteVideo(value: unknown): FavoriteVideo | null {
    const video = asRecord(value);
    const upper = asRecord(video?.upper);
    const bvid = readString(video?.bvid) ?? readString(video?.bv_id);
    const title = readString(video?.title);
    const coverUrl = normalizeImageUrl(video?.cover);

    if (!video || !bvid || !title || !coverUrl) {
        return null;
    }

    const aid = readNumber(video.id);
    const durationSeconds = readNumber(video.duration) ?? 0;
    const authorMid = readString(upper?.mid) ?? '';
    const authorName = readString(upper?.name) ?? '未知UP主';
    const authorAvatarUrl = normalizeImageUrl(upper?.face) ?? DEFAULT_AVATAR_URL;
    const cntInfo = asRecord(video.cnt_info);

    return {
        aid: aid !== null && aid > 0 ? aid : undefined,
        bvid,
        title,
        coverUrl,
        durationSeconds,
        author: {
            mid: authorMid,
            name: authorName,
            avatarUrl: authorAvatarUrl,
        },
        publishedAt: readNumber(video.pubtime) ?? 0,
        favoritedAt: readNumber(video.fav_time) ?? 0,
        stats: {
            viewCount: readNumber(cntInfo?.play) ?? undefined,
            danmakuCount: readNumber(cntInfo?.danmaku) ?? undefined,
        },
    };
}

export async function fetchFavoriteFolders(
    cookie: string,
    signal?: AbortSignal,
): Promise<FavoriteFolder[]> {
    const { mid, sessdata } = getRequestIdentity(cookie);
    const parameters = new URLSearchParams({ up_mid: mid });
    const body = await requestBilibili(
        `${FAVORITE_FOLDERS_URL}?${parameters.toString()}`,
        sessdata,
        signal,
    );
    const data = asRecord(body.data);
    const list = Array.isArray(data?.list) ? data.list : [];

    return list
        .map(parseFavoriteFolder)
        .filter((folder): folder is FavoriteFolder => folder !== null);
}

export async function fetchFavoriteVideoPage(
    mediaId: number,
    page: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<FavoriteVideoPage> {
    const sessdata = getSessdataPair(cookie);
    const pageSize = 20;
    const parameters = new URLSearchParams({
        media_id: String(mediaId),
        pn: String(page),
        ps: String(pageSize),
        keyword: '',
        order: 'mtime',
        type: '0',
        tid: '0',
        platform: 'web',
    });
    const body = await requestBilibili(
        `${FAVORITE_VIDEOS_URL}?${parameters.toString()}`,
        sessdata,
        signal,
    );
    const data = asRecord(body.data);
    const medias = Array.isArray(data?.medias) ? data.medias : [];
    const videos = medias
        .map(parseFavoriteVideo)
        .filter((video): video is FavoriteVideo => video !== null);

    return {
        videos,
        hasMore: typeof data?.has_more === 'boolean'
            ? data.has_more
            : medias.length >= pageSize,
    };
}
