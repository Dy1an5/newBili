import type {
    FollowingItem,
    FollowingPicture,
    FollowingText,
    FollowingVideo,
} from '@/types/following';

const FOLLOWING_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_AVATAR_URL = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';

type JsonRecord = Record<string, unknown>;

type FollowingOpusData = {
    dynamicId: string;
    contentText: string;
    imageUrls: string[];
    author: FollowingPicture['author'];
    publishedAt: number;
};

export type FollowingPageData = {
    dynamics: FollowingItem[];
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

function readNonEmptyString(value: unknown): string | null {
    const text = readString(value)?.trim();

    if (!text) {
        return null;
    }

    return text;
}

function readContentText(value: unknown): string | null {
    const text = readNonEmptyString(value);

    if (!text) {
        return null;
    }

    const normalizedText = text
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n');

    return normalizedText.length > 0 ? normalizedText : null;
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
    const url = readString(value)?.trim();

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

function parseFollowingVideo(value: unknown): FollowingVideo | null {
    const item = asRecord(value);
    const modules = asRecord(item?.modules);
    const author = asRecord(modules?.module_author);
    const dynamic = asRecord(modules?.module_dynamic);
    const major = asRecord(dynamic?.major);

    if (!item || !author || !major || major.type !== 'MAJOR_TYPE_ARCHIVE') {
        return null;
    }

    const archive = asRecord(major.archive);
    const bvid = readNonEmptyString(archive?.bvid);
    const title = readContentText(archive?.title);
    const coverUrl = normalizeImageUrl(archive?.cover);

    if (!bvid || !title || !coverUrl) {
        return null;
    }

    const archiveStats = asRecord(archive?.stat);
    const dynamicId = readNonEmptyString(item.id_str) ?? bvid;
    const durationText = readString(archive?.duration_text);
    const authorMid = readString(author.mid) ?? '';
    const authorName = readString(author.name) ?? '未知UP主';
    const authorAvatarUrl = normalizeImageUrl(author.face) ?? DEFAULT_AVATAR_URL;
    const publishedAt = readNumber(author.pub_ts) ?? 0;

    return {
        kind: 'video',
        dynamicId,
        bvid,
        title,
        coverUrl,
        durationText: durationText ?? undefined,
        author: {
            mid: authorMid,
            name: authorName,
            avatarUrl: authorAvatarUrl,
        },
        publishedAt,
        stats: {
            viewCount: readNumber(archiveStats?.play) ?? undefined,
            danmakuCount: readNumber(archiveStats?.danmaku) ?? undefined,
        },
    };
}

function parseFollowingOpusData(value: unknown): FollowingOpusData | null {
    const item = asRecord(value);
    const modules = asRecord(item?.modules);
    const author = asRecord(modules?.module_author);
    const dynamic = asRecord(modules?.module_dynamic);
    const major = asRecord(dynamic?.major);

    if (!item || !author || !major || major.type !== 'MAJOR_TYPE_OPUS') {
        return null;
    }

    const dynamicId = readNonEmptyString(item.id_str);

    if (!dynamicId) {
        return null;
    }

    const opus = asRecord(major.opus);
    const description = asRecord(dynamic?.desc);
    const summary = asRecord(opus?.summary);
    const contentText =
        readContentText(description?.text) ??
        readContentText(summary?.text) ??
        readContentText(opus?.title) ??
        '';
    const rawPictures = Array.isArray(opus?.pics) ? opus.pics : [];
    const imageUrls = rawPictures
        .map((value) => {
            const picture = asRecord(value);

            return normalizeImageUrl(picture?.url) ?? normalizeImageUrl(picture?.src);
        })
        .filter((imageUrl): imageUrl is string => imageUrl !== null);

    return {
        dynamicId,
        contentText,
        imageUrls,
        author: {
            mid: readString(author.mid) ?? '',
            name: readNonEmptyString(author.name) ?? '未知UP主',
            avatarUrl: normalizeImageUrl(author.face) ?? DEFAULT_AVATAR_URL,
        },
        publishedAt: readNumber(author.pub_ts) ?? 0,
    };
}

function parseFollowingPicture(value: unknown): FollowingPicture | null {
    const opus = parseFollowingOpusData(value);

    if (!opus || opus.imageUrls.length === 0) {
        return null;
    }

    return {
        kind: 'picture',
        ...opus,
    };
}

function parseFollowingText(value: unknown): FollowingText | null {
    const opus = parseFollowingOpusData(value);

    if (!opus || opus.contentText.length === 0) {
        return null;
    }

    return {
        kind: 'text',
        dynamicId: opus.dynamicId,
        contentText: opus.contentText,
        author: opus.author,
        publishedAt: opus.publishedAt,
    };
}

function parseFollowingItem(value: unknown): FollowingItem | null {
    const item = asRecord(value);
    const modules = asRecord(item?.modules);
    const dynamic = asRecord(modules?.module_dynamic);
    const major = asRecord(dynamic?.major);

    if (item?.type === 'DYNAMIC_TYPE_AV' && major?.type === 'MAJOR_TYPE_ARCHIVE') {
        return parseFollowingVideo(value);
    }

    if (item?.type === 'DYNAMIC_TYPE_DRAW' && major?.type === 'MAJOR_TYPE_OPUS') {
        return parseFollowingPicture(value);
    }

    if (item?.type === 'DYNAMIC_TYPE_WORD' && major?.type === 'MAJOR_TYPE_OPUS') {
        return parseFollowingText(value);
    }

    return null;
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
        type: 'all',
        page: '1',
        features: 'itemOpusStyle',
    });

    if (offset) {
        parameters.set('offset', offset);
    }

    return `${FOLLOWING_URL}?${parameters.toString()}`;
}

export async function fetchFollowingPage(
    cookie: string,
    offset?: string,
    signal?: AbortSignal,
): Promise<FollowingPageData> {
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
    const dynamics = rawItems
        .map(parseFollowingItem)
        .filter((item): item is FollowingItem => item !== null);

    return {
        dynamics,
        offset: readString(data.offset),
        hasMore: data.has_more === true,
        diagnostics: {
            rawItemCount: rawItems.length,
            itemTypes: collectItemTypes(rawItems),
            majorTypes: collectMajorTypes(rawItems),
        },
    };
}
