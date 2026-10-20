import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
    TextLayoutEvent,
} from 'react-native';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
    type SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLoginCookie } from '@/auth/authCookie';
import type { VideoPartSummaryTarget } from '@/agent/domain/videoSummary';
import VideoSummaryPanel from '@/agent/ui/VideoSummaryPage';
import AppButton from '@/components/AppButton';
import UserAvatar from '@/components/UserAvatar';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import {
    fetchVideoDetail,
    fetchVideoPlayback,
    type VideoPart,
    type VideoPlayback,
    VideoPlaybackError,
} from '@/page/video/fetchVideoPlayback';
import VideoCommentsPanel from '@/page/video/VideoCommentsPanel';
import type { CollapsiblePageScrollHandle } from '@/page/video/collapsibleVideoScroll';
import VideoPlayer, {
    type FullscreenOrientation,
} from '@/page/video/VideoPlayer';
import type { VideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    target: VideoPlaybackTarget;
    deepSeekApiKey: string | null;
};

const COLLAPSED_TITLE_LINE_COUNT = 2;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const NEAR_SQUARE_ASPECT_RATIO_MIN = 0.8;
const NEAR_SQUARE_ASPECT_RATIO_MAX = 1.2;
const NEAR_SQUARE_PLAYER_HEIGHT_RATIO = 0.42;
const VERTICAL_PLAYER_HEIGHT_RATIO = 0.48;
const DETAIL_TAB_HEIGHT = 46;
const DETAIL_PAGE_COUNT = 3;

function useCollapsibleScrollHandler(
    pageIndex: number,
    pageOffset: SharedValue<number>,
    activePageIndex: SharedValue<number>,
    headerScrollOffset: SharedValue<number>,
    collapseDistance: SharedValue<number>,
    isPlayerFullscreen: SharedValue<boolean>,
) {
    return useAnimatedScrollHandler((event) => {
        const offset = Math.max(0, event.contentOffset.y);
        pageOffset.value = offset;

        if (
            activePageIndex.value === pageIndex
            && !isPlayerFullscreen.value
        ) {
            headerScrollOffset.value = Math.min(
                offset,
                collapseDistance.value,
            );
        }
    });
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

function formatCommentCount(count: number): string {
    if (count < 10000) {
        return String(count);
    }

    const value = count / 10000;
    return `${value >= 100 ? Math.floor(value) : value.toFixed(1).replace(/\.0$/, '')}万`;
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
): FullscreenOrientation {
    const width = part?.width;
    const height = part?.height;

    if (width === undefined || height === undefined || width <= 0 || height <= 0) {
        return 'default';
    }

    return width < height ? 'portrait' : 'landscape';
}

export default function VideoDetailPage({ target, deepSeekApiKey }: Props) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const safeAreaInsets = useSafeAreaInsets();
    const [videoAid, setVideoAid] = useState<string | null>(null);
    const [parts, setParts] = useState<VideoPart[]>([]);
    const [selectedCid, setSelectedCid] = useState<string | null>(null);
    const [playback, setPlayback] = useState<VideoPlayback | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [isTitleExpanded, setIsTitleExpanded] = useState(false);
    const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
    const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
    const [detailPageIndex, setDetailPageIndex] = useState(0);
    const [commentCount, setCommentCount] = useState<number | null>(null);
    const [settledPlayerHeight, setSettledPlayerHeight] = useState<number | null>(
        null,
    );
    const videoCommentSubject = useMemo(() => videoAid === null
        ? null
        : { oid: videoAid, type: 1 }, [videoAid]);
    const detailPagerRef = useRef<ScrollView>(null);
    const introScrollRef = useRef<ScrollView>(null);
    const commentsScrollRef = useRef<CollapsiblePageScrollHandle>(null);
    const summaryScrollRef = useRef<CollapsiblePageScrollHandle>(null);
    const headerScrollOffset = useSharedValue(0);
    const introPageOffset = useSharedValue(0);
    const commentsPageOffset = useSharedValue(0);
    const summaryPageOffset = useSharedValue(0);
    const activePageIndex = useSharedValue(detailPageIndex);
    const fullscreenValue = useSharedValue(isPlayerFullscreen);
    const collapseDistanceValue = useSharedValue(0);
    const introScrollHandler = useCollapsibleScrollHandler(
        0,
        introPageOffset,
        activePageIndex,
        headerScrollOffset,
        collapseDistanceValue,
        fullscreenValue,
    );
    const commentsScrollHandler = useCollapsibleScrollHandler(
        1,
        commentsPageOffset,
        activePageIndex,
        headerScrollOffset,
        collapseDistanceValue,
        fullscreenValue,
    );
    const summaryScrollHandler = useCollapsibleScrollHandler(
        2,
        summaryPageOffset,
        activePageIndex,
        headerScrollOffset,
        collapseDistanceValue,
        fullscreenValue,
    );

    useEffect(() => {
        setIsTitleExpanded(false);
        setIsTitleOverflowing(false);
    }, [target.title]);

    useEffect(() => {
        detailPagerRef.current?.scrollTo({
            x: windowWidth * detailPageIndex,
            animated: false,
        });
    }, [windowWidth]);

    useEffect(() => {
        const controller = new AbortController();

        const loadVideoDetail = async () => {
            setVideoAid(null);
            setParts([]);
            setSelectedCid(null);
            setPlayback(null);
            setErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new VideoPlaybackError('登录信息不存在,请重新登录');
                }

                const nextVideoDetail = await fetchVideoDetail(
                    target.bvid,
                    cookie,
                    controller.signal,
                );
                const nextParts = nextVideoDetail.parts;
                const initialPart = target.initialCid === undefined
                    ? undefined
                    : nextParts.find((part) => part.cid === target.initialCid);

                setVideoAid(nextVideoDetail.aid);
                setParts(nextParts);
                setSelectedCid(initialPart?.cid ?? nextParts[0].cid);
            } catch (error) {
                if (!isRequestCancelled(error, controller.signal)) {
                    setErrorMessage(getErrorMessage(error));
                }
            }
        };

        void loadVideoDetail();

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
                if (!isRequestCancelled(error, controller.signal)) {
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
    const summaryTarget: VideoPartSummaryTarget | null = selectedPart
        ? {
            identity: {
                bvid: target.bvid,
                cid: selectedPart.cid,
            },
            videoTitle: target.title,
            authorName: target.authorName,
            partTitle: selectedPart.title,
            partNumber: selectedPart.page,
            durationMs: selectedPart.durationSeconds * 1000,
        }
        : null;
    const collapsedPlayerHeight = windowWidth / DEFAULT_VIDEO_ASPECT_RATIO;
    const playerHeight = Math.max(
        getPlayerHeight(windowWidth, windowHeight, selectedPart),
        collapsedPlayerHeight,
    );
    const collapseDistance = playerHeight - collapsedPlayerHeight;
    const headerSpacerHeight = playerHeight + DETAIL_TAB_HEIGHT;
    const minimumContentHeight = windowHeight + collapseDistance;
    const fullscreenOrientation = getFullscreenOrientation(selectedPart);
    const detailTabs = [
        '简介',
        commentCount === null ? '评论' : `评论 ${formatCommentCount(commentCount)}`,
        'AI总结',
    ];

    useEffect(() => {
        activePageIndex.value = detailPageIndex;
    }, [activePageIndex, detailPageIndex]);

    useEffect(() => {
        fullscreenValue.value = isPlayerFullscreen;
    }, [fullscreenValue, isPlayerFullscreen]);

    useEffect(() => {
        collapseDistanceValue.value = collapseDistance;
        headerScrollOffset.value = Math.min(
            headerScrollOffset.value,
            collapseDistance,
        );
    }, [collapseDistance, collapseDistanceValue, headerScrollOffset]);

    useEffect(() => {
        if (!isPlayerFullscreen) {
            setSettledPlayerHeight(
                playerHeight - Math.min(
                    headerScrollOffset.value,
                    collapseDistance,
                ),
            );
        }
    }, [
        collapseDistance,
        headerScrollOffset,
        isPlayerFullscreen,
        playerHeight,
    ]);

    const playerAnimatedStyle = useAnimatedStyle(() => ({
        height: playerHeight - Math.min(
            headerScrollOffset.value,
            collapseDistance,
        ),
    }), [collapseDistance, playerHeight]);

    const detailTabsAnimatedStyle = useAnimatedStyle(() => ({
        top: playerHeight - Math.min(
            headerScrollOffset.value,
            collapseDistance,
        ),
    }), [collapseDistance, playerHeight]);

    const pageOffsets = [
        introPageOffset,
        commentsPageOffset,
        summaryPageOffset,
    ];

    const scrollPageToOffset = useCallback((
        pageIndex: number,
        offset: number,
        animated = false,
    ) => {
        const pageOffset = pageIndex === 0
            ? introPageOffset
            : pageIndex === 1
                ? commentsPageOffset
                : summaryPageOffset;

        pageOffset.value = offset;

        if (pageIndex === 0) {
            introScrollRef.current?.scrollTo({ y: offset, animated });
        } else if (pageIndex === 1) {
            commentsScrollRef.current?.scrollToOffset(offset, animated);
        } else {
            summaryScrollRef.current?.scrollToOffset(offset, animated);
        }
    }, [commentsPageOffset, introPageOffset, summaryPageOffset]);

    useEffect(() => {
        introPageOffset.value = 0;
        commentsPageOffset.value = 0;
        summaryPageOffset.value = 0;
        headerScrollOffset.value = 0;
        setSettledPlayerHeight(playerHeight);

        for (let pageIndex = 0; pageIndex < DETAIL_PAGE_COUNT; pageIndex += 1) {
            scrollPageToOffset(pageIndex, 0);
        }
    }, [
        commentsPageOffset,
        headerScrollOffset,
        introPageOffset,
        scrollPageToOffset,
        selectedCid,
        summaryPageOffset,
        target.bvid,
    ]);

    const handlePageScrollEnd = useCallback((
        pageIndex: number,
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        if (detailPageIndex !== pageIndex || isPlayerFullscreen) {
            return;
        }

        const offset = Math.max(0, event.nativeEvent.contentOffset.y);
        setSettledPlayerHeight(
            playerHeight - Math.min(offset, collapseDistance),
        );
    }, [collapseDistance, detailPageIndex, isPlayerFullscreen, playerHeight]);

    const handleIntroScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        handlePageScrollEnd(0, event);
    }, [handlePageScrollEnd]);

    const handleCommentsScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        handlePageScrollEnd(1, event);
    }, [handlePageScrollEnd]);

    const handleSummaryScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        handlePageScrollEnd(2, event);
    }, [handlePageScrollEnd]);

    const handleTitleTextLayout = (event: TextLayoutEvent) => {
        const nextIsOverflowing =
            event.nativeEvent.lines.length > COLLAPSED_TITLE_LINE_COUNT;

        setIsTitleOverflowing((currentIsOverflowing) =>
            currentIsOverflowing === nextIsOverflowing
                ? currentIsOverflowing
                : nextIsOverflowing,
        );
    };

    const scrollToDetailPage = (pageIndex: number) => {
        const currentOffset = pageOffsets[detailPageIndex]?.value ?? 0;
        const currentCollapseOffset = Math.min(currentOffset, collapseDistance);
        const targetOffset = currentCollapseOffset < collapseDistance
            ? currentCollapseOffset
            : Math.max(
                pageOffsets[pageIndex]?.value ?? 0,
                collapseDistance,
            );

        activePageIndex.value = pageIndex;
        scrollPageToOffset(pageIndex, targetOffset);
        headerScrollOffset.value = Math.min(targetOffset, collapseDistance);
        setSettledPlayerHeight(
            playerHeight - Math.min(targetOffset, collapseDistance),
        );
        detailPagerRef.current?.scrollTo({
            x: windowWidth * pageIndex,
            animated: true,
        });
        setDetailPageIndex(pageIndex);
    };

    return (
        <View style={styles.page}>
            <Animated.View
                style={[
                    styles.playerContainer,
                    !isPlayerFullscreen && playerAnimatedStyle,
                    isPlayerFullscreen && styles.playerContainerFullscreen,
                ]}
            >
                {playback ? (
                    <VideoPlayer
                        embeddedHeight={settledPlayerHeight ?? playerHeight}
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
                        <AppButton
                            onPress={() => setReloadKey((value) => value + 1)}
                            style={styles.actionButton}
                            title='重新加载'
                        />
                    </View>
                ) : (
                    <View style={styles.playerStatus}>
                        <ActivityIndicator color={colors.accentForeground} size='large' />
                        <Text style={styles.loadingText}>正在获取播放地址...</Text>
                    </View>
                )}
            </Animated.View>

            <Animated.View
                style={[
                    styles.detailTabs,
                    detailTabsAnimatedStyle,
                ]}
            >
                {detailTabs.map((label, pageIndex) => {
                    const isSelected = detailPageIndex === pageIndex;

                    return (
                        <Pressable
                            key={pageIndex}
                            accessibilityRole='tab'
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => scrollToDetailPage(pageIndex)}
                            style={styles.detailTab}
                        >
                            <Text
                                style={[
                                    styles.detailTabText,
                                    isSelected && styles.detailTabTextSelected,
                                ]}
                            >
                                {label}
                            </Text>
                            {isSelected ? <View style={styles.detailTabIndicator} /> : null}
                        </Pressable>
                    );
                })}
            </Animated.View>

            <ScrollView
                ref={detailPagerRef}
                horizontal
                pagingEnabled
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.detailPagerContent}
                style={styles.detailPager}
            >
                <View style={[styles.detailPage, { width: windowWidth }]}>
                    <Animated.ScrollView
                        ref={introScrollRef}
                        contentContainerStyle={[
                            styles.detailsContent,
                            {
                                minHeight: minimumContentHeight,
                                paddingTop: headerSpacerHeight,
                                paddingBottom: safeAreaInsets.bottom + spacing.xl,
                            },
                        ]}
                        onMomentumScrollEnd={handleIntroScrollEnd}
                        onScroll={introScrollHandler}
                        onScrollEndDrag={handleIntroScrollEnd}
                        scrollEventThrottle={16}
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
                            <UserAvatar
                                name={target.authorName}
                                size={38}
                                style={styles.authorAvatar}
                                uri={target.authorAvatarUrl}
                            />
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
                    </Animated.ScrollView>
                </View>

                <View style={[styles.detailPage, { width: windowWidth }]}>
                    <VideoCommentsPanel
                        ref={commentsScrollRef}
                        active={detailPageIndex === 1}
                        headerSpacerHeight={headerSpacerHeight}
                        minimumContentHeight={minimumContentHeight}
                        onScroll={commentsScrollHandler}
                        onScrollEnd={handleCommentsScrollEnd}
                        onTotalCountChange={setCommentCount}
                        subject={videoCommentSubject}
                    />
                </View>

                <View style={[styles.detailPage, { width: windowWidth }]}>
                    <VideoSummaryPanel
                        ref={summaryScrollRef}
                        apiKey={deepSeekApiKey}
                        headerSpacerHeight={headerSpacerHeight}
                        minimumContentHeight={minimumContentHeight}
                        onScroll={summaryScrollHandler}
                        onScrollEnd={handleSummaryScrollEnd}
                        target={summaryTarget}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    detailTabs: {
        position: 'absolute',
        right: 0,
        left: 0,
        zIndex: 3,
        elevation: 3,
        height: DETAIL_TAB_HEIGHT,
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.surfaceBorder,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
        backgroundColor: colors.pageBackground,
    },
    detailTab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailTabText: {
        color: colors.mutedText,
        fontSize: 15,
        fontWeight: '600',
    },
    detailTabTextSelected: {
        color: colors.accentForeground,
        fontWeight: '700',
    },
    detailTabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 28,
        height: 3,
        borderRadius: radius.full,
        backgroundColor: colors.accentForeground,
    },
    detailPager: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    detailPagerContent: {
        alignItems: 'stretch',
    },
    detailPage: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    detailsScroll: {
        flex: 1,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.surfaceBorder,
        backgroundColor: colors.pageBackground,
    },
    detailsContent: {
        paddingBottom: spacing.xl,
    },
    playerContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 2,
        elevation: 2,
        width: '100%',
        overflow: 'hidden',
        backgroundColor: colors.pageBackground,
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
    playerStatus: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    loadingText: {
        marginTop: spacing.sm,
        color: colors.primaryText,
        fontSize: 14,
    },
    errorText: {
        color: colors.primaryText,
        fontSize: 14,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.md,
    },
    infoSection: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    titleContainer: {
        position: 'relative',
    },
    title: {
        color: colors.primaryText,
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
        color: colors.accentForeground,
        fontSize: 14,
        fontWeight: '600',
    },
    authorRow: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorAvatar: {
        marginRight: spacing.sm,
    },
    authorName: {
        flex: 1,
        color: colors.secondaryText,
        fontSize: 15,
        fontWeight: '600',
    },
    partsSection: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    partsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    partsHeading: {
        color: colors.primaryText,
        fontSize: 17,
        fontWeight: '700',
    },
    partsSummary: {
        flex: 1,
        marginLeft: spacing.md,
        color: colors.mutedText,
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
        borderColor: colors.surfaceBorder,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    partButtonSelected: {
        borderColor: colors.accentForeground,
        backgroundColor: colors.accentBackground,
    },
    partButtonPressed: {
        opacity: 0.76,
    },
    partTitle: {
        color: colors.primaryText,
        fontSize: 14,
        fontWeight: '600',
    },
    partTitleSelected: {
        color: colors.accentForeground,
    },
    partDuration: {
        marginTop: spacing.xs,
        color: colors.mutedText,
        fontSize: 12,
    },
    partDurationSelected: {
        color: colors.accentForeground,
    },
});
