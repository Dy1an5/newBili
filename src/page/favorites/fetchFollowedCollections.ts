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

const FOLLOWED_COLLECTIONS_URL =
    'https://api.bilibili.com/x/v3/fav/folder/collected/list';
const FOLLOWED_COLLECTION_VIDEOS_URL =
    'https://api.bilibili.com/x/space/fav/season/list';
const PAGE_SIZE = 20;
const UGC_COLLECTION_TYPE = 21;
const MAX_EMPTY_PAGE_SCAN = 5;

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
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'FollowedCollectionsRequestError';
        this.status = status;
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

    // 接口按页返回, 但界面上只有 UGC 合集有用, 所以要跳过不含 UGC 合集的页.
    // 这个跳过必须有上限: 接口一直报 has_more 时, while(true) 会无限请求下去.
    while (page - startPage < MAX_EMPTY_PAGE_SCAN) {
        const parameters = new URLSearchParams({
            up_mid: mid,
            pn: String(page),
            ps: String(PAGE_SIZE),
            platform: 'web',
        });
        const body = await requestBilibiliJson(
            `${FOLLOWED_COLLECTIONS_URL}?${parameters.toString()}`,
            {
                sessdata,
                resourceName: '合集',
                createError: FollowedCollectionsRequestError,
                signal,
            },
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

    // 扫描到上限仍未找到 UGC 合集. 上一页报的是还有下一页, 所以 hasMore 保持 true,
    // 让界面上的下一次加载可以从这里继续往后扫.
    return {
        collections: [],
        nextPage: page,
        hasMore: true,
    };
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
    const body = await requestBilibiliJson(
        `${FOLLOWED_COLLECTION_VIDEOS_URL}?${parameters.toString()}`,
        {
            sessdata,
            resourceName: '合集',
            createError: FollowedCollectionsRequestError,
            signal,
        },
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
