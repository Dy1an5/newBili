import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    GestureResponderEvent,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import {
    Animated,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
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

type PanStart = {
    point: Point;
    translateX: number;
    translateY: number;
};

type TapStart = {
    localPoint: Point;
    pagePoint: Point;
    startedAt: number;
};

type CompletedTap = {
    pagePoint: Point;
    endedAt: number;
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
const TAP_MAX_DURATION_MS = 250;
const TAP_MOVE_TOLERANCE = 12;
const DOUBLE_TAP_POSITION_TOLERANCE = 48;
const RESET_SCALE_TOLERANCE = 0.001;
const TRANSFORM_DURATION_MS = 180;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function getPageTouchPoint(event: GestureResponderEvent, index: number): Point {
    const touch = event.nativeEvent.touches[index];

    return {
        x: touch?.pageX ?? 0,
        y: touch?.pageY ?? 0,
    };
}

function getLocalTouchPoint(event: GestureResponderEvent): Point {
    return {
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
    };
}

function getPointDistance(first: Point, second: Point): number {
    return Math.hypot(second.x - first.x, second.y - first.y);
}

function getContainedImageSize(container: Size, image: Size | null): Size {
    if (
        !image
        || image.width <= 0
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
    image: Size | null,
): Point {
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
    const containerRef = useRef<View>(null);
    const scale = useRef(new Animated.Value(MIN_SCALE)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scaleRef = useRef(MIN_SCALE);
    const translateRef = useRef<Point>({ x: 0, y: 0 });
    const containerSizeRef = useRef<Size>({ width, height: 0 });
    const containerOriginRef = useRef<Point | null>(null);
    const imageSizeRef = useRef<Size | null>(null);
    const panStartRef = useRef<PanStart | null>(null);
    const tapStartRef = useRef<TapStart | null>(null);
    const completedTapRef = useRef<CompletedTap | null>(null);
    const isZoomedRef = useRef(false);
    const isTransformAnimatingRef = useRef(false);

    const setZoomed = useCallback((nextIsZoomed: boolean) => {
        if (isZoomedRef.current === nextIsZoomed) {
            return;
        }

        isZoomedRef.current = nextIsZoomed;
        onZoomedChange(nextIsZoomed);
    }, [onZoomedChange]);

    const setTransform = useCallback((
        nextScale: number,
        nextTranslation: Point,
    ) => {
        scaleRef.current = nextScale;
        translateRef.current = nextTranslation;
        scale.setValue(nextScale);
        translateX.setValue(nextTranslation.x);
        translateY.setValue(nextTranslation.y);
        setZoomed(nextScale > MIN_SCALE + RESET_SCALE_TOLERANCE);
    }, [scale, setZoomed, translateX, translateY]);

    const resetTransform = useCallback((animated: boolean) => {
        panStartRef.current = null;
        scaleRef.current = MIN_SCALE;
        translateRef.current = { x: 0, y: 0 };

        if (!animated) {
            isTransformAnimatingRef.current = false;
            scale.stopAnimation();
            translateX.stopAnimation();
            translateY.stopAnimation();
            scale.setValue(MIN_SCALE);
            translateX.setValue(0);
            translateY.setValue(0);
            setZoomed(false);
            return;
        }

        isTransformAnimatingRef.current = true;
        Animated.parallel([
            Animated.timing(scale, {
                duration: TRANSFORM_DURATION_MS,
                toValue: MIN_SCALE,
                useNativeDriver: true,
            }),
            Animated.timing(translateX, {
                duration: TRANSFORM_DURATION_MS,
                toValue: 0,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                duration: TRANSFORM_DURATION_MS,
                toValue: 0,
                useNativeDriver: true,
            }),
        ]).start(() => {
            isTransformAnimatingRef.current = false;
            setZoomed(false);
        });
    }, [scale, setZoomed, translateX, translateY]);

    const startPan = useCallback((event: GestureResponderEvent) => {
        panStartRef.current = {
            point: getPageTouchPoint(event, 0),
            translateX: translateRef.current.x,
            translateY: translateRef.current.y,
        };
    }, []);

    const finishPan = useCallback(() => {
        panStartRef.current = null;
    }, []);

    const animateTransform = useCallback((
        nextScale: number,
        nextTranslation: Point,
    ) => {
        panStartRef.current = null;
        scaleRef.current = nextScale;
        translateRef.current = nextTranslation;
        setZoomed(nextScale > MIN_SCALE + RESET_SCALE_TOLERANCE);
        isTransformAnimatingRef.current = true;

        Animated.parallel([
            Animated.timing(scale, {
                duration: TRANSFORM_DURATION_MS,
                toValue: nextScale,
                useNativeDriver: true,
            }),
            Animated.timing(translateX, {
                duration: TRANSFORM_DURATION_MS,
                toValue: nextTranslation.x,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                duration: TRANSFORM_DURATION_MS,
                toValue: nextTranslation.y,
                useNativeDriver: true,
            }),
        ]).start(() => {
            isTransformAnimatingRef.current = false;
        });
    }, [scale, setZoomed, translateX, translateY]);

    const handleDoubleTap = useCallback((point: Point) => {
        if (isTransformAnimatingRef.current) {
            return;
        }

        if (scaleRef.current > MIN_SCALE + RESET_SCALE_TOLERANCE) {
            resetTransform(true);
            return;
        }

        const containerCenter = {
            x: containerSizeRef.current.width / 2,
            y: containerSizeRef.current.height / 2,
        };
        const nextTranslation = clampTranslation(
            (MIN_SCALE - DOUBLE_TAP_SCALE) * (point.x - containerCenter.x),
            (MIN_SCALE - DOUBLE_TAP_SCALE) * (point.y - containerCenter.y),
            DOUBLE_TAP_SCALE,
            containerSizeRef.current,
            imageSizeRef.current,
        );

        animateTransform(DOUBLE_TAP_SCALE, nextTranslation);
    }, [animateTransform, resetTransform]);

    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
        if (event.nativeEvent.touches.length !== 1) {
            tapStartRef.current = null;
            completedTapRef.current = null;
            return;
        }

        const pagePoint = getPageTouchPoint(event, 0);
        const containerOrigin = containerOriginRef.current;

        tapStartRef.current = {
            localPoint: containerOrigin
                ? {
                    x: pagePoint.x - containerOrigin.x,
                    y: pagePoint.y - containerOrigin.y,
                }
                : getLocalTouchPoint(event),
            pagePoint,
            startedAt: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((event: GestureResponderEvent) => {
        const tapStart = tapStartRef.current;

        if (
            !tapStart
            || event.nativeEvent.touches.length !== 1
        ) {
            return;
        }

        if (
            getPointDistance(tapStart.pagePoint, getPageTouchPoint(event, 0))
            > TAP_MOVE_TOLERANCE
        ) {
            tapStartRef.current = null;
            completedTapRef.current = null;
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        const tapStart = tapStartRef.current;
        tapStartRef.current = null;

        if (
            !tapStart
            || Date.now() - tapStart.startedAt > TAP_MAX_DURATION_MS
        ) {
            return;
        }

        const now = Date.now();
        const previousTap = completedTapRef.current;

        if (
            !previousTap
            || now - previousTap.endedAt > DOUBLE_TAP_INTERVAL_MS
            || getPointDistance(previousTap.pagePoint, tapStart.pagePoint)
                > DOUBLE_TAP_POSITION_TOLERANCE
        ) {
            completedTapRef.current = {
                pagePoint: tapStart.pagePoint,
                endedAt: now,
            };
            return;
        }

        completedTapRef.current = null;
        handleDoubleTap(tapStart.localPoint);
    }, [handleDoubleTap]);

    const handleTouchCancel = useCallback(() => {
        tapStartRef.current = null;
        completedTapRef.current = null;
    }, []);

    const handleResponderGrant = useCallback((event: GestureResponderEvent) => {
        if (
            !isTransformAnimatingRef.current
            && event.nativeEvent.touches.length === 1
            && scaleRef.current > MIN_SCALE
        ) {
            startPan(event);
        }
    }, [startPan]);

    const handleResponderMove = useCallback((event: GestureResponderEvent) => {
        if (
            !isTransformAnimatingRef.current
            && event.nativeEvent.touches.length === 1
            && scaleRef.current > MIN_SCALE
        ) {
            if (!panStartRef.current) {
                startPan(event);
            }

            const panStart = panStartRef.current;

            if (!panStart) {
                return;
            }

            const point = getPageTouchPoint(event, 0);
            const nextTranslation = clampTranslation(
                panStart.translateX + point.x - panStart.point.x,
                panStart.translateY + point.y - panStart.point.y,
                scaleRef.current,
                containerSizeRef.current,
                imageSizeRef.current,
            );

            setTransform(scaleRef.current, nextTranslation);
        }
    }, [setTransform, startPan]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        const previousSize = containerSizeRef.current;

        containerSizeRef.current = {
            width: nextWidth,
            height: nextHeight,
        };
        containerRef.current?.measureInWindow((x, y) => {
            containerOriginRef.current = { x, y };
        });

        if (
            previousSize.width !== nextWidth
            || previousSize.height !== nextHeight
        ) {
            resetTransform(false);
        }
    }, [resetTransform]);

    useEffect(() => {
        if (!active) {
            resetTransform(false);
        }
    }, [active, resetTransform]);

    return (
        <View
            ref={containerRef}
            accessibilityLabel={accessibilityLabel}
            accessible
            onLayout={handleLayout}
            onMoveShouldSetResponderCapture={() => (
                scaleRef.current > MIN_SCALE
            )}
            onResponderGrant={handleResponderGrant}
            onResponderMove={handleResponderMove}
            onResponderRelease={finishPan}
            onResponderTerminate={finishPan}
            onResponderTerminationRequest={() => false}
            onStartShouldSetResponderCapture={() => (
                scaleRef.current > MIN_SCALE
            )}
            onTouchCancel={handleTouchCancel}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            style={[styles.pictureContainer, { width }]}
        >
            <Animated.View
                style={[
                    styles.picture,
                    {
                        transform: [
                            { translateX },
                            { translateY },
                            { scale },
                        ],
                    },
                ]}
            >
                <BilibiliImage
                    contentFit='contain'
                    onLoad={(event) => {
                        imageSizeRef.current = {
                            width: event.source.width,
                            height: event.source.height,
                        };
                    }}
                    priority='high'
                    style={styles.picture}
                    uri={imageUrl}
                />
            </Animated.View>
        </View>
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

    const handleScrollEnd = (
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
    };

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
                            onZoomedChange={(isZoomed) => {
                                if (currentIndex === index) {
                                    setIsCurrentImageZoomed(isZoomed);
                                }
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
