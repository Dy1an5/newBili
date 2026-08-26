import type { VideoFollowingItem } from '@/types/following';

const VIDEO_FOLLOWING_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_AVATAR_URL = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';

type JsonRecord = Record<string, unknown>;

export type VideoFollowingPage = {
    items: VideoFollowingItem[];
    offset: string | null;
    hasMore: boolean;
    diagnostics: {
        rawItemCount: number;
        itemTypes: string[];
        majorTypes: string[];
    };
};

export class FollowingRequestError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'FollowingRequestError';
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
    if (typeof value === 'string') {
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

function parseVideoFollowingItem(value: unknown): VideoFollowingItem | null {
    const item = asRecord(value);
    const modules = asRecord(item?.modules);
    const author = asRecord(modules?.module_author);
    const dynamic = asRecord(modules?.module_dynamic);
    const major = asRecord(dynamic?.major);

    if (!item || !author || !major || major.type !== 'MAJOR_TYPE_ARCHIVE') {
        return null;
    }

    const archive = asRecord(major.archive);
    const bvid = readString(archive?.bvid);
    const title = readString(archive?.title);
    const cover = normalizeImageUrl(archive?.cover);

    if (!bvid || !title || !cover) {
        return null;
    }

    const id = readString(item.id_str) ?? bvid;
    const duration = readString(archive?.duration_text);
    const authorId = readString(author.mid) ?? '';
    const authorName = readString(author.name) ?? '未知UP主';
    const authorAvatar = normalizeImageUrl(author.face) ?? DEFAULT_AVATAR_URL;
    const publishedAt = readNumber(author.pub_ts) ?? 0;

    return {
        id,
        bvid,
        title,
        cover,
        duration: duration ?? undefined,
        author: {
            id: authorId,
            name: authorName,
            avatar: authorAvatar,
        },
        publishedAt,
    };
}

function collectItemTypes(items: unknown[]): string[] {
    const types = items
        .map((value) => readString(asRecord(value)?.type))
        .filter((value): value is string => value !== null);

    return [...new Set(types)];
}

function collectMajorTypes(items: unknown[]): string[] {
    const types = items
        .map((value) => {
            const item = asRecord(value);
            const modules = asRecord(item?.modules);
            const dynamic = asRecord(modules?.module_dynamic);
            const major = asRecord(dynamic?.major);

            return readString(major?.type);
        })
        .filter((value): value is string => value !== null);

    return [...new Set(types)];
}

function buildRequestUrl(offset?: string): string {
    const parameters = new URLSearchParams({
        timezone_offset: '-480',
        type: 'video',
        page: '1',
        features: 'itemOpusStyle',
    });

    if (offset) {
        parameters.set('offset', offset);
    }

    return `${VIDEO_FOLLOWING_URL}?${parameters.toString()}`;
}

export async function fetchVideoFollowingPage(
    cookie: string,
    offset?: string,
    signal?: AbortSignal,
): Promise<VideoFollowingPage> {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new FollowingRequestError('登录信息中没有有效的 SESSDATA');
    }

    const response = await fetch(buildRequestUrl(offset), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Cookie: sessdata,
            Referer: 'https://www.bilibili.com/',
            'User-Agent': USER_AGENT,
        },
        signal,
    });

    if (!response.ok) {
        throw new FollowingRequestError(`动态请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (code === null) {
        throw new FollowingRequestError('动态接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body?.message) ?? '未知错误';
        throw new FollowingRequestError(`动态接口错误 ${code}:${message}`, code);
    }

    const data = asRecord(body?.data);

    if (!data) {
        throw new FollowingRequestError('动态接口没有返回data对象');
    }

    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems
        .map(parseVideoFollowingItem)
        .filter((item): item is VideoFollowingItem => item !== null);

    return {
        items,
        offset: readString(data.offset),
        hasMore: data.has_more === true,
        diagnostics: {
            rawItemCount: rawItems.length,
            itemTypes: collectItemTypes(rawItems),
            majorTypes: collectMajorTypes(rawItems),
        },
    };
}
