export type VideoFollowingItem = {
    id: string;
    bvid: string;

    title: string;

    cover: string;
    duration?: string;

    author: {
        name: string;
        avatar: string;
    };

    publishedAt: number;

    stats?: {
        views?: number;
        danmaku?: number;
    };
};