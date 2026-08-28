import type { VideoCardItem } from './video';

export type WatchLaterVideo = VideoCardItem & {
    cid: number;
    progressSeconds: number;
};
