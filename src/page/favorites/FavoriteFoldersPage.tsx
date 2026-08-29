import { useCallback, useEffect, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
    type ListRenderItemInfo,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import AppLoadingIndicator from '@/components/common/AppLoadingIndicator';
import AppRefreshControl from '@/components/common/AppRefreshControl';
import FavoriteFolderSelector from '@/components/favorites/FavoriteFolderSelector';
import VideoListCard from '@/components/video/VideoListCard';
import {
    fetchFavoriteFolders,
    fetchFavoriteVideoPage,
    FavoritesRequestError,
} from '@/page/favorites/fetchFavorites';
import { createVideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { FavoriteFolder, FavoriteVideo } from '@/types/favorites';
import type { VideoPlaybackTarget } from '@/types/video';

type Props = {
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

type VideoRequestMode = 'initial' | 'refresh' | 'more';

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown, resourceName: string): string {
    if (error instanceof FavoritesRequestError) {
        return error.message;
    }

    return `加载${resourceName}失败,请稍后重试`;
}

function formatFavoritedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `收藏于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getFavoriteVideoKey(video: FavoriteVideo): string {
    return video.bvid;
}

export default function FavoriteFoldersPage({ onVideoPress }: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const [videos, setVideos] = useState<FavoriteVideo[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isFoldersLoading, setIsFoldersLoading] = useState(true);
    const [isVideosLoading, setIsVideosLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [foldersErrorMessage, setFoldersErrorMessage] =
        useState<string | null>(null);
    const [videosErrorMessage, setVideosErrorMessage] =
        useState<string | null>(null);
    const foldersRef = useRef<FavoriteFolder[]>([]);
    const selectedFolderIdRef = useRef<number | null>(null);
    const foldersControllerRef = useRef<AbortController | null>(null);
    const videosControllerRef = useRef<AbortController | null>(null);

    const loadFolders = useCallback(async (
        showLoading: boolean,
    ): Promise<FavoriteFolder[] | null> => {
        foldersControllerRef.current?.abort();

        const controller = new AbortController();
        foldersControllerRef.current = controller;

        if (showLoading) {
            setIsFoldersLoading(true);
        }

        setFoldersErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FavoritesRequestError('登录信息不存在,请重新登录');
            }

            const nextFolders = await fetchFavoriteFolders(cookie, controller.signal);
            foldersRef.current = nextFolders;
            setFolders(nextFolders);

            return nextFolders;
        } catch (error) {
            if (!isAbortError(error)) {
                setFoldersErrorMessage(getErrorMessage(error, '收藏夹'));
            }

            return null;
        } finally {
            if (foldersControllerRef.current === controller) {
                foldersControllerRef.current = null;
                setIsFoldersLoading(false);
            }
        }
    }, []);

    const loadVideoPage = useCallback(async (
        folder: FavoriteFolder,
        targetPage: number,
        mode: VideoRequestMode,
    ) => {
        if (videosControllerRef.current) {
            if (mode === 'more') {
                return;
            }

            videosControllerRef.current.abort();
        }

        const controller = new AbortController();
        videosControllerRef.current = controller;

        if (mode === 'initial') {
            setIsVideosLoading(true);
        } else if (mode === 'more') {
            setIsLoadingMore(true);
        }

        setVideosErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FavoritesRequestError('登录信息不存在,请重新登录');
            }

            const nextPage = await fetchFavoriteVideoPage(
                folder.id,
                targetPage,
                cookie,
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
            setHasMore(nextPage.hasMore);
        } catch (error) {
            if (!isAbortError(error)) {
                setVideosErrorMessage(getErrorMessage(error, '收藏视频'));
                setHasMore(false);
            }
        } finally {
            if (videosControllerRef.current === controller) {
                videosControllerRef.current = null;
                setIsVideosLoading(false);
                setIsLoadingMore(false);
            }
        }
    }, []);

    const selectFolder = useCallback((folder: FavoriteFolder) => {
        if (folder.id === selectedFolderIdRef.current) {
            return;
        }

        videosControllerRef.current?.abort();
        videosControllerRef.current = null;
        selectedFolderIdRef.current = folder.id;
        setSelectedFolderId(folder.id);
        setVideos([]);
        setCurrentPage(0);
        setHasMore(false);
        setIsLoadingMore(false);
        setVideosErrorMessage(null);
        void loadVideoPage(folder, 1, 'initial');
    }, [loadVideoPage]);

    const initializeFavorites = useCallback(async () => {
        const nextFolders = await loadFolders(true);
        const firstFolder = nextFolders?.[0];

        if (!firstFolder) {
            selectedFolderIdRef.current = null;
            setSelectedFolderId(null);
            setVideos([]);
            return;
        }

        selectedFolderIdRef.current = firstFolder.id;
        setSelectedFolderId(firstFolder.id);
        await loadVideoPage(firstFolder, 1, 'initial');
    }, [loadFolders, loadVideoPage]);

    const refreshFavorites = useCallback(async () => {
        videosControllerRef.current?.abort();
        videosControllerRef.current = null;
        setIsRefreshing(true);

        try {
            const refreshedFolders = await loadFolders(false);
            const availableFolders = refreshedFolders ?? foldersRef.current;
            const currentFolderId = selectedFolderIdRef.current;
            const selectedFolder =
                availableFolders.find((folder) => folder.id === currentFolderId) ??
                availableFolders[0];

            if (!selectedFolder) {
                selectedFolderIdRef.current = null;
                setSelectedFolderId(null);
                setVideos([]);
                setCurrentPage(0);
                setHasMore(false);
                return;
            }

            if (selectedFolder.id !== currentFolderId) {
                selectedFolderIdRef.current = selectedFolder.id;
                setSelectedFolderId(selectedFolder.id);
                setVideos([]);
                setCurrentPage(0);
                setHasMore(false);
            }

            await loadVideoPage(selectedFolder, 1, 'refresh');
        } finally {
            setIsRefreshing(false);
        }
    }, [loadFolders, loadVideoPage]);

    useEffect(() => {
        void initializeFavorites();

        return () => {
            foldersControllerRef.current?.abort();
            videosControllerRef.current?.abort();
            foldersControllerRef.current = null;
            videosControllerRef.current = null;
        };
    }, [initializeFavorites]);

    const selectedFolder = folders.find(
        (folder) => folder.id === selectedFolderId,
    ) ?? null;

    const renderFavoriteVideo = useCallback(({
        item,
    }: ListRenderItemInfo<FavoriteVideo>) => (
        <VideoListCard
            metaText={formatFavoritedTime(item.favoritedAt)}
            onPress={() => onVideoPress(createVideoPlaybackTarget(item))}
            video={item}
        />
    ), [onVideoPress]);

    if (isFoldersLoading && folders.length === 0) {
        return (
            <View style={styles.centeredPage}>
                <ActivityIndicator color={colors.primary} size='large' />
                <Text style={styles.statusText}>正在加载收藏夹...</Text>
            </View>
        );
    }

    if (foldersErrorMessage && folders.length === 0) {
        return (
            <View style={styles.centeredPage}>
                <Text style={styles.errorText}>{foldersErrorMessage}</Text>
                <Pressable
                    accessibilityRole='button'
                    onPress={() => void initializeFavorites()}
                    style={styles.retryButton}
                >
                    <Text style={styles.retryButtonText}>重新加载</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            <FavoriteFolderSelector
                errorMessage={foldersErrorMessage}
                folders={folders}
                isLoading={isFoldersLoading && !isRefreshing}
                onRetry={() => void refreshFavorites()}
                onSelect={selectFolder}
                selectedFolderId={selectedFolderId}
            />

            {isVideosLoading && videos.length === 0 ? (
                <View style={styles.centeredContent}>
                    <ActivityIndicator color={colors.primary} size='large' />
                    <Text style={styles.statusText}>正在加载收藏视频...</Text>
                </View>
            ) : null}

            {!isVideosLoading && videosErrorMessage && videos.length === 0 ? (
                <View style={styles.centeredContent}>
                    <Text style={styles.errorText}>{videosErrorMessage}</Text>
                    {selectedFolder ? (
                        <Pressable
                            accessibilityRole='button'
                            onPress={() => void loadVideoPage(selectedFolder, 1, 'initial')}
                            style={styles.retryButton}
                        >
                            <Text style={styles.retryButtonText}>重新加载</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {!isVideosLoading && !(videosErrorMessage && videos.length === 0) ? (
                <FlatList
                    contentContainerStyle={[
                        videos.length === 0 ? styles.emptyList : styles.videoList,
                        { paddingBottom: bottomTabBarHeight + spacing.md },
                    ]}
                    data={videos}
                    initialNumToRender={8}
                    keyExtractor={getFavoriteVideoKey}
                    ListEmptyComponent={
                        <Text style={styles.statusText}>
                            {selectedFolder
                                ? '该收藏夹暂时没有可显示的视频'
                                : '暂时没有收藏夹'}
                        </Text>
                    }
                    ListFooterComponent={
                        isLoadingMore ? (
                            <AppLoadingIndicator
                                style={styles.footerLoading}
                            />
                        ) : null
                    }
                    ListHeaderComponent={
                        videosErrorMessage ? (
                            <Text style={styles.inlineError}>{videosErrorMessage}</Text>
                        ) : null
                    }
                    onEndReached={() => {
                        if (
                            selectedFolder &&
                            hasMore &&
                            !isLoadingMore &&
                            !videosControllerRef.current
                        ) {
                            void loadVideoPage(
                                selectedFolder,
                                currentPage + 1,
                                'more',
                            );
                        }
                    }}
                    onEndReachedThreshold={0.4}
                    maxToRenderPerBatch={8}
                    refreshControl={(
                        <AppRefreshControl
                            onRefresh={() => void refreshFavorites()}
                            refreshing={isRefreshing}
                        />
                    )}
                    removeClippedSubviews
                    renderItem={renderFavoriteVideo}
                    style={styles.listView}
                    updateCellsBatchingPeriod={50}
                    windowSize={9}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listView: {
        flex: 1,
    },
    centeredPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background,
    },
    centeredContent: {
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
        alignSelf: 'center',
        marginVertical: spacing.md,
    },
});
