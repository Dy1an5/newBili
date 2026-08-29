import { useEffect, useMemo, useState } from 'react';
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    TextLayoutEvent,
} from 'react-native';
import {
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function FollowingPictureCard({
    contentText,
    imageUrls,
    avatarUrl,
    authorName,
    publishedTimeText,
}: Props) {
    const { width: previewWidth } = useWindowDimensions();
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

    useEffect(() => {
        setIsContentExpanded(false);
        setIsContentOverflowing(false);
    }, [contentText]);

    const handlePictureLayout = (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;

        if (nextWidth > 0 && nextWidth !== pictureGridWidth) {
            setPictureGridWidth(nextWidth);
        }
    };

    const handlePreviewScrollEnd = (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        if (previewWidth <= 0 || validImageUrls.length <= 1) {
            return;
        }

        const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / previewWidth,
        );
        const clampedIndex = Math.max(
            0,
            Math.min(nextIndex, validImageUrls.length - 1),
        );

        setPreviewPictureIndex(clampedIndex);
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
                                <Image
                                    resizeMode='cover'
                                    source={{ uri: imageUrl }}
                                    style={styles.picture}
                                />
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                <View style={styles.footer}>
                    <View style={styles.authorContainer}>
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.avatar}
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

            {isPreviewVisible ? (
                <Modal
                    animationType='fade'
                    onRequestClose={closePicturePreview}
                    statusBarTranslucent
                    visible
                >
                    <SafeAreaView edges={['top', 'bottom']} style={styles.previewPage}>
                        <FlatList
                            data={validImageUrls}
                            horizontal
                            pagingEnabled
                            bounces={false}
                            decelerationRate='fast'
                            getItemLayout={(_, index) => ({
                                index,
                                length: previewWidth,
                                offset: previewWidth * index,
                            })}
                            initialScrollIndex={previewPictureIndex}
                            keyExtractor={(imageUrl, index) => `preview:${imageUrl}:${index}`}
                            onMomentumScrollEnd={handlePreviewScrollEnd}
                            renderItem={({ item: imageUrl, index }) => (
                                <View
                                    accessibilityLabel={`图片,第${index + 1}张,共${validImageUrls.length}张`}
                                    accessible
                                    style={[
                                        styles.previewPictureContainer,
                                        { width: previewWidth },
                                    ]}
                                >
                                    <Image
                                        resizeMode='contain'
                                        source={{ uri: imageUrl }}
                                        style={styles.previewPicture}
                                    />
                                </View>
                            )}
                            scrollEnabled={validImageUrls.length > 1}
                            showsHorizontalScrollIndicator={false}
                            style={styles.previewList}
                        />

                        <Pressable
                            accessibilityLabel='关闭图片预览'
                            accessibilityRole='button'
                            onPress={closePicturePreview}
                            style={({ pressed }) => [
                                styles.previewCloseButton,
                                pressed && styles.previewButtonPressed,
                            ]}
                        >
                            <Text style={styles.previewCloseText}>关闭</Text>
                        </Pressable>

                        <View pointerEvents='none' style={styles.previewCounter}>
                            <Text style={styles.previewCounterText}>
                                {previewPictureIndex + 1}/{validImageUrls.length}
                            </Text>
                        </View>
                    </SafeAreaView>
                </Modal>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,

        padding: spacing.md,

        backgroundColor: colors.surfaceRaised,

        borderWidth: 1,
        borderColor: colors.outline,
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

        color: colors.textPrimary,
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
        color: colors.primary,
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
        backgroundColor: colors.background,
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
        width: 34,
        height: 34,

        borderRadius: radius.full,

        marginRight: spacing.sm,

        backgroundColor: colors.background,
    },

    author: {
        flex: 1,

        fontSize: 14,
        fontWeight: '600',

        color: colors.textSecondary,
    },

    time: {
        fontSize: 13,

        color: colors.textMuted,
    },

    previewPage: {
        flex: 1,
        backgroundColor: colors.background,
    },

    previewList: {
        flex: 1,
    },

    previewPictureContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    previewPicture: {
        width: '100%',
        height: '100%',
    },

    previewCloseButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,

        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,

        borderRadius: radius.full,

        backgroundColor: 'rgba(0,0,0,0.68)',
    },

    previewButtonPressed: {
        opacity: 0.72,
    },

    previewCloseText: {
        color: colors.textOnMedia,
        fontSize: 14,
        fontWeight: '600',
    },

    previewCounter: {
        position: 'absolute',
        bottom: spacing.lg,
        alignSelf: 'center',

        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,

        borderRadius: radius.full,

        backgroundColor: 'rgba(0,0,0,0.68)',
    },

    previewCounterText: {
        color: colors.textOnMedia,
        fontSize: 13,
        fontWeight: '600',
    },
});
