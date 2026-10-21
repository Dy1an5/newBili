import { useCallback, useEffect, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    View,
    type ListRenderItemInfo,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppLoadingIndicator from '@/components/AppLoadingIndicator';
import AppRefreshControl from '@/components/AppRefreshControl';
import SelectionHeader from '@/components/SelectionHeader';
import SelectionSheet, {
    type SelectorAnchor,
} from '@/components/SelectionSheet';
import VideoListCard from '@/components/VideoListCard';
import {
    fetchWatchLaterVideoPage,
    WatchLaterRequestError,
    type WatchLaterVideo,
} from '@/page/watchLater/fetchWatchLater';
import {
    createVideoPlaybackTarget,
    type VideoPlaybackTarget,
} from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { createGetErrorMessage } from '@/tool/errorMessage';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    onVideoPress: (target: VideoPlaybackTarget) => void;
    refreshRequestId: number;
    selectorRequestId: number;
    selectorAnchor: SelectorAnchor | null;
};

const getErrorMessage = createGetErrorMessage(
    [WatchLaterRequestError],
    '加载稍后再看失败,请稍后重试',
);

function formatPublishedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `发布于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWatchLaterVideoKey(video: WatchLaterVideo): string {
    return video.bvid;
}

export default function WatchLaterPage({
    onVideoPress,
    refreshRequestId,
    selectorRequestId,
    selectorAnchor,
}: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [videos, setVideos] = useState<WatchLaterVideo[]>([]);
    const [isSelectorVisible, setIsSelectorVisible] = useState(false);
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
    const isRefreshingRef = useRef(false);
    const handledRefreshRequestIdRef = useRef(refreshRequestId);
    const handledSelectorRequestIdRef = useRef(selectorRequestId);
    const listRef = useRef<FlatList<WatchLaterVideo> | null>(null);

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
            if (!isRequestCancelled(error, controller.signal)) {
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

    const refreshWatchLater = useCallback(async () => {
        if (isRefreshingRef.current) {
            return;
        }

        isRefreshingRef.current = true;

        try {
            await loadVideoPage(1, true);
        } finally {
            isRefreshingRef.current = false;
        }
    }, [loadVideoPage]);

    useEffect(() => {
        if (handledRefreshRequestIdRef.current === refreshRequestId) {
            return;
        }

        handledRefreshRequestIdRef.current = refreshRequestId;
        listRef.current?.scrollToOffset({
            animated: false,
            offset: 0,
        });
        void refreshWatchLater();
    }, [refreshRequestId, refreshWatchLater]);

    useEffect(() => {
        if (
            selectorRequestId === 0 ||
            handledSelectorRequestIdRef.current === selectorRequestId
        ) {
            return;
        }

        handledSelectorRequestIdRef.current = selectorRequestId;
        setIsSelectorVisible(true);
    }, [selectorRequestId]);

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
        setTotalCount(0);
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

    const renderWatchLaterVideo = useCallback(({
        item,
    }: ListRenderItemInfo<WatchLaterVideo>) => (
        <VideoListCard
            video={item}
            metaText={formatPublishedTime(item.publishedAt)}
            onPress={() => onVideoPress(
                createVideoPlaybackTarget(item, item.cid),
            )}
        />
    ), [onVideoPress]);

    const sortLabel = ascending ? '最早添加' : '最近添加';
    const header = (
        <>
            <SelectionHeader
                accessibilityLabel='选择稍后再看排序'
                label={`稍后再看 · ${sortLabel}`}
                onPress={() => setIsSelectorVisible(true)}
            />

            <SelectionSheet
                anchor={selectorAnchor}
                onClose={() => setIsSelectorVisible(false)}
                onSelect={selectSort}
                options={[
                    {
                        value: false,
                        label: '最近添加',
                        accessibilityLabel: '最近添加优先',
                    },
                    {
                        value: true,
                        label: '最早添加',
                        accessibilityLabel: '最早添加优先',
                    },
                ]}
                selectedValue={ascending}
                title={totalCount > 0 ? `稍后再看(共${totalCount}个)` : '稍后再看'}
                visible={isSelectorVisible}
            />
        </>
    );

    if (isLoading && videos.length === 0) {
        return (
            <View style={styles.page}>
                {header}
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.accentForeground} size='large' />
                    <Text style={styles.statusText}>正在加载稍后再看...</Text>
                </View>
            </View>
        );
    }

    if (errorMessage && videos.length === 0) {
        return (
            <View style={styles.page}>
                {header}
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <AppButton
                        onPress={() => void loadVideoPage(1, false)}
                        style={styles.actionButton}
                        title='重新加载'
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            {header}
            <FlatList
                ref={listRef}
                data={videos}
                initialNumToRender={8}
                keyExtractor={getWatchLaterVideoKey}
                contentContainerStyle={[
                    videos.length === 0
                        ? styles.emptyList
                        : styles.videoList,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                refreshControl={(
                    <AppRefreshControl
                        onRefresh={() => void refreshWatchLater()}
                        refreshing={isRefreshing}
                    />
                )}
                onEndReachedThreshold={0.4}
                maxToRenderPerBatch={8}
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
                        <AppLoadingIndicator
                            style={styles.footerLoading}
                        />
                    ) : null
                }
                removeClippedSubviews
                renderItem={renderWatchLaterVideo}
                updateCellsBatchingPeriod={50}
                windowSize={9}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
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
        color: colors.secondaryText,
        fontSize: 14,
        textAlign: 'center',
    },
    errorText: {
        color: colors.primaryText,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        color: colors.secondaryText,
        fontSize: 13,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.md,
    },
    footerLoading: {
        alignSelf: 'center',
        marginVertical: spacing.md,
    },
});
