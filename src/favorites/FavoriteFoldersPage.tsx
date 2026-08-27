import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { FavoriteFolder } from '@/types/favorites';
import {
    fetchFavoriteFolders,
    FavoritesRequestError,
} from './fetchFavorites';

type Props = {
    onFolderPress: (folder: FavoriteFolder) => void;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof FavoritesRequestError) {
        return error.message;
    }

    return '加载收藏夹失败,请稍后重试';
}

export default function FavoriteFoldersPage({ onFolderPress }: Props) {
    const [folders, setFolders] = useState<FavoriteFolder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    const loadFolders = useCallback(async (refreshing: boolean) => {
        requestControllerRef.current?.abort();

        const controller = new AbortController();
        requestControllerRef.current = controller;

        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        setErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FavoritesRequestError('登录信息不存在,请重新登录');
            }

            const nextFolders = await fetchFavoriteFolders(cookie, controller.signal);
            setFolders(nextFolders);
        } catch (error) {
            if (!isAbortError(error)) {
                setErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (requestControllerRef.current === controller) {
                setIsLoading(false);
                setIsRefreshing(false);
                requestControllerRef.current = null;
            }
        }
    }, []);

    useEffect(() => {
        void loadFolders(false);

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadFolders]);

    if (isLoading && folders.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size='large' />
                <Text style={styles.statusText}>正在加载收藏夹...</Text>
            </View>
        );
    }

    if (errorMessage && folders.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                    accessibilityRole='button'
                    onPress={() => void loadFolders(false)}
                    style={styles.retryButton}
                >
                    <Text style={styles.retryButtonText}>重新加载</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>我的收藏夹</Text>
                <Text style={styles.headerSummary}>共{folders.length}个</Text>
            </View>

            <FlatList
                data={folders}
                numColumns={2}
                keyExtractor={(folder) => String(folder.id)}
                columnWrapperStyle={styles.folderRow}
                contentContainerStyle={folders.length === 0 ? styles.emptyList : styles.list}
                refreshing={isRefreshing}
                onRefresh={() => void loadFolders(true)}
                ListHeaderComponent={
                    errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null
                }
                ListEmptyComponent={
                    <Text style={styles.statusText}>暂时没有收藏夹</Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel={`${item.title},${item.mediaCount}个视频`}
                        onPress={() => onFolderPress(item)}
                        style={({ pressed }) => [
                            styles.folderCard,
                            pressed && styles.folderCardPressed,
                        ]}
                    >
                        <Text numberOfLines={3} style={styles.folderTitle}>{item.title}</Text>
                        <View style={styles.folderFooter}>
                            <Text style={styles.folderCount}>{item.mediaCount}个视频</Text>
                            <Text style={styles.folderArrow}>›</Text>
                        </View>
                    </Pressable>
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
    header: {
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    headerTitle: {
        color: colors.textPrimary,
        fontSize: 22,
        fontWeight: '700',
    },
    headerSummary: {
        color: colors.textMuted,
        fontSize: 13,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background,
    },
    list: {
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    emptyList: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    folderRow: {
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
    },
    folderCard: {
        width: '48%',
        minHeight: 144,
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.primary,
        elevation: 2,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: spacing.sm,
    },
    folderCardPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.99 }],
    },
    folderTitle: {
        color: '#fff',
        fontSize: 19,
        lineHeight: 26,
        fontWeight: '700',
    },
    folderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    folderCount: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.92,
    },
    folderArrow: {
        color: '#fff',
        fontSize: 28,
        lineHeight: 28,
    },
    statusText: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
        fontSize: 14,
    },
    errorText: {
        color: colors.textPrimary,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        marginHorizontal: spacing.lg,
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
});
