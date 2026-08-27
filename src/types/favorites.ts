import type { VideoFollowingItem } from './following';

export type FavoriteFolder = {
    id: number;
    title: string;
    mediaCount: number;
};

export type FavoriteVideo = Omit<VideoFollowingItem, 'duration'> & {
    durationSeconds: number;
    favoriteAt: number;
};
