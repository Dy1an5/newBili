export type VideoAuthor = {
    mid: string;
    name: string;
    avatarUrl: string;
};

export type VideoStats = {
    viewCount?: number;
    danmakuCount?: number;
};

export type VideoSummary = {
    bvid: string;
    title: string;
    coverUrl: string;
    author: VideoAuthor;
    publishedAt: number;
    stats?: VideoStats;
};

export type VideoWithDuration = VideoSummary & {
    durationSeconds: number;
};

export type VideoPlaybackTarget = {
    bvid: string;
    initialCid?: number;
    title: string;
    authorName?: string;
};
