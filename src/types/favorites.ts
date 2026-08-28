import type { VideoCardItem } from './video';

export type FavoriteFolder = {
    id: number;
    title: string;
    mediaCount: number;
};

export type FavoriteVideo = VideoCardItem & {
    favoriteAt: number;
};
