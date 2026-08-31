import type {
    SubtitleCue,
    TranscriptSource,
} from '../domain/videoSummary';
import {
    clearWbiKeyCache,
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';
import {
    asRecord,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    getCookiePair,
    readNonEmptyString as readString,
    readNumber,
    type JsonRecord,
} from '@/tool/bilibiliApi';

const PLAYER_INFO_URL = 'https://api.bilibili.com/x/player/wbi/v2';

export type BilibiliSubtitleTrack = {
    language: string;
    displayName: string;
    url: string;
    source: TranscriptSource;
};

export type BilibiliSubtitle = {
    track: BilibiliSubtitleTrack;
    cues: readonly SubtitleCue[];
    sourceHash: string;
};

export type BilibiliSubtitleResult =
    | {
        status: 'available';
        subtitle: BilibiliSubtitle;
    }
    | {
        status: 'unavailable';
        reason: 'no-subtitle';
    };

export class BilibiliSubtitleError extends Error {
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'BilibiliSubtitleError';
        this.status = status;
        this.code = code;
    }
}

function normalizeUrl(value: unknown): string | null {
    const url = readString(value);

    if (!url) {
        return null;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    if (url.startsWith('https://')) {
        return url;
    }

    return null;
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (sessdata) {
        return sessdata;
    }

    throw new BilibiliSubtitleError('登录信息中没有有效的 SESSDATA');
}

function parseTrack(value: unknown): BilibiliSubtitleTrack | null {
    const record = asRecord(value);
    const language = readString(record?.lan);
    const url = normalizeUrl(record?.subtitle_url)
        ?? normalizeUrl(record?.subtitle_url_v2);

    if (!language || !url) {
        return null;
    }

    const source: TranscriptSource = readNumber(record?.type) === 1
        ? 'bilibili-ai'
        : 'bilibili-human';
    const displayName = readString(record?.lan_doc) ?? language;

    return {
        language,
        displayName,
        url,
        source,
    };
}

function getTrackPriority(track: BilibiliSubtitleTrack): number {
    const isChinese = track.language.toLowerCase().includes('zh');
    const isAi = track.source === 'bilibili-ai';

    if (isChinese && !isAi) {
        return 0;
    }

    if (isChinese) {
        return 1;
    }

    return isAi ? 3 : 2;
}

function parseCues(value: unknown): SubtitleCue[] {
    const body = asRecord(value);
    const rawCues = Array.isArray(body?.body) ? body.body : [];

    return rawCues.flatMap((rawCue): SubtitleCue[] => {
        const cue = asRecord(rawCue);
        const startSeconds = readNumber(cue?.from);
        const endSeconds = readNumber(cue?.to);
        const text = readString(cue?.content)?.replace(/\s+/g, ' ');

        if (
            startSeconds === null
            || endSeconds === null
            || startSeconds < 0
            || endSeconds <= startSeconds
            || !text
        ) {
            return [];
        }

        return [{
            startMs: Math.round(startSeconds * 1000),
            endMs: Math.round(endSeconds * 1000),
            text,
        }];
    });
}

function createSourceHash(cues: readonly SubtitleCue[]): string {
    let hash = 0x811c9dc5;

    for (const cue of cues) {
        const source = `${cue.startMs}:${cue.endMs}:${cue.text}\n`;

        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
    }

    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function requestJson(
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
): Promise<unknown> {
    const response = await fetch(url, {
        method: 'GET',
        headers,
        signal,
    });

    if (!response.ok) {
        throw new BilibiliSubtitleError(
            `字幕接口请求失败,HTTP ${response.status}`,
            response.status,
        );
    }

    try {
        return await response.json();
    } catch {
        throw new BilibiliSubtitleError('字幕接口返回了无法解析的JSON');
    }
}

export async function fetchBilibiliSubtitle(
    bvid: string,
    cid: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<BilibiliSubtitleResult> {
    const sessdata = getSessdataPair(cookie);
    let signedQuery: string;

    try {
        signedQuery = await createWbiSignedQuery(
            { bvid, cid },
            sessdata,
            signal,
        );
    } catch (error) {
        if (error instanceof WbiSigningError) {
            throw new BilibiliSubtitleError(error.message, undefined, error.code);
        }

        throw error;
    }

    const playerInfo = await requestJson(
        `${PLAYER_INFO_URL}?${signedQuery}`,
        {
            Accept: 'application/json',
            Cookie: sessdata,
            Referer: BILIBILI_REFERER,
            'User-Agent': USER_AGENT,
        },
        signal,
    );
    const playerInfoRecord = asRecord(playerInfo);
    const code = readNumber(playerInfoRecord?.code);

    if (code === -403) {
        clearWbiKeyCache();
    }

    if (code === null) {
        throw new BilibiliSubtitleError('播放器信息返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(playerInfoRecord?.message) ?? '未知错误';

        throw new BilibiliSubtitleError(
            `播放器信息接口错误 ${code}:${message}`,
            undefined,
            code,
        );
    }

    const data = asRecord(playerInfoRecord?.data);
    const subtitleInfo = asRecord(data?.subtitle);
    const rawTracks = Array.isArray(subtitleInfo?.subtitles)
        ? subtitleInfo.subtitles
        : [];
    const tracks = rawTracks
        .map(parseTrack)
        .filter((track): track is BilibiliSubtitleTrack => track !== null)
        .sort((left, right) => getTrackPriority(left) - getTrackPriority(right));
    const track = tracks[0];

    if (!track) {
        return {
            status: 'unavailable',
            reason: 'no-subtitle',
        };
    }

    const subtitleJson = await requestJson(
        track.url,
        {
            Accept: 'application/json',
            Referer: BILIBILI_REFERER,
            'User-Agent': USER_AGENT,
        },
        signal,
    );
    const cues = parseCues(subtitleJson);

    if (cues.length === 0) {
        throw new BilibiliSubtitleError('字幕文件中没有可用文本');
    }

    return {
        status: 'available',
        subtitle: {
            track,
            cues,
            sourceHash: createSourceHash(cues),
        },
    };
}
