export type VideoItem = {
    id: string;
    bvid: string;
    title: string;
    cover: string;
    author: {
        id: string;
        name: string;
        avatar: string;
    };
    publishedAt: number;
    stats?: {
        views?: number;
        danmaku?: number;
    };
};

export type VideoCardItem = VideoItem & {
    durationSeconds: number;
};
