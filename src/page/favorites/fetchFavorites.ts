import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    getCookiePair,
    getCookieValue,
    normalizeImageUrl,
    readNonEmptyString as readString,
    readNumber,
    readPositiveId,
} from '@/tool/bilibiliApi';
import { requestBilibiliJson } from '@/tool/bilibiliRequest';

const FAVORITE_FOLDERS_URL =
    'https://api.bilibili.com/x/v3/fav/folder/created/list-all';
const FAVORITE_VIDEOS_URL =
    'https://api.bilibili.com/x/v3/fav/resource/list';
export type FavoriteFolder = {
    id: string;
    title: string;
    mediaCount: number;
};

export type FavoriteVideo = {
    bvid: string;
    title: string;
    coverUrl: string;
    durationSeconds: number;
    author: {
        name: string;
        avatarUrl: string;
    };
    favoritedAt: number;
};

export type FavoriteVideoPage = {
    videos: FavoriteVideo[];
    hasMore: boolean;
};

export class FavoritesRequestError extends Error {
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'FavoritesRequestError';
        this.status = status;
        this.code = code;
    }
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

function parseFavoriteFolder(value: unknown): FavoriteFolder | null {
    const folder = asRecord(value);
    const id = readPositiveId(folder?.id);
    const title = readString(folder?.title);

    if (id === null || !title) {
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

    const durationSeconds = readNumber(video.duration) ?? 0;
    const authorName = readString(upper?.name) ?? '未知UP主';
    const authorAvatarUrl = normalizeImageUrl(upper?.face) ?? DEFAULT_AVATAR_URL;

    return {
        bvid,
        title,
        coverUrl,
        durationSeconds,
        author: {
            name: authorName,
            avatarUrl: authorAvatarUrl,
        },
        favoritedAt: readNumber(video.fav_time) ?? 0,
    };
}

export async function fetchFavoriteFolders(
    cookie: string,
    signal?: AbortSignal,
): Promise<FavoriteFolder[]> {
    const { mid, sessdata } = getRequestIdentity(cookie);
    const parameters = new URLSearchParams({ up_mid: mid });
    const body = await requestBilibiliJson(
        `${FAVORITE_FOLDERS_URL}?${parameters.toString()}`,
        {
            sessdata,
            resourceName: '收藏',
            createError: FavoritesRequestError,
            signal,
        },
    );
    const data = asRecord(body.data);
    const list = Array.isArray(data?.list) ? data.list : [];

    return list
        .map(parseFavoriteFolder)
        .filter((folder): folder is FavoriteFolder => folder !== null);
}

export async function fetchFavoriteVideoPage(
    mediaId: string,
    page: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<FavoriteVideoPage> {
    const sessdata = getSessdataPair(cookie);
    const pageSize = 20;
    const parameters = new URLSearchParams({
        media_id: mediaId,
        pn: String(page),
        ps: String(pageSize),
        keyword: '',
        order: 'mtime',
        type: '0',
        tid: '0',
        platform: 'web',
    });
    const body = await requestBilibiliJson(
        `${FAVORITE_VIDEOS_URL}?${parameters.toString()}`,
        {
            sessdata,
            resourceName: '收藏',
            createError: FavoritesRequestError,
            signal,
        },
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
