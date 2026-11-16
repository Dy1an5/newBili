import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    normalizeImageUrl,
    readNonEmptyString as readString,
    readNumber,
} from '@/tool/bilibiliApi';
import { requestBilibiliJson } from '@/tool/bilibiliRequest';
import { createGetSessdataPair } from '@/tool/sessdata';
import { createWbiSignedQuery } from '@/tool/wbi';

const SEARCH_VIDEO_URL =
    'https://api.bilibili.com/x/web-interface/wbi/search/type';
const PAGE_SIZE = 20;

export type SearchVideo = {
    bvid: string;
    title: string;
    coverUrl: string;
    durationSeconds: number;
    author: {
        name: string;
        avatarUrl: string;
    };
    playCount: number;
};

export type SearchVideoPage = {
    videos: SearchVideo[];
    hasMore: boolean;
};

export class SearchRequestError extends Error {
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'SearchRequestError';
        this.status = status;
        this.code = code;
    }
}

const getSessdataPair = createGetSessdataPair(SearchRequestError);

const NAMED_HTML_ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
};

function decodeHtmlEntities(value: string): string {
    return value.replace(/&(#\d+|[a-z]+);/gi, (entity, code: string) => {
        if (code.startsWith('#')) {
            const codePoint = Number(code.slice(1));

            return Number.isSafeInteger(codePoint) && codePoint > 0
                ? String.fromCodePoint(codePoint)
                : entity;
        }

        return NAMED_HTML_ENTITIES[code.toLowerCase()] ?? entity;
    });
}

function cleanSearchTitle(value: string): string {
    return decodeHtmlEntities(value.replace(/<[^>]*>/g, '')).trim();
}

function parseDurationSeconds(value: string | null): number {
    if (!value) {
        return 0;
    }

    const parts = value.split(':').map(Number);

    if (parts.some((part) => !Number.isFinite(part))) {
        return 0;
    }

    return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseSearchVideo(value: unknown): SearchVideo | null {
    const video = asRecord(value);
    const bvid = readString(video?.bvid);
    const rawTitle = readString(video?.title);
    const coverUrl = normalizeImageUrl(video?.pic);

    if (!video || !bvid || !rawTitle || !coverUrl) {
        return null;
    }

    return {
        bvid,
        title: cleanSearchTitle(rawTitle),
        coverUrl,
        durationSeconds: parseDurationSeconds(readString(video.duration)),
        author: {
            name: readString(video.author) ?? '未知UP主',
            avatarUrl: normalizeImageUrl(video.upic) ?? DEFAULT_AVATAR_URL,
        },
        playCount: readNumber(video.play) ?? 0,
    };
}

export async function fetchSearchVideoPage(
    keyword: string,
    page: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<SearchVideoPage> {
    const query = await createWbiSignedQuery(
        {
            search_type: 'video',
            keyword,
            page,
            page_size: PAGE_SIZE,
            platform: 'pc',
            web_location: 1430654,
            duration: 0,
        },
        cookie,
        signal,
    );
    const body = await requestBilibiliJson(`${SEARCH_VIDEO_URL}?${query}`, {
        sessdata: getSessdataPair(cookie),
        resourceName: '搜索',
        createError: SearchRequestError,
        referer:
            `https://search.bilibili.com/video?` +
            `keyword=${encodeURIComponent(keyword)}`,
        signal,
    });
    const data = asRecord(body.data);
    const results = Array.isArray(data?.result) ? data.result : [];
    const videos = results
        .map(parseSearchVideo)
        .filter((video): video is SearchVideo => video !== null);

    return {
        videos,
        hasMore: results.length >= PAGE_SIZE,
    };
}
