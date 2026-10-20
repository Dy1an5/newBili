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
import AppButton from '@/components/AppButton';
import AppLoadingIndicator from '@/components/AppLoadingIndicator';
import AppRefreshControl from '@/components/AppRefreshControl';
import BilibiliImage from '@/components/BilibiliImage';
import UserAvatar from '@/components/UserAvatar';
import {
    fetchFollowedCollectionPage,
    FollowedCollectionsRequestError,
    type FollowedCollection,
} from '@/page/favorites/fetchFollowedCollections';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { isRequestCancelled } from '@/tool/requestCancellation';

const COVER_WIDTH = 132;
const COVER_HEIGHT = COVER_WIDTH * 10 / 16;

type Props = {
    onCollectionPress: (collection: FollowedCollection) => void;
    refreshRequestId: number;
};

type RequestMode = 'initial' | 'refresh' | 'more';
type FailedRequest = {
    page: number;
    mode: RequestMode;
};

function getErrorMessage(error: unknown): string {
    if (error instanceof FollowedCollectionsRequestError) {
        return error.message;
    }

    return '加载合集失败,请稍后重试';
}

function getCollectionKey(collection: FollowedCollection): string {
    return collection.id;
}

function mergeCollections(
    currentCollections: FollowedCollection[],
    nextCollections: FollowedCollection[],
): FollowedCollection[] {
    const ids = new Set(currentCollections.map((collection) => collection.id));
    const uniqueCollections = nextCollections.filter((collection) => {
        if (ids.has(collection.id)) {
            return false;
        }

        ids.add(collection.id);
        return true;
    });

    return [...currentCollections, ...uniqueCollections];
}

function CollectionCard({
    collection,
    onPress,
}: {
    collection: FollowedCollection;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityLabel={`${collection.title},${collection.mediaCount}个视频`}
            accessibilityRole='button'
            onPress={onPress}
            style={({ pressed }) => [
                styles.collectionCard,
                pressed && styles.collectionCardPressed,
            ]}
        >
            <BilibiliImage
                style={styles.cover}
                thumbnailSize={{
                    width: COVER_WIDTH,
                    height: COVER_HEIGHT,
                }}
                uri={collection.coverUrl}
            />

            <View style={styles.collectionInfo}>
                <Text numberOfLines={2} style={styles.collectionTitle}>
                    {collection.title}
                </Text>
                <View style={styles.authorRow}>
                    <UserAvatar
                        name={collection.author.name}
                        size={22}
                        style={styles.avatar}
                        uri={collection.author.avatarUrl}
                    />
                    <Text numberOfLines={1} style={styles.authorName}>
                        {collection.author.name}
                    </Text>
                </View>
                <Text style={styles.mediaCount}>
                    {collection.mediaCount}个视频
                </Text>
            </View>
        </Pressable>
    );
}

export default function FollowedCollectionsPage({
    onCollectionPress,
    refreshRequestId,
}: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [collections, setCollections] = useState<FollowedCollection[]>([]);
    const [nextPage, setNextPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);
    const isRefreshingRef = useRef(false);
    const handledRefreshRequestIdRef = useRef(refreshRequestId);
    const listRef = useRef<FlatList<FollowedCollection> | null>(null);

    const loadPage = useCallback(async (
        targetPage: number,
        mode: RequestMode,
    ) => {
        if (requestControllerRef.current) {
            if (mode === 'more') {
                return;
            }

            requestControllerRef.current.abort();
        }

        const controller = new AbortController();
        requestControllerRef.current = controller;

        if (mode === 'initial') {
            setIsLoading(true);
        } else if (mode === 'refresh') {
            setIsRefreshing(true);
        } else {
            setIsLoadingMore(true);
        }

        setErrorMessage(null);
        setFailedRequest(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowedCollectionsRequestError(
                    '登录信息不存在,请重新登录',
                );
            }

            const result = await fetchFollowedCollectionPage(
                targetPage,
                cookie,
                controller.signal,
            );

            setCollections((currentCollections) => targetPage === 1
                ? result.collections
                : mergeCollections(currentCollections, result.collections));
            setNextPage(result.nextPage);
            setHasMore(result.hasMore);
        } catch (error) {
            if (!isRequestCancelled(error, controller.signal)) {
                setErrorMessage(getErrorMessage(error));
                setFailedRequest({ page: targetPage, mode });
            }
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
            }
        }
    }, []);

    const refreshCollections = useCallback(async () => {
        if (isRefreshingRef.current) {
            return;
        }

        isRefreshingRef.current = true;

        try {
            await loadPage(1, 'refresh');
        } finally {
            isRefreshingRef.current = false;
        }
    }, [loadPage]);

    useEffect(() => {
        void loadPage(1, 'initial');

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadPage]);

    useEffect(() => {
        if (handledRefreshRequestIdRef.current === refreshRequestId) {
            return;
        }

        handledRefreshRequestIdRef.current = refreshRequestId;
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
        void refreshCollections();
    }, [refreshCollections, refreshRequestId]);

    const renderCollection = useCallback(({
        item,
    }: ListRenderItemInfo<FollowedCollection>) => (
        <CollectionCard
            collection={item}
            onPress={() => onCollectionPress(item)}
        />
    ), [onCollectionPress]);

    if (isLoading && collections.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accentForeground} size='large' />
                <Text style={styles.statusText}>正在加载合集...</Text>
            </View>
        );
    }

    if (errorMessage && collections.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <AppButton
                    onPress={() => void loadPage(1, 'initial')}
                    style={styles.actionButton}
                    title='重新加载'
                />
            </View>
        );
    }

    return (
        <FlatList
            ref={listRef}
            style={styles.listView}
            contentContainerStyle={[
                collections.length === 0 ? styles.emptyList : styles.list,
                { paddingBottom: bottomTabBarHeight + spacing.md },
            ]}
            data={collections}
            initialNumToRender={8}
            keyExtractor={getCollectionKey}
            ListEmptyComponent={(
                <Text style={styles.statusText}>暂时没有已关注的合集</Text>
            )}
            ListFooterComponent={(
                <View style={styles.footer}>
                    {isLoadingMore ? <AppLoadingIndicator /> : null}
                    {errorMessage && collections.length > 0 ? (
                        <>
                            <Text style={styles.inlineError}>{errorMessage}</Text>
                            <AppButton
                                onPress={() => {
                                    if (failedRequest) {
                                        void loadPage(
                                            failedRequest.page,
                                            failedRequest.mode,
                                        );
                                    }
                                }}
                                title='重试'
                            />
                        </>
                    ) : null}
                </View>
            )}
            maxToRenderPerBatch={8}
            onEndReached={() => {
                if (
                    hasMore &&
                    !isLoadingMore &&
                    !errorMessage &&
                    !requestControllerRef.current
                ) {
                    void loadPage(nextPage, 'more');
                }
            }}
            onEndReachedThreshold={0.4}
            refreshControl={(
                <AppRefreshControl
                    onRefresh={() => void refreshCollections()}
                    refreshing={isRefreshing}
                />
            )}
            removeClippedSubviews
            renderItem={renderCollection}
            updateCellsBatchingPeriod={50}
            windowSize={9}
        />
    );
}

const styles = StyleSheet.create({
    listView: {
        flex: 1,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.pageBackground,
    },
    list: {
        paddingVertical: spacing.md,
    },
    emptyList: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    collectionCard: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceBackground,
    },
    collectionCardPressed: {
        opacity: 0.8,
    },
    cover: {
        width: COVER_WIDTH,
        height: COVER_HEIGHT,
        borderRadius: radius.sm,
        backgroundColor: colors.pageBackground,
    },
    collectionInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    collectionTitle: {
        color: colors.primaryText,
        fontSize: 14,
        lineHeight: 20,
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
        fontSize: 11,
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
});
