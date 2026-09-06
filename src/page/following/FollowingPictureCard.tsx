import { memo, useLayoutEffect, useMemo, useState } from 'react';
import type {
    LayoutChangeEvent,
    TextLayoutEvent,
} from 'react-native';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import BilibiliImage from '@/components/BilibiliImage';
import FullscreenImageViewer from '@/components/FullscreenImageViewer';
import UserAvatar from '@/components/UserAvatar';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

const MAX_PICTURE_COUNT = 9;
const COLLAPSED_CONTENT_LINE_COUNT = 2;

type Props = {
    contentText: string;
    imageUrls: string[];
    avatarUrl: string;
    authorName: string;
    publishedTimeText: string;
};

function getPictureColumnCount(pictureCount: number): number {
    if (pictureCount <= 0) {
        return 0;
    }

    if (pictureCount === 1) {
        return 1;
    }

    if (pictureCount === 2 || pictureCount === 4) {
        return 2;
    }

    return 3;
}

function FollowingPictureCard({
    contentText,
    imageUrls,
    avatarUrl,
    authorName,
    publishedTimeText,
}: Props) {
    const [pictureGridWidth, setPictureGridWidth] = useState(0);
    const [previewPictureIndex, setPreviewPictureIndex] = useState(0);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isContentOverflowing, setIsContentOverflowing] = useState(false);
    const validImageUrls = useMemo(
        () => imageUrls
            .filter((imageUrl) => imageUrl.trim().length > 0)
            .slice(0, MAX_PICTURE_COUNT),
        [imageUrls],
    );
    const hasContent = contentText.trim().length > 0;
    const hasPictures = validImageUrls.length > 0;
    const pictureColumnCount = getPictureColumnCount(validImageUrls.length);
    const pictureGapWidth = spacing.xs * Math.max(0, pictureColumnCount - 1);
    const pictureTileWidth = pictureColumnCount > 0
        ? Math.max(0, (pictureGridWidth - pictureGapWidth) / pictureColumnCount)
        : 0;

    useLayoutEffect(() => {
        setIsContentExpanded(false);
        setIsContentOverflowing(false);
    }, [contentText]);

    const handlePictureLayout = (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;

        if (nextWidth > 0 && nextWidth !== pictureGridWidth) {
            setPictureGridWidth(nextWidth);
        }
    };

    const openPicturePreview = (index: number) => {
        setPreviewPictureIndex(index);
        setIsPreviewVisible(true);
    };

    const closePicturePreview = () => {
        setIsPreviewVisible(false);
    };

    const handleContentTextLayout = (event: TextLayoutEvent) => {
        const nextIsOverflowing =
            event.nativeEvent.lines.length > COLLAPSED_CONTENT_LINE_COUNT;

        setIsContentOverflowing((currentIsOverflowing) =>
            currentIsOverflowing === nextIsOverflowing
                ? currentIsOverflowing
                : nextIsOverflowing,
        );
    };

    const toggleContentExpanded = () => {
        setIsContentExpanded((currentIsExpanded) => !currentIsExpanded);
    };

    return (
        <>
            <View style={styles.card}>
                {hasContent ? (
                    <View
                        style={[
                            styles.contentContainer,
                            hasPictures && styles.contentContainerWithPictures,
                        ]}
                    >
                        <Text
                            ellipsizeMode='tail'
                            numberOfLines={
                                isContentExpanded
                                    ? undefined
                                    : COLLAPSED_CONTENT_LINE_COUNT
                            }
                            style={styles.contentText}
                        >
                            {contentText}
                        </Text>

                        <Text
                            accessibilityElementsHidden
                            importantForAccessibility='no-hide-descendants'
                            key={contentText}
                            onTextLayout={handleContentTextLayout}
                            pointerEvents='none'
                            style={[styles.contentText, styles.contentMeasurement]}
                        >
                            {contentText}
                        </Text>

                        {isContentOverflowing ? (
                            <Pressable
                                accessibilityLabel={isContentExpanded ? '收起动态全文' : '展开动态全文'}
                                accessibilityRole='button'
                                onPress={toggleContentExpanded}
                                style={({ pressed }) => [
                                    styles.contentToggle,
                                    pressed && styles.contentTogglePressed,
                                ]}
                            >
                                <Text style={styles.contentToggleText}>
                                    {isContentExpanded ? '收起' : '展开'}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}

                {hasPictures ? (
                    <View
                        onLayout={handlePictureLayout}
                        style={styles.pictureGrid}
                    >
                        {validImageUrls.map((imageUrl, index) => (
                            <Pressable
                                accessibilityLabel={`查看图片,第${index + 1}张,共${validImageUrls.length}张`}
                                accessibilityRole='button'
                                key={`${imageUrl}:${index}`}
                                onPress={() => openPicturePreview(index)}
                                style={({ pressed }) => [
                                    styles.pictureTile,
                                    validImageUrls.length === 1 && styles.singlePictureTile,
                                    { width: pictureTileWidth },
                                    pressed && styles.pictureTilePressed,
                                ]}
                            >
                                {pictureTileWidth > 0 ? (
                                    <BilibiliImage
                                        style={styles.picture}
                                        thumbnailSize={{
                                            width: pictureTileWidth,
                                            height: validImageUrls.length === 1
                                                ? pictureTileWidth * 3 / 4
                                                : pictureTileWidth,
                                        }}
                                        uri={imageUrl}
                                    />
                                ) : null}
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                <View style={styles.footer}>
                    <View style={styles.authorContainer}>
                        <UserAvatar
                            name={authorName}
                            size={34}
                            style={styles.avatar}
                            uri={avatarUrl}
                        />

                        <Text
                            numberOfLines={1}
                            style={styles.author}
                        >
                            {authorName}
                        </Text>
                    </View>

                    <Text style={styles.time}>
                        {publishedTimeText}
                    </Text>
                </View>
            </View>

            <FullscreenImageViewer
                imageUrls={validImageUrls}
                initialIndex={previewPictureIndex}
                onClose={closePicturePreview}
                visible={isPreviewVisible}
            />
        </>
    );
}

export default memo(FollowingPictureCard);

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,

        padding: spacing.md,

        backgroundColor: colors.surfaceBackground,

        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.lg,
    },

    contentContainer: {
        position: 'relative',
    },

    contentContainerWithPictures: {
        marginBottom: spacing.md,
    },

    contentText: {
        fontSize: 18,
        lineHeight: 25,

        fontWeight: '700',

        color: colors.primaryText,
    },

    contentMeasurement: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        opacity: 0,
    },

    contentToggle: {
        alignSelf: 'flex-end',
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
    },

    contentTogglePressed: {
        opacity: 0.68,
    },

    contentToggleText: {
        color: colors.accentForeground,
        fontSize: 14,
        fontWeight: '600',
    },

    pictureGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },

    pictureTile: {
        aspectRatio: 1,
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.pageBackground,
    },

    singlePictureTile: {
        aspectRatio: 4 / 3,
    },

    pictureTilePressed: {
        opacity: 0.86,
    },

    picture: {
        width: '100%',
        height: '100%',
    },

    footer: {
        marginTop: spacing.md,

        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    authorContainer: {
        flex: 1,

        flexDirection: 'row',
        alignItems: 'center',

        marginRight: spacing.md,
    },

    avatar: {
        marginRight: spacing.sm,
    },

    author: {
        flex: 1,

        fontSize: 14,
        fontWeight: '600',

        color: colors.secondaryText,
    },

    time: {
        fontSize: 13,

        color: colors.mutedText,
    },

});
