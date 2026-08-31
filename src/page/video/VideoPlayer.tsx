import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
    BackHandler,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { VideoPlayback } from '@/page/video/fetchVideoPlayback';

export type FullscreenOrientation = 'portrait' | 'landscape' | 'default';

type Props = {
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
    playback,
    title,
    fullscreenOrientation,
    isFullscreen,
    onFullscreenChange,
    onPlaybackError,
}: Props) {
    const [areProgressControlsVisible, setAreProgressControlsVisible] = useState(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const areProgressControlsVisibleRef = useRef(false);
    const lastTapAtRef = useRef(0);
    const touchStartedAtRef = useRef(0);
    const touchStartPositionRef = useRef({ x: 0, y: 0 });
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressControlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
        if (event.nativeEvent.touches.length !== 1) {
            clearLongPressTimer();
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
        isLongPressActiveRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            playbackRateBeforeLongPressRef.current = player.playbackRate;
            player.playbackRate = FAST_PLAYBACK_RATE;
            isLongPressActiveRef.current = true;
        }, LONG_PRESS_DELAY_MS);
    }, [clearLongPressTimer, clearSingleTapTimer, player]);

    const handleTouchMove = useCallback((event: GestureResponderEvent) => {
        const deltaX = event.nativeEvent.pageX - touchStartPositionRef.current.x;
        const deltaY = event.nativeEvent.pageY - touchStartPositionRef.current.y;

        if (
            Math.abs(deltaX) > TOUCH_MOVE_TOLERANCE ||
            Math.abs(deltaY) > TOUCH_MOVE_TOLERANCE
        ) {
            clearLongPressTimer();
            touchStartedAtRef.current = 0;
        }
    }, [clearLongPressTimer]);

    const handleTouchEnd = useCallback(() => {
        clearLongPressTimer();

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
        player,
        restorePlaybackRate,
        toggleProgressControls,
    ]);

    const handleTouchCancel = useCallback(() => {
        touchStartedAtRef.current = 0;
        lastTapAtRef.current = 0;
        clearSingleTapTimer();
        restorePlaybackRate();
    }, [clearSingleTapTimer, restorePlaybackRate]);

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
        <View style={styles.playerSurface}>
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
                            <Text style={styles.fullscreenButtonText}>
                                {isFullscreen ? '退出全屏' : '全屏'}
                            </Text>
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
        backgroundColor: colors.mediaOverlayBackground,
    },
    fullscreenButtonPressed: {
        opacity: 0.72,
    },
    fullscreenButtonText: {
        color: colors.primaryText,
        fontSize: 13,
        fontWeight: '600',
    },
});
