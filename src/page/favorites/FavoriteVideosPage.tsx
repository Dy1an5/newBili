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
import {
    fetchFavoriteVideoPage,
    FavoritesRequestError,
} from '@/page/favorites/fetchFavorites';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { FavoriteFolder, FavoriteVideo } from '@/types/favorites';
import type { VideoPlaybackTarget } from '@/types/video';
import { createVideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';

type Props = {
    folder: FavoriteFolder;
    onBack: () => void;
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof FavoritesRequestError) {
        return error.message;
    }

    return '加载收藏视频失败,请稍后重试';
}

function formatFavoritedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `收藏于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function FavoriteVideosPage({ folder, onBack, onVideoPress }: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [videos, setVideos] = useState<FavoriteVideo[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    const loadVideoPage = useCallback(async (targetPage: number, refreshing: boolean) => {
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
        } else {
            setIsLoadingMore(true);
        }

        setErrorMessage(null);

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

                const existingBvids = new Set(currentVideos.map((video) => video.bvid));
                const newVideos = nextPage.videos.filter(
                    (video) => !existingBvids.has(video.bvid),
                );

                return [...currentVideos, ...newVideos];
            });
            setCurrentPage(targetPage);
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
    }, [folder.id]);

    useEffect(() => {
        void loadVideoPage(1, false);

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadVideoPage]);

    if (isLoading && videos.length === 0) {
        return (
            <View style={styles.page}>
                <PageHeader folder={folder} onBack={onBack} />
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.primary} size='large' />
                    <Text style={styles.statusText}>正在加载收藏视频...</Text>
                </View>
            </View>
        );
    }

    if (errorMessage && videos.length === 0) {
        return (
            <View style={styles.page}>
                <PageHeader folder={folder} onBack={onBack} />
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
            <PageHeader folder={folder} onBack={onBack} />
            <FlatList
                data={videos}
                keyExtractor={(video) => video.bvid}
                contentContainerStyle={[
                    videos.length === 0 ? styles.emptyList : styles.videoList,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                refreshing={isRefreshing}
                onRefresh={() => void loadVideoPage(1, true)}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (hasMore && !isLoadingMore && !requestControllerRef.current) {
                        void loadVideoPage(currentPage + 1, false);
                    }
                }}
                ListHeaderComponent={
                    errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null
                }
                ListEmptyComponent={
                    <Text style={styles.statusText}>该收藏夹暂时没有可显示的视频</Text>
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
                        metaText={formatFavoritedTime(item.favoritedAt)}
                        onPress={() => onVideoPress(createVideoPlaybackTarget(item))}
                    />
                )}
            />
        </View>
    );
}

function PageHeader({ folder, onBack }: { folder: FavoriteFolder; onBack: () => void }) {
    return (
        <View style={styles.header}>
            <Pressable accessibilityRole='button' onPress={onBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>返回</Text>
            </Pressable>
            <View style={styles.headerText}>
                <Text numberOfLines={1} style={styles.headerTitle}>{folder.title}</Text>
                <Text style={styles.headerSummary}>共{folder.mediaCount}个视频</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    backButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        marginRight: spacing.sm,
    },
    backButtonText: {
        color: colors.primary,
        fontSize: 16,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        color: colors.textPrimary,
        fontSize: 17,
        fontWeight: '600',
    },
    headerSummary: {
        marginTop: 2,
        color: colors.textMuted,
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
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    footerLoading: {
        paddingVertical: spacing.md,
    },
});
