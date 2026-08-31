export const BILIBILI_REFERER = 'https://www.bilibili.com/';
export const BILIBILI_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const BILIBILI_DEFAULT_AVATAR_URL =
    'https://i0.hdslb.com/bfs/face/member/noface.jpg';

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

    return url.startsWith('//') ? `https:${url}` : url;
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
