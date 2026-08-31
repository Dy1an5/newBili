export type VideoPlaybackTarget = {
    bvid: string;
    initialCid?: string;
    title: string;
    authorName?: string;
    authorAvatarUrl?: string;
};

type VideoPlaybackSource = {
    bvid: string;
    title: string;
    author: {
        name: string;
        avatarUrl: string;
    };
};

export function createVideoPlaybackTarget(
    video: VideoPlaybackSource,
    initialCid?: string,
): VideoPlaybackTarget {
    return {
        bvid: video.bvid,
        initialCid,
        title: video.title,
        authorName: video.author.name,
        authorAvatarUrl: video.author.avatarUrl,
    };
}
