import type { VideoWithDuration } from './video';

export type WatchLaterVideo = VideoWithDuration & {
    aid?: number;
    cid?: number;
    progressSeconds: number;
};
