export const BILIBILI_REFERER = 'https://www.bilibili.com/';
export const BILIBILI_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const BILIBILI_IMAGE_HEADERS = {
    Referer: BILIBILI_REFERER,
    'User-Agent': BILIBILI_USER_AGENT,
};
export const BILIBILI_DEFAULT_AVATAR_URL =
    'https://i0.hdslb.com/bfs/face/member/noface.jpg';

const BILIBILI_THUMBNAIL_MAX_EDGE = 1440;
const BILIBILI_THUMBNAIL_QUALITY = 80;

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as JsonRecord;
}

export function readString(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return null;
}

export function readNonEmptyString(value: unknown): string | null {
    const text = readString(value)?.trim();
    return text ? text : null;
}

export function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    return null;
}

export function readPositiveId(value: unknown): string | null {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
        return value.trim();
    }

    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
        return String(value);
    }

    return null;
}

export function normalizeImageUrl(value: unknown): string | null {
    const url = readNonEmptyString(value);

    if (!url) {
        return null;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    return url.replace(/^http:\/\//i, 'https://');
}

export function buildBilibiliThumbnailUrl(
    sourceUrl: string,
    requestedWidth: number,
    requestedHeight: number,
): string {
    const normalizedUrl = normalizeImageUrl(sourceUrl);

    if (
        !normalizedUrl ||
        !Number.isFinite(requestedWidth) ||
        !Number.isFinite(requestedHeight) ||
        requestedWidth <= 0 ||
        requestedHeight <= 0
    ) {
        return sourceUrl;
    }

    try {
        const url = new URL(normalizedUrl);
        const isBilibiliImageHost =
            url.hostname === 'hdslb.com' ||
            url.hostname.endsWith('.hdslb.com') ||
            url.hostname === 'biliimg.com' ||
            url.hostname.endsWith('.biliimg.com');

        if (!isBilibiliImageHost || !url.pathname.startsWith('/bfs/')) {
            return sourceUrl;
        }

        const requestedMaxEdge = Math.max(requestedWidth, requestedHeight);
        const scale = requestedMaxEdge > BILIBILI_THUMBNAIL_MAX_EDGE
            ? BILIBILI_THUMBNAIL_MAX_EDGE / requestedMaxEdge
            : 1;
        const width = Math.max(1, Math.round(requestedWidth * scale));
        const height = Math.max(1, Math.round(requestedHeight * scale));
        const lastSlashIndex = url.pathname.lastIndexOf('/');
        const existingParametersIndex = url.pathname.indexOf(
            '@',
            lastSlashIndex + 1,
        );
        const originalPath = existingParametersIndex >= 0
            ? url.pathname.slice(0, existingParametersIndex)
            : url.pathname;

        url.pathname =
            `${originalPath}@${width}w_${height}h_1e_` +
            `${BILIBILI_THUMBNAIL_QUALITY}q.webp`;

        return url.toString();
    } catch {
        return sourceUrl;
    }
}

export function getCookiePair(cookie: string, cookieName: string): string | null {
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

export function getCookieValue(cookie: string, cookieName: string): string | null {
    const pair = getCookiePair(cookie, cookieName);
    return pair ? pair.slice(pair.indexOf('=') + 1) : null;
}
