import type { VideoSummary } from './video';

export type FollowingVideo = VideoSummary & {
    dynamicId: string;
    durationText?: string;
};
