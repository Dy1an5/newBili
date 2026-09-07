import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import BilibiliImage from '@/components/BilibiliImage';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    imageUrls: string[];
    initialIndex: number;
    onClose: () => void;
    visible: boolean;
};

type Size = {
    width: number;
    height: number;
};

type Point = {
    x: number;
    y: number;
};

type ZoomablePreviewImageProps = {
    active: boolean;
    accessibilityLabel: string;
    imageUrl: string;
    onZoomedChange: (isZoomed: boolean) => void;
    width: number;
};

const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_INTERVAL_MS = 300;
const RESET_SCALE_TOLERANCE = 0.001;
const TRANSFORM_DURATION_MS = 180;

function clamp(value: number, minimum: number, maximum: number): number {
    'worklet';

    return Math.min(maximum, Math.max(minimum, value));
}

function getContainedImageSize(container: Size, image: Size): Size {
    'worklet';

    if (
        image.width <= 0
        || image.height <= 0
        || container.width <= 0
        || container.height <= 0
    ) {
        return container;
    }

    const scale = Math.min(
        container.width / image.width,
        container.height / image.height,
    );

    return {
        width: image.width * scale,
        height: image.height * scale,
    };
}

function clampTranslation(
    translateX: number,
    translateY: number,
    scale: number,
    container: Size,
    image: Size,
): Point {
    'worklet';

    const displayedImage = getContainedImageSize(container, image);
    const maximumX = Math.max(
        0,
        (displayedImage.width * scale - container.width) / 2,
    );
    const maximumY = Math.max(
        0,
        (displayedImage.height * scale - container.height) / 2,
    );

    return {
        x: clamp(translateX, -maximumX, maximumX),
        y: clamp(translateY, -maximumY, maximumY),
    };
}

function ZoomablePreviewImage({
    active,
    accessibilityLabel,
    imageUrl,
    onZoomedChange,
    width,
}: ZoomablePreviewImageProps) {
    const [isZoomed, setIsZoomed] = useState(false);
    const scale = useSharedValue(MIN_SCALE);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const containerWidth = useSharedValue(width);
    const containerHeight = useSharedValue(0);
    const imageWidth = useSharedValue(0);
    const imageHeight = useSharedValue(0);

    const updateZoomed = useCallback((nextIsZoomed: boolean) => {
        setIsZoomed(nextIsZoomed);
        onZoomedChange(nextIsZoomed);
    }, [onZoomedChange]);

    const resetTransform = useCallback(() => {
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        scale.value = MIN_SCALE;
        translateX.value = 0;
        translateY.value = 0;
        updateZoomed(false);
    }, [scale, translateX, translateY, updateZoomed]);

    useEffect(() => {
        if (!active) {
            resetTransform();
        }
    }, [active, resetTransform]);

    const animatedPictureStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const doubleTapGesture = useMemo(() => Gesture.Tap()
        .enabled(active)
        .numberOfTaps(2)
        .maxDelay(DOUBLE_TAP_INTERVAL_MS)
        .onEnd((event, success) => {
            if (!success) {
                return;
            }

            cancelAnimation(scale);
            cancelAnimation(translateX);
            cancelAnimation(translateY);

            if (scale.value > MIN_SCALE + RESET_SCALE_TOLERANCE) {
                translateX.value = withTiming(0, {
                    duration: TRANSFORM_DURATION_MS,
                });
                translateY.value = withTiming(0, {
                    duration: TRANSFORM_DURATION_MS,
                });
                scale.value = withTiming(MIN_SCALE, {
                    duration: TRANSFORM_DURATION_MS,
                }, (finished) => {
                    if (finished) {
                        runOnJS(updateZoomed)(false);
                    }
                });
                return;
            }

            const container = {
                width: containerWidth.value,
                height: containerHeight.value,
            };
            const image = {
                width: imageWidth.value,
                height: imageHeight.value,
            };
            const containerCenter = {
                x: container.width / 2,
                y: container.height / 2,
            };
            const nextTranslation = clampTranslation(
                (MIN_SCALE - DOUBLE_TAP_SCALE) * (event.x - containerCenter.x),
                (MIN_SCALE - DOUBLE_TAP_SCALE) * (event.y - containerCenter.y),
                DOUBLE_TAP_SCALE,
                container,
                image,
            );

            translateX.value = withTiming(nextTranslation.x, {
                duration: TRANSFORM_DURATION_MS,
            });
            translateY.value = withTiming(nextTranslation.y, {
                duration: TRANSFORM_DURATION_MS,
            });
            scale.value = withTiming(DOUBLE_TAP_SCALE, {
                duration: TRANSFORM_DURATION_MS,
            });
            runOnJS(updateZoomed)(true);
        }), [
        active,
        containerHeight,
        containerWidth,
        imageHeight,
        imageWidth,
        scale,
        translateX,
        translateY,
        updateZoomed,
    ]);

    const panGesture = useMemo(() => Gesture.Pan()
        .enabled(active && isZoomed)
        .maxPointers(1)
        .minDistance(1)
        .onBegin(() => {
            cancelAnimation(translateX);
            cancelAnimation(translateY);
        })
        .onChange((event) => {
            const nextTranslation = clampTranslation(
                translateX.value + event.changeX,
                translateY.value + event.changeY,
                scale.value,
                {
                    width: containerWidth.value,
                    height: containerHeight.value,
                },
                {
                    width: imageWidth.value,
                    height: imageHeight.value,
                },
            );

            translateX.value = nextTranslation.x;
            translateY.value = nextTranslation.y;
        }), [
        active,
        containerHeight,
        containerWidth,
        imageHeight,
        imageWidth,
        isZoomed,
        scale,
        translateX,
        translateY,
    ]);

    const composedGesture = useMemo(
        () => Gesture.Race(panGesture, doubleTapGesture),
        [doubleTapGesture, panGesture],
    );

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        const hasSizeChanged = containerWidth.value !== nextWidth
            || containerHeight.value !== nextHeight;

        containerWidth.value = nextWidth;
        containerHeight.value = nextHeight;

        if (hasSizeChanged) {
            resetTransform();
        }
    }, [containerHeight, containerWidth, resetTransform]);

    return (
        <GestureDetector gesture={composedGesture}>
            <View
                accessibilityLabel={accessibilityLabel}
                accessible
                onLayout={handleLayout}
                style={[styles.pictureContainer, { width }]}
            >
                <Animated.View style={[styles.picture, animatedPictureStyle]}>
                    <BilibiliImage
                        contentFit='contain'
                        onLoad={(event) => {
                            imageWidth.value = event.source.width;
                            imageHeight.value = event.source.height;
                        }}
                        priority='high'
                        style={styles.picture}
                        uri={imageUrl}
                    />
                </Animated.View>
            </View>
        </GestureDetector>
    );
}

export default function FullscreenImageViewer({
    imageUrls,
    initialIndex,
    onClose,
    visible,
}: Props) {
    const { width: previewWidth } = useWindowDimensions();
    const validImageUrls = useMemo(
        () => imageUrls.filter((imageUrl) => imageUrl.trim().length > 0),
        [imageUrls],
    );
    const clampedInitialIndex = Math.max(
        0,
        Math.min(initialIndex, Math.max(0, validImageUrls.length - 1)),
    );
    const [currentIndex, setCurrentIndex] = useState(clampedInitialIndex);
    const [isCurrentImageZoomed, setIsCurrentImageZoomed] = useState(false);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(clampedInitialIndex);
            setIsCurrentImageZoomed(false);
        }
    }, [clampedInitialIndex, visible]);

    const handleZoomedChange = useCallback((
        index: number,
        nextIsZoomed: boolean,
    ) => {
        if (currentIndex === index) {
            setIsCurrentImageZoomed(nextIsZoomed);
        }
    }, [currentIndex]);

    const handleScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        if (previewWidth <= 0 || validImageUrls.length <= 1) {
            return;
        }

        const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / previewWidth,
        );

        setCurrentIndex(Math.max(
            0,
            Math.min(nextIndex, validImageUrls.length - 1),
        ));
        setIsCurrentImageZoomed(false);
    }, [previewWidth, validImageUrls.length]);

    if (!visible || validImageUrls.length === 0) {
        return null;
    }

    return (
        <Modal
            animationType='fade'
            navigationBarTranslucent
            onRequestClose={onClose}
            statusBarTranslucent
            visible
        >
            <GestureHandlerRootView style={styles.page}>
                <SafeAreaView edges={['top', 'bottom']} style={styles.page}>
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
                        initialNumToRender={1}
                        initialScrollIndex={clampedInitialIndex}
                        keyExtractor={(imageUrl, index) => `${imageUrl}:${index}`}
                        maxToRenderPerBatch={1}
                        onMomentumScrollEnd={handleScrollEnd}
                        removeClippedSubviews
                        renderItem={({ item: imageUrl, index }) => (
                            <ZoomablePreviewImage
                                active={currentIndex === index}
                                accessibilityLabel={`图片,第${index + 1}张,共${validImageUrls.length}张`}
                                imageUrl={imageUrl}
                                onZoomedChange={(nextIsZoomed) => {
                                    handleZoomedChange(index, nextIsZoomed);
                                }}
                                width={previewWidth}
                            />
                        )}
                        scrollEnabled={
                            validImageUrls.length > 1
                            && !isCurrentImageZoomed
                        }
                        showsHorizontalScrollIndicator={false}
                        style={styles.list}
                        updateCellsBatchingPeriod={50}
                        windowSize={3}
                    />

                    <View pointerEvents='none' style={styles.counter}>
                        <Text style={styles.counterText}>
                            {currentIndex + 1}/{validImageUrls.length}
                        </Text>
                    </View>
                </SafeAreaView>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    list: {
        flex: 1,
    },
    pictureContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    picture: {
        width: '100%',
        height: '100%',
    },
    counter: {
        position: 'absolute',
        bottom: spacing.lg,
        alignSelf: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: colors.mediaOverlayBackground,
    },
    counterText: {
        color: colors.primaryText,
        fontSize: 13,
        fontWeight: '600',
    },
});
