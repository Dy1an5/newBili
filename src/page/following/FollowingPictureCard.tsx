import { memo, useLayoutEffect, useMemo, useState } from 'react';
import type {
    GestureResponderEvent,
    LayoutChangeEvent,
    TextLayoutEvent,
} from 'react-native';
import {
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import AppText from '@/components/AppText';
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
    onContentPress: () => void;
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
    onContentPress,
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

    const openPicturePreview = (
        event: GestureResponderEvent,
        index: number,
    ) => {
        event.stopPropagation();
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

    const toggleContentExpanded = (event: GestureResponderEvent) => {
        event.stopPropagation();
        setIsContentExpanded((currentIsExpanded) => !currentIsExpanded);
    };

    return (
        <>
            <Pressable
                accessibilityLabel={`查看${authorName}的动态详情和评论`}
                accessibilityRole='button'
                onPress={onContentPress}
                style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                ]}
            >
                {hasContent ? (
                    <View
                        style={[
                            styles.contentContainer,
                            hasPictures && styles.contentContainerWithPictures,
                        ]}
                    >
                        <AppText
                            ellipsizeMode='tail'
                            numberOfLines={
                                isContentExpanded
                                    ? undefined
                                    : COLLAPSED_CONTENT_LINE_COUNT
                            }
                            variant='body'
                        >
                            {contentText}
                        </AppText>

                        <AppText
                            accessibilityElementsHidden
                            importantForAccessibility='no-hide-descendants'
                            key={contentText}
                            onTextLayout={handleContentTextLayout}
                            pointerEvents='none'
                            style={styles.contentMeasurement}
                            variant='body'
                        >
                            {contentText}
                        </AppText>

                        {isContentOverflowing ? (
                            <Pressable
                                accessibilityLabel={isContentExpanded ? '收起动态全文' : '展开动态全文'}
                                accessibilityRole='button'
                                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                onPress={toggleContentExpanded}
                                style={({ pressed }) => [
                                    styles.contentToggle,
                                    pressed && styles.contentTogglePressed,
                                ]}
                            >
                                <AppText color={colors.accentForeground} variant='label'>
                                    {isContentExpanded ? '收起' : '展开'}
                                </AppText>
                            </Pressable>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.emptyContentLink}>
                        <AppText color={colors.accentForeground} variant='label'>
                            查看动态详情与评论
                        </AppText>
                    </View>
                )}

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
                                onPress={(event) => openPicturePreview(event, index)}
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

                        <AppText
                            color={colors.secondaryText}
                            numberOfLines={1}
                            style={styles.author}
                            variant='titleSmall'
                        >
                            {authorName}
                        </AppText>
                    </View>

                    <AppText color={colors.mutedText} variant='caption'>
                        {publishedTimeText}
                    </AppText>
                </View>
            </Pressable>

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

    cardPressed: {
        opacity: 0.9,
    },

    contentContainer: {
        position: 'relative',
    },

    contentContainerWithPictures: {
        marginBottom: spacing.md,
    },

    emptyContentLink: {
        alignSelf: 'flex-start',
        marginBottom: spacing.md,
        paddingVertical: spacing.xs,
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
    },

});
