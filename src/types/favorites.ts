import type { VideoWithDuration } from './video';

export type FavoriteFolder = {
    id: number;
    title: string;
    mediaCount: number;
};

export type FavoriteVideo = VideoWithDuration & {
    aid?: number;
    favoritedAt: number;
};
