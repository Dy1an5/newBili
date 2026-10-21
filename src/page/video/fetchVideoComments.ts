import {
    clearWbiKeyCache,
    createWbiSignedQuery,
    WbiSigningError,
} from '@/tool/wbi';
import {
    asRecord,
    getCookiePair,
    normalizeImageUrl,
    readNonEmptyString,
    readNumber,
    readPositiveId,
    type JsonRecord,
} from '@/tool/bilibiliApi';
import { requestBilibiliJson } from '@/tool/bilibiliRequest';

const VIDEO_COMMENT_LIST_URL = 'https://api.bilibili.com/x/v2/reply/wbi/main';
const VIDEO_COMMENT_REPLIES_URL = 'https://api.bilibili.com/x/v2/reply/reply';
const VIDEO_COMMENT_MODE_HOT = 3;
const REPLY_PREVIEW_SIZE = 2;
const REPLY_PAGE_SIZE = 10;

export type VideoCommentPicture = {
    url: string;
    width?: number;
    height?: number;
};

export type CommentSubject = {
    oid: string;
    type: number;
};

export type VideoComment = {
    id: string;
    rootId: string;
    parentId?: string;
    author: {
        mid?: string;
        name: string;
        avatarUrl?: string;
    };
    message: string;
    createdAt: number;
    location?: string;
    likeCount: number;
    replyCount: number;
    pictures: VideoCommentPicture[];
    previewReplies: VideoComment[];
    isPinned: boolean;
    isUpAuthor: boolean;
};

export type VideoCommentPage = {
    comments: VideoComment[];
    totalCount: number;
    nextOffset: string | null;
    hasMore: boolean;
};

export type VideoCommentReplyPage = {
    comments: VideoComment[];
    totalCount: number;
    hasMore: boolean;
};

export class VideoCommentsError extends Error {
    readonly status?: number;
    readonly code?: number;

    constructor(message: string, status?: number, code?: number) {
        super(message);
        this.name = 'VideoCommentsError';
        this.status = status;
        this.code = code;
    }
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new VideoCommentsError('登录信息中没有有效的SESSDATA,请重新登录');
    }

    return sessdata;
}

function readNonNegativeInteger(value: unknown): number {
    const number = readNumber(value);

    if (number === null || number < 0) {
        return 0;
    }

    return Math.floor(number);
}

function readOptionalId(primary: unknown, fallback: unknown): string | undefined {
    return readPositiveId(primary) ?? readPositiveId(fallback) ?? undefined;
}

function parsePicture(value: unknown): VideoCommentPicture | null {
    const picture = asRecord(value);
    const url = normalizeImageUrl(picture?.img_src);

    if (!url) {
        return null;
    }

    const width = readNumber(picture?.img_width);
    const height = readNumber(picture?.img_height);

    return {
        url,
        ...(width !== null && width > 0 ? { width } : {}),
        ...(height !== null && height > 0 ? { height } : {}),
    };
}

function parseComment(
    value: unknown,
    upMid: string | undefined,
    isPinned = false,
    includePreviewReplies = true,
): VideoComment | null {
    const reply = asRecord(value);
    const id = readOptionalId(reply?.rpid_str, reply?.rpid);

    if (!reply || !id) {
        return null;
    }

    const member = asRecord(reply.member);
    const content = asRecord(reply.content);
    const replyControl = asRecord(reply.reply_control);
    const authorMid = readOptionalId(member?.mid, reply.mid_str ?? reply.mid);
    const pictures = Array.isArray(content?.pictures)
        ? content.pictures.flatMap((picture): VideoCommentPicture[] => {
            const parsedPicture = parsePicture(picture);
            return parsedPicture ? [parsedPicture] : [];
        })
        : [];
    const previewReplies = includePreviewReplies && Array.isArray(reply.replies)
        ? reply.replies.flatMap((childReply): VideoComment[] => {
            const parsedReply = parseComment(childReply, upMid, false, false);
            return parsedReply ? [parsedReply] : [];
        })
        : [];

    return {
        id,
        rootId: readOptionalId(reply.root_str, reply.root) ?? id,
        parentId: readOptionalId(reply.parent_str, reply.parent),
        author: {
            mid: authorMid,
            name: readNonEmptyString(member?.uname) ?? '未知用户',
            avatarUrl: normalizeImageUrl(member?.avatar) ?? undefined,
        },
        message: readNonEmptyString(content?.message) ?? '',
        createdAt: readNonNegativeInteger(reply.ctime),
        location: readNonEmptyString(replyControl?.location) ?? undefined,
        likeCount: readNonNegativeInteger(reply.like),
        replyCount: readNonNegativeInteger(reply.rcount ?? reply.count),
        pictures,
        previewReplies,
        isPinned,
        isUpAuthor: authorMid !== undefined && authorMid === upMid,
    };
}

function parseCommentList(
    values: unknown[],
    upMid: string | undefined,
    isPinned = false,
): VideoComment[] {
    return values.flatMap((value): VideoComment[] => {
        const comment = parseComment(value, upMid, isPinned);
        return comment ? [comment] : [];
    });
}

function deduplicateComments(comments: VideoComment[]): VideoComment[] {
    const seenIds = new Set<string>();

    return comments.filter((comment) => {
        if (seenIds.has(comment.id)) {
            return false;
        }

        seenIds.add(comment.id);
        return true;
    });
}

async function requestMainCommentPage(
    subject: CommentSubject,
    cookie: string,
    nextOffset: string | null,
    signal?: AbortSignal,
): Promise<JsonRecord> {
    const sessdata = getSessdataPair(cookie);
    const requestSignedPage = async () => {
        try {
            const signedQuery = await createWbiSignedQuery(
                {
                    oid: subject.oid,
                    type: subject.type,
                    mode: VIDEO_COMMENT_MODE_HOT,
                    pagination_str: JSON.stringify({ offset: nextOffset ?? '' }),
                    plat: 1,
                    seek_rpid: '',
                    web_location: 1315875,
                },
                cookie,
                signal,
            );

            return await requestBilibiliJson(
                `${VIDEO_COMMENT_LIST_URL}?${signedQuery}`,
                {
                    sessdata,
                    resourceName: '评论',
                    createError: VideoCommentsError,
                    signal,
                    messageByCode: {
                        12002: '该内容评论区已关闭',
                        12052: '该内容评论区已关闭',
                        12061: '该内容评论区已关闭',
                    },
                },
            );
        } catch (error) {
            if (error instanceof WbiSigningError) {
                throw new VideoCommentsError(error.message, error.code);
            }

            throw error;
        }
    };

    try {
        return await requestSignedPage();
    } catch (error) {
        if (error instanceof VideoCommentsError && error.code === -403) {
            clearWbiKeyCache();
            return requestSignedPage();
        }

        throw error;
    }
}

export async function fetchVideoCommentPage(
    subject: CommentSubject,
    cookie: string,
    nextOffset: string | null,
    signal?: AbortSignal,
): Promise<VideoCommentPage> {
    const body = await requestMainCommentPage(subject, cookie, nextOffset, signal);
    const data = asRecord(body.data);

    if (!data) {
        throw new VideoCommentsError('评论接口缺少data');
    }

    const cursor = asRecord(data.cursor);
    const pagination = asRecord(cursor?.pagination_reply);
    const upper = asRecord(data.upper);
    const upMid = readOptionalId(upper?.mid_str, upper?.mid);
    const top = asRecord(data.top);
    const pinnedValues = [
        top?.upper,
        top?.admin,
        ...(Array.isArray(data.top_replies) ? data.top_replies : []),
    ].filter((value) => value !== null && value !== undefined);
    const regularValues = Array.isArray(data.replies) ? data.replies : [];
    const comments = deduplicateComments([
        ...parseCommentList(pinnedValues, upMid, true),
        ...parseCommentList(regularValues, upMid),
    ]);
    const nextPaginationOffset = readNonEmptyString(pagination?.next_offset);
    const isEnd = cursor?.is_end === true || readNumber(cursor?.is_end) === 1;

    return {
        comments,
        totalCount: readNonNegativeInteger(cursor?.all_count),
        nextOffset: nextPaginationOffset,
        hasMore: !isEnd && nextPaginationOffset !== null,
    };
}

async function fetchVideoCommentReplies(
    subject: CommentSubject,
    rootId: string,
    page: number,
    pageSize: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoCommentReplyPage> {
    if (!Number.isInteger(page) || page < 1) {
        throw new VideoCommentsError('评论回复页码无效');
    }

    const sessdata = getSessdataPair(cookie);
    const parameters = new URLSearchParams({
        oid: subject.oid,
        root: rootId,
        type: String(subject.type),
        pn: String(page),
        ps: String(pageSize),
    });
    const body = await requestBilibiliJson(
        `${VIDEO_COMMENT_REPLIES_URL}?${parameters.toString()}`,
        {
            sessdata,
            resourceName: '评论',
            createError: VideoCommentsError,
            signal,
            messageByCode: {
                12002: '该内容评论区已关闭',
                12052: '该内容评论区已关闭',
                12061: '该内容评论区已关闭',
            },
        },
    );
    const data = asRecord(body.data);

    if (!data) {
        throw new VideoCommentsError('评论回复接口缺少data');
    }

    const pageData = asRecord(data.page);
    const upper = asRecord(data.upper);
    const upMid = readOptionalId(upper?.mid_str, upper?.mid);
    const values = Array.isArray(data.replies) ? data.replies : [];
    const comments = parseCommentList(values, upMid);
    const totalCount = readNonNegativeInteger(pageData?.count);

    return {
        comments,
        totalCount,
        hasMore: totalCount > 0
            ? page * pageSize < totalCount
            : comments.length === pageSize,
    };
}

export async function fetchVideoCommentReplyPreview(
    subject: CommentSubject,
    rootId: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoCommentReplyPage> {
    return fetchVideoCommentReplies(
        subject,
        rootId,
        1,
        REPLY_PREVIEW_SIZE,
        cookie,
        signal,
    );
}

export async function fetchVideoCommentReplyPage(
    subject: CommentSubject,
    rootId: string,
    page: number,
    cookie: string,
    signal?: AbortSignal,
): Promise<VideoCommentReplyPage> {
    return fetchVideoCommentReplies(
        subject,
        rootId,
        page,
        REPLY_PAGE_SIZE,
        cookie,
        signal,
    );
}
