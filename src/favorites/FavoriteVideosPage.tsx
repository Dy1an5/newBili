import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { FavoriteFolder, FavoriteVideo } from '@/types/favorites';
import type { VideoFollowingItem } from '@/types/following';
import {
    fetchFavoriteVideoPage,
    FavoritesRequestError,
} from './fetchFavorites';

type Props = {
    folder: FavoriteFolder;
    onBack: () => void;
    onVideoPress: (video: VideoFollowingItem) => void;
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

function formatDuration(durationSeconds: number): string {
    if (durationSeconds <= 0) {
        return '';
    }

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = Math.floor(durationSeconds % 60);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFavoriteTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp * 1000);

    return `收藏于${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function FavoriteVideoCard({
    video,
    onPress,
}: {
    video: FavoriteVideo;
    onPress: () => void;
}) {
    const duration = formatDuration(video.durationSeconds);
    const favoriteTime = formatFavoriteTime(video.favoriteAt);

    return (
        <Pressable
            accessibilityRole='button'
            onPress={onPress}
            style={({ pressed }) => [
                styles.videoCard,
                pressed && styles.videoCardPressed,
            ]}
        >
            <View style={styles.coverContainer}>
                <Image source={{ uri: video.cover }} resizeMode='cover' style={styles.cover} />
                {duration ? (
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{duration}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.videoInfo}>
                <Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text>
                <View style={styles.authorRow}>
                    <Image source={{ uri: video.author.avatar }} style={styles.avatar} />
                    <Text numberOfLines={1} style={styles.authorName}>{video.author.name}</Text>
                </View>
                {favoriteTime ? (
                    <Text style={styles.favoriteTime}>{favoriteTime}</Text>
                ) : null}
            </View>
        </Pressable>
    );
}

export default function FavoriteVideosPage({ folder, onBack, onVideoPress }: Props) {
    const [videos, setVideos] = useState<FavoriteVideo[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    const loadPage = useCallback(async (targetPage: number, refreshing: boolean) => {
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
                    return nextPage.items;
                }

                const existingIds = new Set(currentVideos.map((video) => video.id));
                const newVideos = nextPage.items.filter((video) => !existingIds.has(video.id));

                return [...currentVideos, ...newVideos];
            });
            setPage(targetPage);
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
        void loadPage(1, false);

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadPage]);

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
                        onPress={() => void loadPage(1, false)}
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
                keyExtractor={(video) => video.id}
                contentContainerStyle={videos.length === 0 ? styles.emptyList : styles.videoList}
                refreshing={isRefreshing}
                onRefresh={() => void loadPage(1, true)}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (hasMore && !isLoadingMore && !requestControllerRef.current) {
                        void loadPage(page + 1, false);
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
                    <FavoriteVideoCard
                        video={item}
                        onPress={() => onVideoPress(item)}
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
    videoCard: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        elevation: 1,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: spacing.xs,
    },
    videoCardPressed: {
        opacity: 0.8,
    },
    coverContainer: {
        width: 132,
        aspectRatio: 16 / 10,
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.background,
    },
    cover: {
        width: '100%',
        height: '100%',
    },
    durationBadge: {
        position: 'absolute',
        right: spacing.xs,
        bottom: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.68)',
    },
    durationText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    videoInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    videoTitle: {
        color: colors.textPrimary,
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
        width: 22,
        height: 22,
        marginRight: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: colors.background,
    },
    authorName: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 12,
    },
    favoriteTime: {
        marginTop: spacing.xs,
        color: colors.textMuted,
        fontSize: 11,
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
