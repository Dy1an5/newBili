import { useCallback, useEffect, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import VideoListCard from '@/components/video/VideoListCard';
import WatchLaterToolbar from '@/components/watchLater/WatchLaterToolbar';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { VideoPlaybackTarget } from '@/types/video';
import type { WatchLaterVideo } from '@/types/watchLater';
import { createVideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';
import {
    fetchWatchLaterVideoPage,
    WatchLaterRequestError,
} from '@/page/watchLater/fetchWatchLater';

type Props = {
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof WatchLaterRequestError) {
        return error.message;
    }

    return '加载稍后再看失败,请稍后重试';
}

function formatPublishedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `发布于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function WatchLaterPage({
    onVideoPress,
}: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [videos, setVideos] = useState<WatchLaterVideo[]>([]);
    const [ascending, setAscending] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const requestControllerRef =
        useRef<AbortController | null>(null);

    const loadVideoPage = useCallback(async (
        targetPage: number,
        refreshing: boolean,
    ) => {
        if (requestControllerRef.current) {
            if (!refreshing) {
                return;
            }

            requestControllerRef.current.abort();
        }

        const controller = new AbortController();
        requestControllerRef.current = controller;

        if (refreshing) {
            setIsRefreshing(true);
        } else if (targetPage === 1) {
            setIsLoading(true);
        } else if (targetPage > 1) {
            setIsLoadingMore(true);
        }

        setErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new WatchLaterRequestError(
                    '登录信息不存在,请重新登录',
                );
            }

            const nextPage = await fetchWatchLaterVideoPage(
                targetPage,
                cookie,
                {
                    ascending,
                },
                controller.signal,
            );

            setVideos((currentVideos) => {
                if (targetPage === 1) {
                    return nextPage.videos;
                }

                const existingBvids = new Set(
                    currentVideos.map((video) => video.bvid),
                );
                const newVideos = nextPage.videos.filter(
                    (video) => !existingBvids.has(video.bvid),
                );

                return [...currentVideos, ...newVideos];
            });

            setCurrentPage(targetPage);
            setTotalCount(nextPage.totalCount);
            setHasMore(nextPage.hasMore);
        } catch (error) {
            if (!isAbortError(error)) {
                setErrorMessage(getErrorMessage(error));
                setHasMore(false);
            }
        } finally {
            if (requestControllerRef.current === controller) {
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
                requestControllerRef.current = null;
            }
        }
    }, [ascending]);

    useEffect(() => {
        void loadVideoPage(1, false);

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadVideoPage]);

    const resetQuery = useCallback(() => {
        requestControllerRef.current?.abort();
        setVideos([]);
        setCurrentPage(0);
        setHasMore(true);
        setIsLoading(true);
        setIsLoadingMore(false);
        setErrorMessage(null);
    }, []);

    const selectSort = useCallback((nextAscending: boolean) => {
        if (nextAscending === ascending) {
            return;
        }

        resetQuery();
        setAscending(nextAscending);
    }, [ascending, resetQuery]);

    const toolbar = (
        <WatchLaterToolbar
            ascending={ascending}
            onSortChange={selectSort}
            totalCount={totalCount}
        />
    );

    if (isLoading && videos.length === 0) {
        return (
            <View style={styles.page}>
                {toolbar}
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.primary} size='large' />
                    <Text style={styles.statusText}>正在加载稍后再看...</Text>
                </View>
            </View>
        );
    }

    if (errorMessage && videos.length === 0) {
        return (
            <View style={styles.page}>
                {toolbar}
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <Pressable
                        accessibilityRole='button'
                        onPress={() => void loadVideoPage(1, false)}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>重新加载</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            {toolbar}
            <FlatList
                data={videos}
                keyExtractor={(video) => video.bvid}
                contentContainerStyle={[
                    videos.length === 0
                        ? styles.emptyList
                        : styles.videoList,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                refreshing={isRefreshing}
                onRefresh={() => void loadVideoPage(1, true)}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (
                        hasMore &&
                        !isLoadingMore &&
                        !requestControllerRef.current
                    ) {
                        void loadVideoPage(currentPage + 1, false);
                    }
                }}
                ListHeaderComponent={
                    errorMessage ? (
                        <Text style={styles.inlineError}>{errorMessage}</Text>
                    ) : null
                }
                ListEmptyComponent={
                    <Text style={styles.statusText}>
                        暂时没有可显示的稍后再看视频
                    </Text>
                }
                ListFooterComponent={
                    isLoadingMore ? (
                        <ActivityIndicator
                            color={colors.primary}
                            size='small'
                            style={styles.footerLoading}
                        />
                    ) : null
                }
                renderItem={({ item }) => (
                    <VideoListCard
                        video={item}
                        metaText={formatPublishedTime(item.publishedAt)}
                        onPress={() => onVideoPress(
                            createVideoPlaybackTarget(item, item.cid),
                        )}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    videoList: {
        paddingVertical: spacing.md,
    },
    emptyList: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    statusText: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    errorText: {
        color: colors.textPrimary,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        color: colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: colors.primary,
    },
    retryButtonText: {
        color: colors.textOnPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    footerLoading: {
        paddingVertical: spacing.md,
    },
});
