import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import {
    BackHandler,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEvent } from 'expo';
import * as Brightness from 'expo-brightness';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
    addVolumeListener,
    getVolume,
    setVolume,
} from 'react-native-volume-manager';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { VideoPlayback } from '@/page/video/fetchVideoPlayback';

export type FullscreenOrientation = 'portrait' | 'landscape' | 'default';

type Props = {
    embeddedHeight: number;
    playback: VideoPlayback;
    title: string;
    fullscreenOrientation: FullscreenOrientation;
    isFullscreen: boolean;
    onFullscreenChange: (isFullscreen: boolean) => void;
    onPlaybackError: () => void;
};

const DOUBLE_TAP_INTERVAL_MS = 300;
const LONG_PRESS_DELAY_MS = 450;
const TAP_MAX_DURATION_MS = 250;
const TOUCH_MOVE_TOLERANCE = 12;
const FAST_PLAYBACK_RATE = 2;
const PROGRESS_CONTROLS_HIDE_DELAY_MS = 2500;
const ADJUSTMENT_FEEDBACK_HIDE_DELAY_MS = 600;
const NATIVE_ADJUSTMENT_INTERVAL_MS = 50;

type VerticalGesture = 'brightness' | 'volume' | 'blocked';

type AdjustmentFeedback =
    | {
        kind: 'brightness' | 'volume';
        value: number;
    }
    | {
        kind: 'error';
        message: string;
    };

type PendingAdjustment = {
    kind: 'brightness' | 'volume';
    value: number;
};

function clampUnitValue(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function formatPlaybackTime(timeSeconds: number): string {
    const normalizedSeconds = Number.isFinite(timeSeconds)
        ? Math.max(0, Math.floor(timeSeconds))
        : 0;
    const hours = Math.floor(normalizedSeconds / 3600);
    const minutes = Math.floor((normalizedSeconds % 3600) / 60);
    const seconds = normalizedSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds]
            .map((value, index) => index === 0
                ? String(value)
                : String(value).padStart(2, '0'))
            .join(':');
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VideoPlayer({
    embeddedHeight,
    playback,
    title,
    fullscreenOrientation,
    isFullscreen,
    onFullscreenChange,
    onPlaybackError,
}: Props) {
    const { width: windowWidth } = useWindowDimensions();
    const [areProgressControlsVisible, setAreProgressControlsVisible] = useState(false);
    const [adjustmentFeedback, setAdjustmentFeedback] =
        useState<AdjustmentFeedback | null>(null);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const areProgressControlsVisibleRef = useRef(false);
    const lastTapAtRef = useRef(0);
    const touchStartedAtRef = useRef(0);
    const touchStartPositionRef = useRef({ x: 0, y: 0 });
    const touchStartedOnLeftRef = useRef(false);
    const playerWidthRef = useRef(0);
    const playerHeightRef = useRef(0);
    const verticalGestureRef = useRef<VerticalGesture | null>(null);
    const gestureStartValueRef = useRef(0);
    const initialBrightnessRef = useRef<number | null>(null);
    const currentBrightnessRef = useRef<number | null>(null);
    const initialVolumeRef = useRef<number | null>(null);
    const currentVolumeRef = useRef<number | null>(null);
    const hasAdjustedBrightnessRef = useRef(false);
    const hasAdjustedVolumeRef = useRef(false);
    const isMountedRef = useRef(true);
    const lastNativeAdjustmentAtRef = useRef(0);
    const pendingAdjustmentRef = useRef<PendingAdjustment | null>(null);
    const nativeAdjustmentWriteChainRef = useRef<Promise<void>>(Promise.resolve());
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressControlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const adjustmentFeedbackHideTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);
    const nativeAdjustmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressActiveRef = useRef(false);
    const playbackRateBeforeLongPressRef = useRef(1);
    const isFullscreenRef = useRef(false);
    const player = useVideoPlayer(
        {
            uri: playback.url,
            headers: playback.headers,
            contentType: 'progressive',
            metadata: { title },
        },
        (createdPlayer) => {
            createdPlayer.preservesPitch = true;
            createdPlayer.timeUpdateEventInterval = 0.25;
            createdPlayer.play();
        },
    );
    const { status } = useEvent(player, 'statusChange', {
        status: player.status,
    });
    const { currentTime } = useEvent(player, 'timeUpdate', {
        currentTime: player.currentTime,
        currentLiveTimestamp: player.currentLiveTimestamp,
        currentOffsetFromLive: player.currentOffsetFromLive,
        bufferedPosition: player.bufferedPosition,
    });

    useEffect(() => {
        if (!isFullscreen) {
            playerWidthRef.current = windowWidth;
            playerHeightRef.current = embeddedHeight;
        }
    }, [embeddedHeight, isFullscreen, windowWidth]);

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const clearSingleTapTimer = useCallback(() => {
        if (singleTapTimerRef.current !== null) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
        }
    }, []);

    const clearProgressControlsHideTimer = useCallback(() => {
        if (progressControlsHideTimerRef.current !== null) {
            clearTimeout(progressControlsHideTimerRef.current);
            progressControlsHideTimerRef.current = null;
        }
    }, []);

    const clearAdjustmentFeedbackHideTimer = useCallback(() => {
        if (adjustmentFeedbackHideTimerRef.current !== null) {
            clearTimeout(adjustmentFeedbackHideTimerRef.current);
            adjustmentFeedbackHideTimerRef.current = null;
        }
    }, []);

    const clearNativeAdjustmentTimer = useCallback(() => {
        if (nativeAdjustmentTimerRef.current !== null) {
            clearTimeout(nativeAdjustmentTimerRef.current);
            nativeAdjustmentTimerRef.current = null;
        }
    }, []);

    const showAdjustmentError = useCallback((message: string) => {
        if (!isMountedRef.current) {
            return;
        }

        clearAdjustmentFeedbackHideTimer();
        setAdjustmentFeedback({ kind: 'error', message });
        adjustmentFeedbackHideTimerRef.current = setTimeout(() => {
            adjustmentFeedbackHideTimerRef.current = null;
            setAdjustmentFeedback(null);
        }, ADJUSTMENT_FEEDBACK_HIDE_DELAY_MS);
    }, [clearAdjustmentFeedbackHideTimer]);

    const flushNativeAdjustment = useCallback(() => {
        clearNativeAdjustmentTimer();

        const adjustment = pendingAdjustmentRef.current;
        pendingAdjustmentRef.current = null;

        if (adjustment === null) {
            return;
        }

        lastNativeAdjustmentAtRef.current = Date.now();
        nativeAdjustmentWriteChainRef.current = nativeAdjustmentWriteChainRef.current
            .catch(() => undefined)
            .then(async () => {
                if (adjustment.kind === 'brightness') {
                    await Brightness.setBrightnessAsync(adjustment.value);
                    return;
                }

                await setVolume(adjustment.value, {
                    type: 'music',
                    showUI: false,
                    playSound: false,
                });
            })
            .catch(() => {
                clearNativeAdjustmentTimer();
                pendingAdjustmentRef.current = null;
                verticalGestureRef.current = 'blocked';

                if (adjustment.kind === 'brightness') {
                    currentBrightnessRef.current = null;
                } else {
                    currentVolumeRef.current = null;
                }

                showAdjustmentError(
                    adjustment.kind === 'brightness'
                        ? '亮度调节失败'
                        : '音量调节失败',
                );
            });
    }, [clearNativeAdjustmentTimer, showAdjustmentError]);

    const queueNativeAdjustment = useCallback((adjustment: PendingAdjustment) => {
        pendingAdjustmentRef.current = adjustment;

        if (nativeAdjustmentTimerRef.current !== null) {
            return;
        }

        const elapsed = Date.now() - lastNativeAdjustmentAtRef.current;

        if (elapsed >= NATIVE_ADJUSTMENT_INTERVAL_MS) {
            flushNativeAdjustment();
            return;
        }

        nativeAdjustmentTimerRef.current = setTimeout(
            flushNativeAdjustment,
            NATIVE_ADJUSTMENT_INTERVAL_MS - elapsed,
        );
    }, [flushNativeAdjustment]);

    const finishAdjustmentFeedback = useCallback(() => {
        flushNativeAdjustment();
        clearAdjustmentFeedbackHideTimer();
        adjustmentFeedbackHideTimerRef.current = setTimeout(() => {
            adjustmentFeedbackHideTimerRef.current = null;
            setAdjustmentFeedback(null);
        }, ADJUSTMENT_FEEDBACK_HIDE_DELAY_MS);
    }, [clearAdjustmentFeedbackHideTimer, flushNativeAdjustment]);

    const showProgressControls = useCallback(() => {
        clearProgressControlsHideTimer();
        areProgressControlsVisibleRef.current = true;
        setAreProgressControlsVisible(true);
        progressControlsHideTimerRef.current = setTimeout(() => {
            progressControlsHideTimerRef.current = null;
            areProgressControlsVisibleRef.current = false;
            setAreProgressControlsVisible(false);
        }, PROGRESS_CONTROLS_HIDE_DELAY_MS);
    }, [clearProgressControlsHideTimer]);

    const toggleProgressControls = useCallback(() => {
        if (areProgressControlsVisibleRef.current) {
            clearProgressControlsHideTimer();
            areProgressControlsVisibleRef.current = false;
            setAreProgressControlsVisible(false);
            return;
        }

        showProgressControls();
    }, [clearProgressControlsHideTimer, showProgressControls]);

    const restorePlaybackRate = useCallback(() => {
        clearLongPressTimer();

        if (!isLongPressActiveRef.current) {
            return false;
        }

        player.playbackRate = playbackRateBeforeLongPressRef.current;
        isLongPressActiveRef.current = false;
        return true;
    }, [clearLongPressTimer, player]);

    useEffect(() => {
        let isActive = true;
        let volumeSubscription: ReturnType<typeof addVolumeListener> | null = null;

        isMountedRef.current = true;

        void Brightness.getBrightnessAsync()
            .then((brightness) => {
                if (!isActive) {
                    return;
                }

                const normalizedBrightness = clampUnitValue(brightness);
                initialBrightnessRef.current = normalizedBrightness;
                currentBrightnessRef.current = normalizedBrightness;
            })
            .catch(() => undefined);

        void getVolume()
            .then(({ volume }) => {
                if (!isActive) {
                    return;
                }

                const normalizedVolume = clampUnitValue(volume);

                if (initialVolumeRef.current === null) {
                    initialVolumeRef.current = normalizedVolume;
                }

                currentVolumeRef.current = normalizedVolume;
            })
            .catch(() => undefined);

        try {
            volumeSubscription = addVolumeListener(({ type, volume }) => {
                if (!isActive || (type !== undefined && type !== 'music')) {
                    return;
                }

                const normalizedVolume = clampUnitValue(volume);

                if (initialVolumeRef.current === null) {
                    initialVolumeRef.current = normalizedVolume;
                }

                currentVolumeRef.current = normalizedVolume;
            });
        } catch {
            volumeSubscription = null;
        }

        return () => {
            isActive = false;
            isMountedRef.current = false;
            volumeSubscription?.remove();
            clearAdjustmentFeedbackHideTimer();
            clearNativeAdjustmentTimer();
            pendingAdjustmentRef.current = null;

            const shouldRestoreBrightness =
                hasAdjustedBrightnessRef.current &&
                initialBrightnessRef.current !== null;
            const volumeToRestore = hasAdjustedVolumeRef.current
                ? initialVolumeRef.current
                : null;

            void nativeAdjustmentWriteChainRef.current
                .catch(() => undefined)
                .then(async () => {
                    if (shouldRestoreBrightness) {
                        await Brightness.restoreSystemBrightnessAsync()
                            .catch(() => undefined);
                    }

                    if (volumeToRestore !== null) {
                        await setVolume(volumeToRestore, {
                            type: 'music',
                            showUI: false,
                            playSound: false,
                        }).catch(() => undefined);
                    }
                });
        };
    }, [clearAdjustmentFeedbackHideTimer, clearNativeAdjustmentTimer]);

    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
        if (event.nativeEvent.touches.length !== 1) {
            touchStartedAtRef.current = 0;
            verticalGestureRef.current = 'blocked';
            clearLongPressTimer();
            restorePlaybackRate();
            return;
        }

        if (Date.now() - lastTapAtRef.current <= DOUBLE_TAP_INTERVAL_MS) {
            clearSingleTapTimer();
        }

        touchStartedAtRef.current = Date.now();
        touchStartPositionRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
        };
        touchStartedOnLeftRef.current =
            event.nativeEvent.locationX < playerWidthRef.current / 2;
        verticalGestureRef.current = null;
        isLongPressActiveRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            playbackRateBeforeLongPressRef.current = player.playbackRate;
            player.playbackRate = FAST_PLAYBACK_RATE;
            isLongPressActiveRef.current = true;
        }, LONG_PRESS_DELAY_MS);
    }, [
        clearLongPressTimer,
        clearSingleTapTimer,
        player,
        restorePlaybackRate,
    ]);

    const handleTouchMove = useCallback((event: GestureResponderEvent) => {
        const deltaX = event.nativeEvent.pageX - touchStartPositionRef.current.x;
        const deltaY = event.nativeEvent.pageY - touchStartPositionRef.current.y;
        const absoluteDeltaX = Math.abs(deltaX);
        const absoluteDeltaY = Math.abs(deltaY);

        if (
            absoluteDeltaX <= TOUCH_MOVE_TOLERANCE &&
            absoluteDeltaY <= TOUCH_MOVE_TOLERANCE
        ) {
            return;
        }

        clearLongPressTimer();
        touchStartedAtRef.current = 0;

        if (verticalGestureRef.current === null) {
            if (absoluteDeltaY <= absoluteDeltaX) {
                verticalGestureRef.current = 'blocked';
                return;
            }

            restorePlaybackRate();

            const nextGesture = touchStartedOnLeftRef.current
                ? 'brightness'
                : 'volume';
            const startValue = nextGesture === 'brightness'
                ? currentBrightnessRef.current
                : currentVolumeRef.current;

            if (startValue === null || playerHeightRef.current <= 0) {
                verticalGestureRef.current = 'blocked';
                showAdjustmentError(
                    nextGesture === 'brightness'
                        ? '亮度暂不可用'
                        : '音量暂不可用',
                );
                return;
            }

            verticalGestureRef.current = nextGesture;
            gestureStartValueRef.current = startValue;
        }

        const gesture = verticalGestureRef.current;

        if (gesture === null || gesture === 'blocked') {
            return;
        }

        const nextValue = clampUnitValue(
            gestureStartValueRef.current - deltaY / playerHeightRef.current,
        );

        if (gesture === 'brightness') {
            currentBrightnessRef.current = nextValue;
            hasAdjustedBrightnessRef.current = true;
        } else {
            currentVolumeRef.current = nextValue;
            hasAdjustedVolumeRef.current = true;
        }

        clearAdjustmentFeedbackHideTimer();
        setAdjustmentFeedback({ kind: gesture, value: nextValue });
        queueNativeAdjustment({ kind: gesture, value: nextValue });
    }, [
        clearAdjustmentFeedbackHideTimer,
        clearLongPressTimer,
        queueNativeAdjustment,
        restorePlaybackRate,
        showAdjustmentError,
    ]);

    const handleTouchEnd = useCallback(() => {
        clearLongPressTimer();

        if (verticalGestureRef.current !== null) {
            const completedGesture = verticalGestureRef.current;
            verticalGestureRef.current = null;
            touchStartedAtRef.current = 0;
            lastTapAtRef.current = 0;
            restorePlaybackRate();

            if (completedGesture !== 'blocked') {
                finishAdjustmentFeedback();
            }

            return;
        }

        if (restorePlaybackRate()) {
            touchStartedAtRef.current = 0;
            lastTapAtRef.current = 0;
            return;
        }

        const touchStartedAt = touchStartedAtRef.current;
        touchStartedAtRef.current = 0;

        if (touchStartedAt === 0 || Date.now() - touchStartedAt > TAP_MAX_DURATION_MS) {
            return;
        }

        const now = Date.now();

        if (now - lastTapAtRef.current > DOUBLE_TAP_INTERVAL_MS) {
            lastTapAtRef.current = now;
            clearSingleTapTimer();
            singleTapTimerRef.current = setTimeout(() => {
                singleTapTimerRef.current = null;
                toggleProgressControls();
            }, DOUBLE_TAP_INTERVAL_MS);
            return;
        }

        lastTapAtRef.current = 0;
        clearSingleTapTimer();
        player.playing ? player.pause() : player.play();
    }, [
        clearLongPressTimer,
        clearSingleTapTimer,
        finishAdjustmentFeedback,
        player,
        restorePlaybackRate,
        toggleProgressControls,
    ]);

    const handleTouchCancel = useCallback(() => {
        const cancelledGesture = verticalGestureRef.current;
        verticalGestureRef.current = null;
        touchStartedAtRef.current = 0;
        lastTapAtRef.current = 0;
        clearSingleTapTimer();
        restorePlaybackRate();

        if (cancelledGesture !== null && cancelledGesture !== 'blocked') {
            finishAdjustmentFeedback();
        }
    }, [clearSingleTapTimer, finishAdjustmentFeedback, restorePlaybackRate]);

    const seekToTouchPosition = useCallback((event: GestureResponderEvent) => {
        const duration = player.duration;

        if (duration <= 0 || progressBarWidth <= 0) {
            return;
        }

        const progress = Math.min(
            1,
            Math.max(0, event.nativeEvent.locationX / progressBarWidth),
        );
        player.currentTime = duration * progress;
    }, [player, progressBarWidth]);

    const enterFullscreen = useCallback(() => {
        const orientationLock = fullscreenOrientation === 'portrait'
            ? ScreenOrientation.OrientationLock.PORTRAIT_UP
            : fullscreenOrientation === 'landscape'
                ? ScreenOrientation.OrientationLock.LANDSCAPE
                : ScreenOrientation.OrientationLock.DEFAULT;

        isFullscreenRef.current = true;
        onFullscreenChange(true);
        void ScreenOrientation.lockAsync(orientationLock).catch(() => undefined);
    }, [fullscreenOrientation, onFullscreenChange]);

    const exitFullscreen = useCallback(() => {
        isFullscreenRef.current = false;
        onFullscreenChange(false);
        void ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => undefined);
    }, [onFullscreenChange]);

    useEffect(() => {
        if (status === 'error') {
            onPlaybackError();
        }
    }, [onPlaybackError, status]);

    useEffect(() => {
        if (!isFullscreen) {
            return;
        }

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                exitFullscreen();
                return true;
            },
        );

        return () => subscription.remove();
    }, [exitFullscreen, isFullscreen]);

    useEffect(() => () => {
        clearLongPressTimer();
        clearSingleTapTimer();
        clearProgressControlsHideTimer();

        if (isLongPressActiveRef.current) {
            player.playbackRate = playbackRateBeforeLongPressRef.current;
        }

        if (isFullscreenRef.current) {
            void ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP,
            ).catch(() => undefined);
        }
    }, [clearLongPressTimer, clearProgressControlsHideTimer, clearSingleTapTimer, player]);

    const duration = player.duration;
    const playbackProgress = duration > 0
        ? Math.min(1, Math.max(0, currentTime / duration))
        : 0;

    return (
        <View
            onLayout={isFullscreen
                ? (event: LayoutChangeEvent) => {
                    playerWidthRef.current = event.nativeEvent.layout.width;
                    playerHeightRef.current = event.nativeEvent.layout.height;
                }
                : undefined}
            style={styles.playerSurface}
        >
            <StatusBar hidden={isFullscreen} />
            <VideoView
                player={player}
                style={styles.player}
                nativeControls={false}
                contentFit='contain'
                fullscreenOptions={{ enable: false }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
            />

            {adjustmentFeedback ? (
                <View pointerEvents='none' style={styles.adjustmentFeedback}>
                    <MaterialIcons
                        color={colors.primaryText}
                        name={adjustmentFeedback.kind === 'error'
                            ? 'error-outline'
                            : adjustmentFeedback.kind === 'brightness'
                                ? 'brightness-6'
                                : adjustmentFeedback.value === 0
                                    ? 'volume-off'
                                    : adjustmentFeedback.value < 0.5
                                        ? 'volume-down'
                                        : 'volume-up'}
                        size={22}
                    />
                    <Text style={styles.adjustmentFeedbackText}>
                        {adjustmentFeedback.kind === 'error'
                            ? adjustmentFeedback.message
                            : `${Math.round(adjustmentFeedback.value * 100)}%`}
                    </Text>
                </View>
            ) : null}

            {areProgressControlsVisible ? (
                <View style={styles.progressControls}>
                    <Text style={styles.progressTimeText}>
                        {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
                    </Text>
                    <View style={styles.progressControlsRow}>
                        <View
                            accessibilityActions={[
                                { name: 'decrement', label: '后退10秒' },
                                { name: 'increment', label: '前进10秒' },
                            ]}
                            accessibilityLabel='视频进度'
                            accessibilityRole='adjustable'
                            accessibilityValue={{
                                min: 0,
                                max: Math.max(0, Math.round(duration)),
                                now: Math.max(0, Math.round(currentTime)),
                            }}
                            onAccessibilityAction={(event) => {
                                const offset = event.nativeEvent.actionName === 'increment'
                                    ? 10
                                    : -10;
                                player.currentTime = Math.min(
                                    duration,
                                    Math.max(0, player.currentTime + offset),
                                );
                                showProgressControls();
                            }}
                            onLayout={(event) => {
                                setProgressBarWidth(event.nativeEvent.layout.width);
                            }}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={(event) => {
                                seekToTouchPosition(event);
                                showProgressControls();
                            }}
                            onResponderMove={(event) => {
                                seekToTouchPosition(event);
                                showProgressControls();
                            }}
                            onResponderRelease={showProgressControls}
                            onStartShouldSetResponder={() => true}
                            style={styles.progressTouchArea}
                        >
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressPlayed,
                                        { width: `${playbackProgress * 100}%` },
                                    ]}
                                />
                            </View>
                        </View>

                        <Pressable
                            accessibilityLabel={isFullscreen ? '退出全屏' : '进入全屏'}
                            accessibilityRole='button'
                            onPress={isFullscreen ? exitFullscreen : enterFullscreen}
                            style={({ pressed }) => [
                                styles.fullscreenButton,
                                pressed && styles.fullscreenButtonPressed,
                            ]}
                        >
                            <MaterialIcons
                                color={colors.primaryText}
                                name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
                                size={24}
                            />
                        </Pressable>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    playerSurface: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    player: {
        width: '100%',
        height: '100%',
    },
    adjustmentFeedback: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 120,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: colors.mediaOverlayBackground,
        transform: [
            { translateX: -60 },
            { translateY: -22 },
        ],
    },
    adjustmentFeedbackText: {
        color: colors.primaryText,
        fontSize: 13,
        fontWeight: '600',
    },
    progressControls: {
        position: 'absolute',
        right: spacing.md,
        bottom: spacing.sm,
        left: spacing.md,
    },
    progressTimeText: {
        alignSelf: 'flex-end',
        color: colors.primaryText,
        fontSize: 12,
        fontWeight: '500',
    },
    progressControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressTouchArea: {
        flex: 1,
        height: 28,
        justifyContent: 'center',
    },
    progressTrack: {
        height: 3,
        overflow: 'hidden',
        borderRadius: 2,
        backgroundColor: colors.mediaProgressTrack,
    },
    progressPlayed: {
        height: '100%',
        backgroundColor: colors.accentForeground,
    },
    fullscreenButton: {
        marginLeft: spacing.sm,
        minWidth: 52,
        minHeight: 28,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
    },
    fullscreenButtonPressed: {
        opacity: 0.72,
    },
});
