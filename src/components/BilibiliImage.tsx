import { Image, type ImageProps } from 'expo-image';
import { PixelRatio } from 'react-native';

import {
    BILIBILI_IMAGE_HEADERS,
    buildBilibiliThumbnailUrl,
} from '@/tool/bilibiliApi';

type ThumbnailSize = {
    width: number;
    height: number;
};

type Props = Omit<
    ImageProps,
    'cachePolicy' | 'recyclingKey' | 'source'
> & {
    thumbnailSize?: ThumbnailSize;
    uri: string;
};

export default function BilibiliImage({
    contentFit = 'cover',
    priority = 'normal',
    thumbnailSize,
    transition = 120,
    uri,
    ...imageProps
}: Props) {
    const imageUri = thumbnailSize
        ? buildBilibiliThumbnailUrl(
            uri,
            PixelRatio.getPixelSizeForLayoutSize(thumbnailSize.width),
            PixelRatio.getPixelSizeForLayoutSize(thumbnailSize.height),
        )
        : uri;

    return (
        <Image
            {...imageProps}
            cachePolicy='memory-disk'
            contentFit={contentFit}
            priority={priority}
            recyclingKey={imageUri}
            source={{
                uri: imageUri,
                headers: BILIBILI_IMAGE_HEADERS,
            }}
            transition={transition}
        />
    );
}
