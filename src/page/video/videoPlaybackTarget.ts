import type { VideoPlaybackTarget, VideoSummary } from '@/types/video';

export function createVideoPlaybackTarget(
    video: VideoSummary,
    initialCid?: number,
): VideoPlaybackTarget {
    return {
        bvid: video.bvid,
        initialCid,
        title: video.title,
        authorName: video.author.name,
    };
}
