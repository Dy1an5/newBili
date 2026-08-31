const BILIBILI_VIDEO_KEY_PREFIX = 'bilibili:video';

export type VideoIdentity = {
    bvid: string;
    aid?: string;
};

export type VideoPartIdentity = {
    bvid: string;
    cid: string;
};

export function createVideoEntityKey(
    identity: VideoIdentity,
): string {
    return `${BILIBILI_VIDEO_KEY_PREFIX}:${identity.bvid}`;
}

export function createVideoPartEntityKey(
    identity: VideoPartIdentity,
): string {
    return `${BILIBILI_VIDEO_KEY_PREFIX}:${identity.bvid}:part:${identity.cid}`;
}
