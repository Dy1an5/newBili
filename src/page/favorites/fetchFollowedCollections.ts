import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    getCookiePair,
    getCookieValue,
    normalizeImageUrl,
    readNonEmptyString as readString,
    readNumber,
    readPositiveId,
    type JsonRecord,
} from '@/tool/bilibiliApi';

const FOLLOWED_COLLECTIONS_URL =
    'https://api.bilibili.com/x/v3/fav/folder/collected/list';
const FOLLOWED_COLLECTION_VIDEOS_URL =
    'https://api.bilibili.com/x/space/fav/season/list';
const PAGE_SIZE = 20;
const UGC_COLLECTION_TYPE = 21;

export type FollowedCollectionAuthor = {
    mid: string | null;
    name: string;
    avatarUrl: string;
};

export type FollowedCollection = {
    id: string;
    title: string;
    coverUrl: string;
    mediaCount: number;
    author: FollowedCollectionAuthor;
};

export type FollowedCollectionVideo = {
    bvid: string;
    title: string;
    coverUrl: string;
    durationSeconds: number;
    publishedAt: number;
};

export type FollowedCollectionPage = {
    collections: FollowedCollection[];
    nextPage: number;
    hasMore: boolean;
};

export type FollowedCollectionDetailPage = {
    collection: FollowedCollection;
    videos: FollowedCollectionVideo[];
    hasMore: boolean;
};

export type FollowedCollectionDetail = {
    collection: FollowedCollection;
    videos: FollowedCollectionVideo[];
};

export class FollowedCollectionsRequestError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'FollowedCollectionsRequestError';
        this.code = code;
    }
}

function getRequestIdentity(cookie: string): { mid: string; sessdata: string } {
    const mid = getCookieValue(cookie, 'DedeUserID');
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!mid || !/^\d+$/.test(mid)) {
        throw new FollowedCollectionsRequestError(
            '登录信息中没有有效的DedeUserID,请重新登录',
        );
    }

    if (!sessdata) {
        throw new FollowedCollectionsRequestError(
            '登录信息中没有有效的SESSDATA,请重新登录',
        );
    }

    return { mid, sessdata };
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new FollowedCollectionsRequestError(
            '登录信息中没有有效的SESSDATA,请重新登录',
        );
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
        throw new FollowedCollectionsRequestError(
            `合集接口请求失败,HTTP ${response.status}`,
        );
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new FollowedCollectionsRequestError('合集接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body.message) ?? '未知错误';
        throw new FollowedCollectionsRequestError(
            `合集接口错误 ${code}:${message}`,
            code,
        );
    }

    return body;
}

function parseCollectionAuthor(value: unknown): FollowedCollectionAuthor {
    const author = asRecord(value);

    return {
        mid: readPositiveId(author?.mid),
        name: readString(author?.name) ?? '未知UP主',
        avatarUrl: normalizeImageUrl(author?.face) ?? DEFAULT_AVATAR_URL,
    };
}

function parseFollowedCollection(value: unknown): FollowedCollection | null {
    const collection = asRecord(value);
    const id = readPositiveId(collection?.id);
    const title = readString(collection?.title);
    const coverUrl = normalizeImageUrl(collection?.cover);

    if (!collection || !id || !title || !coverUrl) {
        return null;
    }

    return {
        id,
        title,
        coverUrl,
        mediaCount: readNumber(collection.media_count) ?? 0,
        author: parseCollectionAuthor(collection.upper),
    };
}

function parseFollowedCollectionVideo(
    value: unknown,
): FollowedCollectionVideo | null {
    const video = asRecord(value);
    const bvid = readString(video?.bvid);
    const title = readString(video?.title);
    const coverUrl = normalizeImageUrl(video?.cover);

    if (!video || !bvid || !title || !coverUrl) {
        return null;
    }

    return {
        bvid,
        title,
        coverUrl,
        durationSeconds: readNumber(video.duration) ?? 0,
        publishedAt: readNumber(video.pubtime) ?? 0,
    };
}

export async function fetchFollowedCollectionPage(
    startPage: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<FollowedCollectionPage> {
    if (!Number.isInteger(startPage) || startPage < 1) {
        throw new FollowedCollectionsRequestError('合集页码无效');
    }

    const { mid, sessdata } = getRequestIdentity(cookie);
    let page = startPage;

    while (true) {
        const parameters = new URLSearchParams({
            up_mid: mid,
            pn: String(page),
            ps: String(PAGE_SIZE),
            platform: 'web',
        });
        const body = await requestBilibili(
            `${FOLLOWED_COLLECTIONS_URL}?${parameters.toString()}`,
            sessdata,
            signal,
        );
        const data = asRecord(body.data);
        const list = Array.isArray(data?.list) ? data.list : [];
        const collections = list
            .filter((item) => readNumber(asRecord(item)?.type) === UGC_COLLECTION_TYPE)
            .map(parseFollowedCollection)
            .filter((item): item is FollowedCollection => item !== null);
        const hasMore = typeof data?.has_more === 'boolean'
            ? data.has_more
            : list.length >= PAGE_SIZE;

        page += 1;

        if (collections.length > 0 || !hasMore) {
            return {
                collections,
                nextPage: page,
                hasMore,
            };
        }
    }
}

export async function fetchFollowedCollectionDetailPage(
    collectionId: string,
    page: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<FollowedCollectionDetailPage> {
    if (!/^\d+$/.test(collectionId)) {
        throw new FollowedCollectionsRequestError('合集ID无效');
    }

    if (!Number.isInteger(page) || page < 1) {
        throw new FollowedCollectionsRequestError('合集详情页码无效');
    }

    const sessdata = getSessdataPair(cookie);
    const parameters = new URLSearchParams({
        season_id: collectionId,
        pn: String(page),
        ps: String(PAGE_SIZE),
    });
    const body = await requestBilibili(
        `${FOLLOWED_COLLECTION_VIDEOS_URL}?${parameters.toString()}`,
        sessdata,
        signal,
    );
    const data = asRecord(body.data);
    const collection = parseFollowedCollection(data?.info);

    if (!data || !collection) {
        throw new FollowedCollectionsRequestError('合集详情数据不完整');
    }

    const medias = Array.isArray(data.medias) ? data.medias : [];
    const videos = medias
        .map(parseFollowedCollectionVideo)
        .filter((video): video is FollowedCollectionVideo => video !== null);

    return {
        collection,
        videos,
        hasMore:
            medias.length > 0 &&
            page * PAGE_SIZE < collection.mediaCount,
    };
}

export async function fetchFollowedCollectionDetail(
    collectionId: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<FollowedCollectionDetail> {
    let page = 1;
    let collection: FollowedCollection | null = null;
    let videos: FollowedCollectionVideo[] = [];
    let hasMore = true;
    const bvids = new Set<string>();

    while (hasMore) {
        const result = await fetchFollowedCollectionDetailPage(
            collectionId,
            page,
            cookie,
            signal,
        );
        const uniqueVideos = result.videos.filter((video) => {
            if (bvids.has(video.bvid)) {
                return false;
            }

            bvids.add(video.bvid);
            return true;
        });

        collection = result.collection;
        videos = [...videos, ...uniqueVideos];
        hasMore = result.hasMore;
        page += 1;
    }

    if (!collection) {
        throw new FollowedCollectionsRequestError('合集详情数据不完整');
    }

    return { collection, videos };
}
