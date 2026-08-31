import type {
    VideoIdentity,
    VideoPartIdentity,
} from './videoIdentity';
import { readPositiveId } from '@/tool/bilibiliApi';

export function readBvid(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const bvid = value.trim();

    if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) {
        return null;
    }

    return bvid;
}

export function parseVideoIdentity(
    bvidValue: unknown,
    aidValue?: unknown,
): VideoIdentity | null {
    const bvid = readBvid(bvidValue);

    if (!bvid) {
        return null;
    }

    const aid = readPositiveId(aidValue);

    if (!aid) {
        return { bvid };
    }

    return {
        bvid,
        aid,
    };
}

export function parseVideoPartIdentity(
    bvidValue: unknown,
    cidValue: unknown,
): VideoPartIdentity | null {
    const bvid = readBvid(bvidValue);
    const cid = readPositiveId(cidValue);

    if (!bvid || !cid) {
        return null;
    }

    return {
        bvid,
        cid,
    };
}
