import type { VideoAuthor, VideoSummary } from './video';

export type FollowingGroup = {
    tagId: number;
    name: string;
    memberCount: number;
    tip?: string;
};

export type FollowingVideo = VideoSummary & {
    kind: 'video';
    dynamicId: string;
    durationText?: string;
};

export type FollowingPicture = {
    kind: 'picture';
    dynamicId: string;
    contentText: string;
    imageUrls: string[];
    author: VideoAuthor;
    publishedAt: number;
};

export type FollowingItem = FollowingVideo | FollowingPicture;
