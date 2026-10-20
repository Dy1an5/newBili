import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
    type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppRefreshControl from '@/components/AppRefreshControl';
import BilibiliImage from '@/components/BilibiliImage';
import UserAvatar from '@/components/UserAvatar';
import VideoListCard from '@/components/VideoListCard';
import VideoListSortToolbar from '@/components/VideoListSortToolbar';
import {
    fetchFollowedCollectionDetail,
    FollowedCollectionsRequestError,
    type FollowedCollection,
    type FollowedCollectionVideo,
} from '@/page/favorites/fetchFollowedCollections';
import {
    createVideoPlaybackTarget,
    type VideoPlaybackTarget,
} from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    initialCollection: FollowedCollection;
    onBack: () => void;
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

type RequestMode = 'initial' | 'refresh';

function getErrorMessage(error: unknown): string {
    if (error instanceof FollowedCollectionsRequestError) {
        return error.message;
    }

    return '加载合集详情失败,请稍后重试';
}

function formatPublishedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `发布于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function compareVideoPublishedTime(
    firstVideo: FollowedCollectionVideo,
    secondVideo: FollowedCollectionVideo,
    ascending: boolean,
): number {
    if (firstVideo.publishedAt <= 0) {
        return secondVideo.publishedAt <= 0 ? 0 : 1;
    }

    if (secondVideo.publishedAt <= 0) {
        return -1;
    }

    return ascending
        ? firstVideo.publishedAt - secondVideo.publishedAt
        : secondVideo.publishedAt - firstVideo.publishedAt;
}

export default function FollowedCollectionDetailPage({
    initialCollection,
    onBack,
    onVideoPress,
}: Props) {
    const safeAreaInsets = useSafeAreaInsets();
    const [collection, setCollection] = useState(initialCollection);
    const [videos, setVideos] = useState<FollowedCollectionVideo[]>([]);
    const [ascending, setAscending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);
    const isRefreshingRef = useRef(false);
    const listRef = useRef<FlatList<FollowedCollectionVideo> | null>(null);

    const loadDetail = useCallback(async (
        mode: RequestMode,
    ) => {
        if (requestControllerRef.current) {
            requestControllerRef.current.abort();
        }

        const controller = new AbortController();
        requestControllerRef.current = controller;

        if (mode === 'initial') {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }

        setErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowedCollectionsRequestError(
                    '登录信息不存在,请重新登录',
                );
            }

            const result = await fetchFollowedCollectionDetail(
                initialCollection.id,
                cookie,
                controller.signal,
            );

            setCollection(result.collection);
            setVideos(result.videos);
        } catch (error) {
            if (!isRequestCancelled(error, controller.signal)) {
                setErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [initialCollection.id]);

    const refreshDetail = useCallback(async () => {
        if (isRefreshingRef.current) {
            return;
        }

        isRefreshingRef.current = true;

        try {
            await loadDetail('refresh');
        } finally {
            isRefreshingRef.current = false;
        }
    }, [loadDetail]);

    useEffect(() => {
        void loadDetail('initial');

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadDetail]);

    const sortedVideos = useMemo(() => [...videos].sort((firstVideo, secondVideo) => (
        compareVideoPublishedTime(firstVideo, secondVideo, ascending)
    )), [ascending, videos]);

    const selectSort = useCallback((nextAscending: boolean) => {
        if (nextAscending === ascending) {
            return;
        }

        setAscending(nextAscending);
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
    }, [ascending]);

    const renderVideo = useCallback(({
        item,
    }: ListRenderItemInfo<FollowedCollectionVideo>) => (
        <VideoListCard
            metaText={formatPublishedTime(item.publishedAt)}
            onPress={() => onVideoPress(createVideoPlaybackTarget({
                ...item,
                author: collection.author,
            }))}
            video={{
                ...item,
                author: collection.author,
            }}
        />
    ), [collection.author, onVideoPress]);

    const header = (
        <>
            <View style={styles.navigationHeader}>
                <Pressable
                    accessibilityLabel='返回合集列表'
                    accessibilityRole='button'
                    hitSlop={spacing.md}
                    onPress={onBack}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Text style={styles.backIcon}>‹</Text>
                </Pressable>
                <Text numberOfLines={1} style={styles.navigationTitle}>
                    合集详情
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.collectionHeader}>
                <BilibiliImage
                    style={styles.collectionCover}
                    thumbnailSize={{ width: 160, height: 100 }}
                    uri={collection.coverUrl}
                />
                <View style={styles.collectionInfo}>
                    <Text numberOfLines={2} style={styles.collectionTitle}>
                        {collection.title}
                    </Text>
                    <View style={styles.authorRow}>
                        <UserAvatar
                            name={collection.author.name}
                            size={24}
                            style={styles.avatar}
                            uri={collection.author.avatarUrl}
                        />
                        <Text numberOfLines={1} style={styles.authorName}>
                            {collection.author.name}
                        </Text>
                    </View>
                    <Text style={styles.mediaCount}>
                        共{collection.mediaCount}个视频
                    </Text>
                </View>
            </View>
        </>
    );

    if (isLoading && videos.length === 0) {
        return (
            <View style={styles.page}>
                {header}
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.accentForeground} size='large' />
                    <Text style={styles.statusText}>正在加载合集视频...</Text>
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
                        onPress={() => void loadDetail('initial')}
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
            <VideoListSortToolbar
                ascending={ascending}
                ascendingLabel='最早发布'
                descendingLabel='最近发布'
                onSortChange={selectSort}
                title={`合集视频(${collection.mediaCount})`}
            />
            <FlatList
                ref={listRef}
                style={styles.listView}
                contentContainerStyle={[
                    sortedVideos.length === 0 ? styles.emptyList : styles.videoList,
                    { paddingBottom: safeAreaInsets.bottom + spacing.lg },
                ]}
                data={sortedVideos}
                initialNumToRender={8}
                keyExtractor={(video) => video.bvid}
                ListEmptyComponent={(
                    <Text style={styles.statusText}>
                        该合集暂时没有可显示的视频
                    </Text>
                )}
                ListFooterComponent={errorMessage && videos.length > 0 ? (
                    <View style={styles.footer}>
                        <Text style={styles.inlineError}>{errorMessage}</Text>
                        <AppButton
                            onPress={() => void refreshDetail()}
                            title='重试'
                        />
                    </View>
                ) : null}
                maxToRenderPerBatch={8}
                refreshControl={(
                    <AppRefreshControl
                        onRefresh={() => void refreshDetail()}
                        refreshing={isRefreshing}
                    />
                )}
                removeClippedSubviews
                renderItem={renderVideo}
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
    listView: {
        flex: 1,
    },
    navigationHeader: {
        height: 50,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        color: colors.primaryText,
        fontSize: 38,
        lineHeight: 40,
        fontWeight: '300',
    },
    navigationTitle: {
        flex: 1,
        color: colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 44,
    },
    collectionHeader: {
        padding: spacing.md,
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    collectionCover: {
        width: 160,
        height: 100,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    collectionInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    collectionTitle: {
        color: colors.primaryText,
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '600',
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    avatar: {
        marginRight: spacing.xs,
    },
    authorName: {
        flex: 1,
        color: colors.secondaryText,
        fontSize: 12,
    },
    mediaCount: {
        marginTop: spacing.xs,
        color: colors.mutedText,
        fontSize: 12,
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
        marginVertical: spacing.sm,
        color: colors.secondaryText,
        fontSize: 13,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.md,
    },
    footer: {
        alignItems: 'center',
        marginVertical: spacing.sm,
    },
    pressed: {
        opacity: 0.7,
    },
});
