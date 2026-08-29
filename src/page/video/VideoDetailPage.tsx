import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, TextLayoutEvent } from 'react-native';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLoginCookie } from '@/auth/authCookie';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { VideoPlaybackTarget } from '@/types/video';
import {
    fetchVideoParts,
    fetchVideoPlayback,
    type VideoPart,
    type VideoPlayback,
    VideoPlaybackError,
} from '@/page/video/fetchVideoPlayback';

type Props = {
    target: VideoPlaybackTarget;
};

type PlayerProps = {
    playback: VideoPlayback;
    title: string;
    fullscreenOrientation: 'portrait' | 'landscape' | 'default';
    isFullscreen: boolean;
    onFullscreenChange: (isFullscreen: boolean) => void;
    onPlaybackError: () => void;
};

const COLLAPSED_TITLE_LINE_COUNT = 2;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const NEAR_SQUARE_ASPECT_RATIO_MIN = 0.8;
const NEAR_SQUARE_ASPECT_RATIO_MAX = 1.2;
const NEAR_SQUARE_PLAYER_HEIGHT_RATIO = 0.42;
const VERTICAL_PLAYER_HEIGHT_RATIO = 0.48;
const DOUBLE_TAP_INTERVAL_MS = 300;
const LONG_PRESS_DELAY_MS = 450;
const TAP_MAX_DURATION_MS = 250;
const TOUCH_MOVE_TOLERANCE = 12;
const FAST_PLAYBACK_RATE = 2;
const PROGRESS_CONTROLS_HIDE_DELAY_MS = 2500;

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof VideoPlaybackError) {
        return error.message;
    }

    return '获取播放地址失败,请稍后重试';
}

function formatDuration(durationSeconds: number): string {
    if (durationSeconds <= 0) {
        return '';
    }

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds]
            .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
            .join(':');
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
            .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
            .join(':');
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getPlayerHeight(
    windowWidth: number,
    windowHeight: number,
    part: VideoPart | null,
): number {
    const width = part?.width;
    const height = part?.height;
    const nearSquareMaximumHeight =
        windowHeight * NEAR_SQUARE_PLAYER_HEIGHT_RATIO;

    if (width === undefined || height === undefined || width <= 0 || height <= 0) {
        return windowWidth / DEFAULT_VIDEO_ASPECT_RATIO;
    }

    const aspectRatio = width / height;

    if (aspectRatio < NEAR_SQUARE_ASPECT_RATIO_MIN) {
        return windowHeight * VERTICAL_PLAYER_HEIGHT_RATIO;
    }

    const naturalHeight = windowWidth / aspectRatio;

    if (aspectRatio <= NEAR_SQUARE_ASPECT_RATIO_MAX) {
        return Math.min(naturalHeight, nearSquareMaximumHeight);
    }

    return naturalHeight;
}

function getFullscreenOrientation(
    part: VideoPart | null,
): PlayerProps['fullscreenOrientation'] {
    const width = part?.width;
    const height = part?.height;

    if (width === undefined || height === undefined || width <= 0 || height <= 0) {
        return 'default';
    }

    return width < height ? 'portrait' : 'landscape';
}

function VideoPlayer({
    playback,
    title,
    fullscreenOrientation,
    isFullscreen,
    onFullscreenChange,
    onPlaybackError,
}: PlayerProps) {
    const [areProgressControlsVisible, setAreProgressControlsVisible] = useState(false);
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
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const player = useVideoPlayer(
        {
            uri: playback.url,
            headers: playback.headers,
            contentType: 'progressive',
            metadata: {
                title,
            },
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
    }, [
        clearProgressControlsHideTimer,
        showProgressControls,
    ]);

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

        if (touchStartedAt === 0) {
            return;
        }

        const now = Date.now();

        if (now - touchStartedAt > TAP_MAX_DURATION_MS) {
            return;
        }

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

        if (player.playing) {
            player.pause();
        } else {
            player.play();
        }
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

        return () => {
            subscription.remove();
        };
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
    }, [
        clearLongPressTimer,
        clearProgressControlsHideTimer,
        clearSingleTapTimer,
        player,
    ]);

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

export default function VideoDetailPage({ target }: Props) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const safeAreaInsets = useSafeAreaInsets();
    const [parts, setParts] = useState<VideoPart[]>([]);
    const [selectedCid, setSelectedCid] = useState<number | null>(null);
    const [playback, setPlayback] = useState<VideoPlayback | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [isTitleExpanded, setIsTitleExpanded] = useState(false);
    const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
    const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

    useEffect(() => {
        setIsTitleExpanded(false);
        setIsTitleOverflowing(false);
    }, [target.title]);

    useEffect(() => {
        const controller = new AbortController();

        const loadParts = async () => {
            setParts([]);
            setSelectedCid(null);
            setPlayback(null);
            setErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new VideoPlaybackError('登录信息不存在,请重新登录');
                }

                const nextParts = await fetchVideoParts(
                    target.bvid,
                    cookie,
                    controller.signal,
                );
                const initialPart = target.initialCid === undefined
                    ? undefined
                    : nextParts.find((part) => part.cid === target.initialCid);

                setParts(nextParts);
                setSelectedCid(initialPart?.cid ?? nextParts[0].cid);
            } catch (error) {
                if (!isAbortError(error)) {
                    setErrorMessage(getErrorMessage(error));
                }
            }
        };

        void loadParts();

        return () => {
            controller.abort();
        };
    }, [reloadKey, target.bvid, target.initialCid]);

    useEffect(() => {
        if (selectedCid === null) {
            return;
        }

        const controller = new AbortController();

        const loadPlayback = async () => {
            setPlayback(null);
            setErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new VideoPlaybackError('登录信息不存在,请重新登录');
                }

                const nextPlayback = await fetchVideoPlayback(
                    target.bvid,
                    selectedCid,
                    cookie,
                    controller.signal,
                );
                setPlayback(nextPlayback);
            } catch (error) {
                if (!isAbortError(error)) {
                    setErrorMessage(getErrorMessage(error));
                }
            }
        };

        void loadPlayback();

        return () => {
            controller.abort();
        };
    }, [selectedCid, target.bvid]);

    const selectedPartIndex = parts.findIndex((part) => part.cid === selectedCid);
    const selectedPart = selectedPartIndex >= 0 ? parts[selectedPartIndex] : null;
    const playerHeight = getPlayerHeight(windowWidth, windowHeight, selectedPart);
    const fullscreenOrientation = getFullscreenOrientation(selectedPart);

    const handleTitleTextLayout = (event: TextLayoutEvent) => {
        const nextIsOverflowing =
            event.nativeEvent.lines.length > COLLAPSED_TITLE_LINE_COUNT;

        setIsTitleOverflowing((currentIsOverflowing) =>
            currentIsOverflowing === nextIsOverflowing
                ? currentIsOverflowing
                : nextIsOverflowing,
        );
    };

    return (
        <View style={styles.page}>
            <View
                style={[
                    styles.playerContainer,
                    isPlayerFullscreen
                        ? styles.playerContainerFullscreen
                        : { height: playerHeight },
                ]}
            >
                {playback ? (
                    <VideoPlayer
                        playback={playback}
                        title={target.title}
                        fullscreenOrientation={fullscreenOrientation}
                        isFullscreen={isPlayerFullscreen}
                        onFullscreenChange={setIsPlayerFullscreen}
                        onPlaybackError={() => {
                            setIsPlayerFullscreen(false);
                            setPlayback(null);
                            setErrorMessage('视频流播放失败,请重新加载');
                        }}
                    />
                ) : errorMessage ? (
                    <View style={styles.playerStatus}>
                        <Text style={styles.errorText}>{errorMessage}</Text>
                        <Pressable
                            accessibilityRole='button'
                            onPress={() => setReloadKey((value) => value + 1)}
                            style={styles.retryButton}
                        >
                            <Text style={styles.retryButtonText}>重新加载</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.playerStatus}>
                        <ActivityIndicator color={colors.primary} size='large' />
                        <Text style={styles.loadingText}>正在获取播放地址...</Text>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.detailsContent,
                    { paddingBottom: safeAreaInsets.bottom + spacing.xl },
                ]}
                style={styles.detailsScroll}
            >
                <View style={styles.infoSection}>
                    <View style={styles.titleContainer}>
                        <Text
                            ellipsizeMode='tail'
                            numberOfLines={
                                isTitleExpanded
                                    ? undefined
                                    : COLLAPSED_TITLE_LINE_COUNT
                            }
                            style={styles.title}
                        >
                            {target.title}
                        </Text>

                        <Text
                            accessibilityElementsHidden
                            importantForAccessibility='no-hide-descendants'
                            onTextLayout={handleTitleTextLayout}
                            pointerEvents='none'
                            style={[styles.title, styles.titleMeasurement]}
                        >
                            {target.title}
                        </Text>

                        {isTitleOverflowing ? (
                            <Pressable
                                accessibilityLabel={isTitleExpanded ? '收起视频标题' : '展开视频标题'}
                                accessibilityRole='button'
                                onPress={() => {
                                    setIsTitleExpanded((value) => !value);
                                }}
                                style={({ pressed }) => [
                                    styles.titleToggle,
                                    pressed && styles.titleTogglePressed,
                                ]}
                            >
                                <Text style={styles.titleToggleText}>
                                    {isTitleExpanded ? '收起' : '展开'}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>

                    {target.authorName ? (
                        <View style={styles.authorRow}>
                            {target.authorAvatarUrl ? (
                                <Image
                                    source={{ uri: target.authorAvatarUrl }}
                                    style={styles.authorAvatar}
                                />
                            ) : (
                                <View style={styles.authorAvatarPlaceholder}>
                                    <Text style={styles.authorAvatarPlaceholderText}>
                                        {target.authorName.slice(0, 1)}
                                    </Text>
                                </View>
                            )}
                            <Text numberOfLines={1} style={styles.authorName}>
                                {target.authorName}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {parts.length > 1 ? (
                    <View style={styles.partsSection}>
                        <View style={styles.partsHeader}>
                            <Text style={styles.partsHeading}>视频选集</Text>
                            <Text numberOfLines={1} style={styles.partsSummary}>
                                {selectedPart
                                    ? `正在播放:P${selectedPart.page} ${selectedPart.title}`
                                    : `共${parts.length}P`}
                            </Text>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.partsList}
                        >
                            {parts.map((part) => {
                                const isSelected = part.cid === selectedCid;
                                const duration = formatDuration(part.durationSeconds);

                                return (
                                    <Pressable
                                        key={part.cid}
                                        accessibilityRole='button'
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={`P${part.page} ${part.title}`}
                                        onPress={() => {
                                            if (!isSelected) {
                                                setSelectedCid(part.cid);
                                            }
                                        }}
                                        style={({ pressed }) => [
                                            styles.partButton,
                                            isSelected && styles.partButtonSelected,
                                            pressed && styles.partButtonPressed,
                                        ]}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.partTitle,
                                                isSelected && styles.partTitleSelected,
                                            ]}
                                        >
                                            P{part.page} {part.title}
                                        </Text>
                                        {duration ? (
                                            <Text
                                                style={[
                                                    styles.partDuration,
                                                    isSelected && styles.partDurationSelected,
                                                ]}
                                            >
                                                {duration}
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    detailsScroll: {
        flex: 1,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.divider,
        backgroundColor: colors.surface,
    },
    detailsContent: {
        paddingBottom: spacing.xl,
    },
    playerContainer: {
        width: '100%',
        backgroundColor: colors.background,
    },
    playerContainerFullscreen: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 10,
        elevation: 10,
    },
    player: {
        width: '100%',
        height: '100%',
    },
    playerSurface: {
        flex: 1,
        backgroundColor: colors.background,
    },
    progressControls: {
        position: 'absolute',
        right: spacing.md,
        bottom: spacing.sm,
        left: spacing.md,
    },
    progressTimeText: {
        alignSelf: 'flex-end',
        color: colors.textOnMedia,
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
        backgroundColor: 'rgba(255, 255, 255, 0.38)',
    },
    progressPlayed: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    fullscreenButton: {
        marginLeft: spacing.sm,
        minWidth: 52,
        minHeight: 28,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: 'rgba(0, 0, 0, 0.62)',
    },
    fullscreenButtonPressed: {
        opacity: 0.72,
    },
    fullscreenButtonText: {
        color: colors.textOnMedia,
        fontSize: 13,
        fontWeight: '600',
    },
    playerStatus: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    loadingText: {
        marginTop: spacing.sm,
        color: colors.textOnMedia,
        fontSize: 14,
    },
    errorText: {
        color: colors.textOnMedia,
        fontSize: 14,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    retryButtonText: {
        color: colors.textOnPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    infoSection: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    titleContainer: {
        position: 'relative',
    },
    title: {
        color: colors.textPrimary,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
    },
    titleMeasurement: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        opacity: 0,
    },
    titleToggle: {
        alignSelf: 'flex-end',
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
    },
    titleTogglePressed: {
        opacity: 0.68,
    },
    titleToggleText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    authorRow: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorAvatar: {
        width: 38,
        height: 38,
        marginRight: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceRaised,
    },
    authorAvatarPlaceholder: {
        width: 38,
        height: 38,
        marginRight: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: colors.surfaceRaised,
    },
    authorAvatarPlaceholderText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    authorName: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    partsSection: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    partsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    partsHeading: {
        color: colors.textPrimary,
        fontSize: 17,
        fontWeight: '700',
    },
    partsSummary: {
        flex: 1,
        marginLeft: spacing.md,
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'right',
    },
    partsList: {
        paddingHorizontal: spacing.lg,
    },
    partButton: {
        width: 156,
        minHeight: 64,
        justifyContent: 'center',
        marginRight: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.outline,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    partButtonSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    partButtonPressed: {
        opacity: 0.76,
    },
    partTitle: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    partTitleSelected: {
        color: colors.primary,
    },
    partDuration: {
        marginTop: spacing.xs,
        color: colors.textMuted,
        fontSize: 12,
    },
    partDurationSelected: {
        color: colors.primary,
    },
});
