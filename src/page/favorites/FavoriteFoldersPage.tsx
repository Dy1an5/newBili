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
import SelectionSheet from '@/components/SelectionSheet';
import VideoListCard from '@/components/VideoListCard';
import FollowedCollectionsPage from '@/page/favorites/FollowedCollectionsPage';
import type { FollowedCollection } from '@/page/favorites/fetchFollowedCollections';
import {
    fetchFavoriteFolders,
    fetchFavoriteVideoPage,
    FavoritesRequestError,
    type FavoriteFolder,
    type FavoriteVideo,
} from '@/page/favorites/fetchFavorites';
import {
    createVideoPlaybackTarget,
    type VideoPlaybackTarget,
} from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { createGetErrorMessageWithResource } from '@/tool/errorMessage';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    onCollectionPress: (collection: FollowedCollection) => void;
    onVideoPress: (target: VideoPlaybackTarget) => void;
    refreshRequestId: number;
    selectorRequestId: number;
};

type VideoRequestMode = 'initial' | 'refresh' | 'more';

const COLLECTIONS_OPTION_VALUE = 'followed-collections';

const getErrorMessage = createGetErrorMessageWithResource(
    [FavoritesRequestError],
    (resourceName) => `加载${resourceName}失败,请稍后重试`,
);

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

export default function FavoriteFoldersPage({
    onCollectionPress,
    onVideoPress,
    refreshRequestId,
    selectorRequestId,
}: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [isSelectorVisible, setIsSelectorVisible] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [selectedOptionValue, setSelectedOptionValue] =
        useState<string | null>(null);
    const [hasOpenedCollections, setHasOpenedCollections] = useState(false);
    const [collectionsRefreshRequestId, setCollectionsRefreshRequestId] =
        useState(0);
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
    const selectedFolderIdRef = useRef<string | null>(null);
    const selectedOptionValueRef = useRef<string | null>(null);
    const isRefreshingRef = useRef(false);
    const handledRefreshRequestIdRef = useRef(refreshRequestId);
    const handledSelectorRequestIdRef = useRef(selectorRequestId);
    const listRef = useRef<FlatList<FavoriteVideo> | null>(null);
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
            if (!isRequestCancelled(error, controller.signal)) {
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
            if (!isRequestCancelled(error, controller.signal)) {
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
        selectedOptionValueRef.current = folder.id;
        setSelectedOptionValue(folder.id);

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

    const selectCollections = useCallback(() => {
        selectedOptionValueRef.current = COLLECTIONS_OPTION_VALUE;
        setSelectedOptionValue(COLLECTIONS_OPTION_VALUE);
        setHasOpenedCollections(true);
    }, []);

    const initializeFavorites = useCallback(async () => {
        const nextFolders = await loadFolders(true);
        const firstFolder = nextFolders?.[0];

        if (!firstFolder) {
            selectedFolderIdRef.current = null;
            setSelectedFolderId(null);
            setVideos([]);

            if (selectedOptionValueRef.current !== COLLECTIONS_OPTION_VALUE) {
                selectedOptionValueRef.current = null;
                setSelectedOptionValue(null);
            }

            return;
        }

        selectedFolderIdRef.current = firstFolder.id;
        setSelectedFolderId(firstFolder.id);

        if (selectedOptionValueRef.current !== COLLECTIONS_OPTION_VALUE) {
            selectedOptionValueRef.current = firstFolder.id;
            setSelectedOptionValue(firstFolder.id);
        }

        await loadVideoPage(firstFolder, 1, 'initial');
    }, [loadFolders, loadVideoPage]);

    const refreshFavorites = useCallback(async () => {
        if (isRefreshingRef.current) {
            return;
        }

        isRefreshingRef.current = true;
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

                if (selectedOptionValueRef.current !== COLLECTIONS_OPTION_VALUE) {
                    selectedOptionValueRef.current = null;
                    setSelectedOptionValue(null);
                }

                return;
            }

            if (selectedFolder.id !== currentFolderId) {
                selectedFolderIdRef.current = selectedFolder.id;
                setSelectedFolderId(selectedFolder.id);
                setVideos([]);
                setCurrentPage(0);
                setHasMore(false);

                if (selectedOptionValueRef.current !== COLLECTIONS_OPTION_VALUE) {
                    selectedOptionValueRef.current = selectedFolder.id;
                    setSelectedOptionValue(selectedFolder.id);
                }
            }

            await loadVideoPage(selectedFolder, 1, 'refresh');
        } finally {
            isRefreshingRef.current = false;
            setIsRefreshing(false);
        }
    }, [loadFolders, loadVideoPage]);

    useEffect(() => {
        if (handledRefreshRequestIdRef.current === refreshRequestId) {
            return;
        }

        handledRefreshRequestIdRef.current = refreshRequestId;

        if (selectedOptionValueRef.current === COLLECTIONS_OPTION_VALUE) {
            setCollectionsRefreshRequestId((currentId) => currentId + 1);
            return;
        }

        listRef.current?.scrollToOffset({
            animated: false,
            offset: 0,
        });
        void refreshFavorites();
    }, [refreshFavorites, refreshRequestId]);

    useEffect(() => {
        if (handledSelectorRequestIdRef.current === selectorRequestId) {
            return;
        }

        handledSelectorRequestIdRef.current = selectorRequestId;
        setIsSelectorVisible(true);
    }, [selectorRequestId]);

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
    const isCollectionsSelected =
        selectedOptionValue === COLLECTIONS_OPTION_VALUE;
    const selectedOptionLabel = isCollectionsSelected
        ? '合集'
        : selectedFolder
            ? `${selectedFolder.title}(${selectedFolder.mediaCount})`
            : '收藏夹';

    const renderFavoriteVideo = useCallback(({
        item,
    }: ListRenderItemInfo<FavoriteVideo>) => (
        <VideoListCard
            metaText={formatFavoritedTime(item.favoritedAt)}
            onPress={() => onVideoPress(createVideoPlaybackTarget(item))}
            video={item}
        />
    ), [onVideoPress]);

    let favoriteContent;

    if (isFoldersLoading && folders.length === 0) {
        favoriteContent = (
            <View style={styles.centeredContent}>
                <ActivityIndicator color={colors.accentForeground} size='large' />
                <Text style={styles.statusText}>正在加载收藏夹...</Text>
            </View>
        );
    } else if (foldersErrorMessage && folders.length === 0) {
        favoriteContent = (
            <View style={styles.centeredContent}>
                <Text style={styles.errorText}>{foldersErrorMessage}</Text>
                <AppButton
                    onPress={() => void initializeFavorites()}
                    style={styles.actionButton}
                    title='重新加载'
                />
            </View>
        );
    } else if (isVideosLoading && videos.length === 0) {
        favoriteContent = (
            <View style={styles.centeredContent}>
                <ActivityIndicator color={colors.accentForeground} size='large' />
                <Text style={styles.statusText}>正在加载收藏视频...</Text>
            </View>
        );
    } else if (videosErrorMessage && videos.length === 0) {
        favoriteContent = (
            <View style={styles.centeredContent}>
                <Text style={styles.errorText}>{videosErrorMessage}</Text>
                {selectedFolder ? (
                    <AppButton
                        onPress={() => void loadVideoPage(selectedFolder, 1, 'initial')}
                        style={styles.actionButton}
                        title='重新加载'
                    />
                ) : null}
            </View>
        );
    } else {
        favoriteContent = (
            <FlatList
                ref={listRef}
                contentContainerStyle={[
                    videos.length === 0 ? styles.emptyList : styles.videoList,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                data={videos}
                initialNumToRender={8}
                keyExtractor={getFavoriteVideoKey}
                ListEmptyComponent={(
                    <Text style={styles.statusText}>
                        {selectedFolder
                            ? '该收藏夹暂时没有可显示的视频'
                            : '暂时没有收藏夹'}
                    </Text>
                )}
                ListFooterComponent={isLoadingMore ? (
                    <AppLoadingIndicator style={styles.footerLoading} />
                ) : null}
                ListHeaderComponent={videosErrorMessage ? (
                    <Text style={styles.inlineError}>{videosErrorMessage}</Text>
                ) : null}
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
        );
    }

    return (
        <View style={styles.page}>
            <SelectionHeader
                accessibilityLabel='选择收藏夹或合集'
                label={selectedOptionLabel}
                onPress={() => setIsSelectorVisible(true)}
            />

            <SelectionSheet
                errorMessage={
                    isCollectionsSelected || folders.length === 0
                        ? null
                        : foldersErrorMessage
                }
                isLoading={
                    !isCollectionsSelected &&
                    isFoldersLoading &&
                    !isRefreshing
                }
                onClose={() => setIsSelectorVisible(false)}
                onRetry={() => void refreshFavorites()}
                onSelect={(optionValue) => {
                    if (optionValue === COLLECTIONS_OPTION_VALUE) {
                        selectCollections();
                        return;
                    }

                    const folder = folders.find((item) => item.id === optionValue);

                    if (folder) {
                        selectFolder(folder);
                    }
                }}
                options={[
                    {
                        value: COLLECTIONS_OPTION_VALUE,
                        label: '合集',
                        accessibilityLabel: '已关注的合集',
                    },
                    ...folders.map((folder) => ({
                        value: folder.id,
                        label: `${folder.title}(${folder.mediaCount})`,
                        accessibilityLabel: `${folder.title},${folder.mediaCount}个视频`,
                    })),
                ]}
                selectedValue={selectedOptionValue}
                title='选择收藏夹'
                visible={isSelectorVisible}
            />

            <View style={[
                styles.content,
                isCollectionsSelected && styles.hiddenContent,
            ]}>
                {favoriteContent}
            </View>

            {hasOpenedCollections ? (
                <View style={[
                    styles.content,
                    !isCollectionsSelected && styles.hiddenContent,
                ]}>
                    <FollowedCollectionsPage
                        onCollectionPress={onCollectionPress}
                        refreshRequestId={collectionsRefreshRequestId}
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    listView: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    hiddenContent: {
        display: 'none',
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
