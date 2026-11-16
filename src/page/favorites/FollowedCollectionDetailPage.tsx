import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    View,
    type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppRefreshControl from '@/components/AppRefreshControl';
import AppText from '@/components/AppText';
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
import { createGetErrorMessage } from '@/tool/errorMessage';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    initialCollection: FollowedCollection;
    onBack: () => void;
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

type RequestMode = 'initial' | 'refresh';

const getErrorMessage = createGetErrorMessage(
    [FollowedCollectionsRequestError],
    '加载合集详情失败,请稍后重试',
);

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
                    <MaterialIcons
                        color={colors.primaryText}
                        name='chevron-left'
                        size={24}
                    />
                </Pressable>
                <AppText numberOfLines={1} style={styles.navigationTitle} variant='heading'>
                    合集详情
                </AppText>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.collectionHeader}>
                <BilibiliImage
                    style={styles.collectionCover}
                    thumbnailSize={{ width: 160, height: 100 }}
                    uri={collection.coverUrl}
                />
                <View style={styles.collectionInfo}>
                    <AppText numberOfLines={2} variant='titleSmall'>
                        {collection.title}
                    </AppText>
                    <View style={styles.authorRow}>
                        <UserAvatar
                            name={collection.author.name}
                            size={24}
                            style={styles.avatar}
                            uri={collection.author.avatarUrl}
                        />
                        <AppText
                            color={colors.secondaryText}
                            numberOfLines={1}
                            style={styles.authorName}
                            variant='caption'
                        >
                            {collection.author.name}
                        </AppText>
                    </View>
                    <AppText color={colors.mutedText} style={styles.mediaCount} variant='caption'>
                        共{collection.mediaCount}个视频
                    </AppText>
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
                    <AppText color={colors.secondaryText} style={styles.statusText} variant='bodySmall'>
                        正在加载合集视频...
                    </AppText>
                </View>
            </View>
        );
    }

    if (errorMessage && videos.length === 0) {
        return (
            <View style={styles.page}>
                {header}
                <View style={styles.centered}>
                    <AppText color={colors.alertText} style={styles.errorText} variant='bodySmall'>{errorMessage}</AppText>
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
                    <AppText color={colors.secondaryText} style={styles.statusText} variant='bodySmall'>
                        该合集暂时没有可显示的视频
                    </AppText>
                )}
                ListFooterComponent={errorMessage && videos.length > 0 ? (
                    <View style={styles.footer}>
                        <AppText
                            color={colors.secondaryText}
                            style={styles.inlineError}
                            variant='caption'
                        >
                            {errorMessage}
                        </AppText>
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
        minHeight: 56,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    backButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navigationTitle: {
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 48,
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
    },
    mediaCount: {
        marginTop: spacing.xs,
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
        textAlign: 'center',
    },
    errorText: {
        textAlign: 'center',
    },
    inlineError: {
        marginVertical: spacing.sm,
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
