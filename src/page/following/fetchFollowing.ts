import {
    asRecord,
    BILIBILI_DEFAULT_AVATAR_URL as DEFAULT_AVATAR_URL,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    getCookiePair,
    getCookieValue,
    normalizeImageUrl,
    readNonEmptyString,
    readNumber,
    readPositiveId,
    readString,
    type JsonRecord,
} from '@/tool/bilibiliApi';
import type { CommentSubject } from '@/page/video/fetchVideoComments';

const FOLLOWING_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all';
const FOLLOWING_DETAIL_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail';
const FOLLOWING_GROUPS_URL = 'https://api.bilibili.com/x/relation/tags';
const FOLLOWING_GROUP_MEMBERS_URL = 'https://api.bilibili.com/x/relation/tag';
const FOLLOWING_GROUP_MEMBER_PAGE_SIZE = 20;
type FollowingAuthor = {
    mid: string;
    name: string;
    avatarUrl: string;
};

export type FollowingGroup = {
    tagId: string;
    name: string;
    memberCount: number;
    tip?: string;
};

export type FollowingVideo = {
    kind: 'video';
    dynamicId: string;
    bvid: string;
    title: string;
    coverUrl: string;
    author: FollowingAuthor;
    publishedAt: number;
};

export type FollowingPicture = {
    kind: 'picture';
    dynamicId: string;
    contentText: string;
    imageUrls: string[];
    author: FollowingAuthor;
    publishedAt: number;
    commentCount: number | null;
    commentSubject: CommentSubject | null;
};

export type FollowingItem = FollowingVideo | FollowingPicture;

type FollowingOpusData = {
    dynamicId: string;
    contentText: string;
    imageUrls: string[];
    author: FollowingPicture['author'];
    publishedAt: number;
    commentCount: number | null;
    commentSubject: CommentSubject | null;
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

function parseCommentSubject(item: JsonRecord): CommentSubject | null {
    const basic = asRecord(item.basic);
    const oid = readPositiveId(basic?.comment_id_str);
    const type = readNumber(basic?.comment_type);

    if (!oid || type === null || !Number.isInteger(type) || type <= 0) {
        return null;
    }

    return { oid, type };
}

function parseCommentCount(modules: JsonRecord): number | null {
    const moduleStat = asRecord(modules.module_stat);
    const comment = asRecord(moduleStat?.comment);
    const count = readNumber(comment?.count);

    if (count === null || count < 0) {
        return null;
    }

    return Math.floor(count);
}

function readFollowingTagId(value: unknown): string | null {
    const positiveId = readPositiveId(value);

    if (positiveId) {
        return positiveId;
    }

    const tagId = readString(value)?.trim();

    if (tagId === '0' || tagId === '-10' || tagId === '-2') {
        return tagId;
    }

    return null;
}

function getSessdataPair(cookie: string): string {
    const sessdata = getCookiePair(cookie, 'SESSDATA');

    if (!sessdata) {
        throw new FollowingRequestError('登录信息中没有有效的SESSDATA,请重新登录');
    }

    return sessdata;
}

function getRequestIdentity(cookie: string): { mid: string; sessdata: string } {
    const mid = getCookieValue(cookie, 'DedeUserID');
    const sessdata = getSessdataPair(cookie);

    if (!mid || !/^\d+$/.test(mid)) {
        throw new FollowingRequestError('登录信息中没有有效的DedeUserID,请重新登录');
    }

    return { mid, sessdata };
}

async function requestFollowingJson(
    url: string,
    sessdata: string,
    resourceName: string,
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
        throw new FollowingRequestError(`${resourceName}请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new FollowingRequestError(`${resourceName}接口返回格式不正确`);
    }

    if (code !== 0) {
        const message = readString(body.message) ?? '未知错误';
        throw new FollowingRequestError(`${resourceName}接口错误 ${code}:${message}`, code);
    }

    return body;
}

function parseFollowingGroup(value: unknown): FollowingGroup | null {
    const group = asRecord(value);
    const tagId = readFollowingTagId(group?.tagid);
    const name = readNonEmptyString(group?.name);

    if (tagId === null || !name) {
        return null;
    }

    return {
        tagId,
        name,
        memberCount: Math.max(0, readNumber(group?.count) ?? 0),
        tip: readNonEmptyString(group?.tip) ?? undefined,
    };
}

export async function fetchFollowingGroups(
    cookie: string,
    signal?: AbortSignal,
): Promise<FollowingGroup[]> {
    const sessdata = getSessdataPair(cookie);
    const body = await requestFollowingJson(
        FOLLOWING_GROUPS_URL,
        sessdata,
        '关注分组',
        signal,
    );

    if (!Array.isArray(body.data)) {
        throw new FollowingRequestError('关注分组接口没有返回data列表');
    }

    return body.data
        .map(parseFollowingGroup)
        .filter((group): group is FollowingGroup => group !== null);
}

export async function fetchFollowingGroupMemberMids(
    group: FollowingGroup,
    cookie: string,
    signal?: AbortSignal,
): Promise<string[]> {
    const { mid, sessdata } = getRequestIdentity(cookie);
    const memberMids = new Set<string>();
    let pageNumber = 1;

    while (true) {
        const parameters = new URLSearchParams({
            mid,
            tagid: group.tagId,
            pn: String(pageNumber),
            ps: String(FOLLOWING_GROUP_MEMBER_PAGE_SIZE),
        });
        const body = await requestFollowingJson(
            `${FOLLOWING_GROUP_MEMBERS_URL}?${parameters.toString()}`,
            sessdata,
            '关注分组成员',
            signal,
        );

        if (!Array.isArray(body.data)) {
            throw new FollowingRequestError('关注分组成员接口没有返回data列表');
        }

        const previousMemberCount = memberMids.size;

        for (const value of body.data) {
            const memberMid = readNonEmptyString(asRecord(value)?.mid);

            if (memberMid) {
                memberMids.add(memberMid);
            }
        }

        if (
            body.data.length < FOLLOWING_GROUP_MEMBER_PAGE_SIZE ||
            (group.memberCount > 0 && memberMids.size >= group.memberCount) ||
            memberMids.size === previousMemberCount
        ) {
            break;
        }

        pageNumber += 1;
    }

    return [...memberMids];
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

    const dynamicId = readNonEmptyString(item.id_str) ?? bvid;
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
        author: {
            mid: authorMid,
            name: authorName,
            avatarUrl: authorAvatarUrl,
        },
        publishedAt,
    };
}

function parseFollowingOpusData(value: unknown): FollowingOpusData | null {
    const item = asRecord(value);
    const modules = asRecord(item?.modules);
    const author = asRecord(modules?.module_author);
    const dynamic = asRecord(modules?.module_dynamic);
    const major = asRecord(dynamic?.major);

    if (
        !item ||
        !modules ||
        !author ||
        !dynamic ||
        !major ||
        major.type !== 'MAJOR_TYPE_OPUS'
    ) {
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
        commentCount: parseCommentCount(modules),
        commentSubject: parseCommentSubject(item),
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
    const sessdata = getSessdataPair(cookie);
    const body = await requestFollowingJson(
        buildRequestUrl(offset),
        sessdata,
        '动态',
        signal,
    );

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

export async function fetchFollowingPictureDetail(
    dynamicId: string,
    cookie: string,
    signal?: AbortSignal,
): Promise<FollowingPicture> {
    const sessdata = getSessdataPair(cookie);
    const parameters = new URLSearchParams({
        timezone_offset: '-480',
        id: dynamicId,
        features: 'itemOpusStyle',
        web_location: '333.1330',
    });
    const body = await requestFollowingJson(
        `${FOLLOWING_DETAIL_URL}?${parameters.toString()}`,
        sessdata,
        '动态详情',
        signal,
    );
    const data = asRecord(body.data);
    const item = asRecord(data?.item);
    const picture = item ? parseFollowingPicture(item) : null;

    if (!picture || picture.dynamicId !== dynamicId) {
        throw new FollowingRequestError('动态详情接口没有返回有效图文');
    }

    return picture;
}
