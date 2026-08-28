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
import FollowingVideoCard from '@/components/following/FollowingVideoCard';
import {
    fetchFollowingVideoPage,
    FollowingRequestError,
    type FollowingVideoPage,
} from '@/page/following/fetchFollowingVideos';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { FollowingVideo } from '@/types/following';
import type { VideoPlaybackTarget } from '@/types/video';
import { createVideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';

type Diagnostics = FollowingVideoPage['diagnostics'];

type Props = {
    onVideoPress: (target: VideoPlaybackTarget) => void;
};

function formatPublishedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '时间未知';
    }

    const publishedDate = new Date(timestamp * 1000);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - publishedDate.getTime()) / 1000);

    if (elapsedSeconds < 60) {
        return '刚刚';
    }

    if (elapsedSeconds < 3600) {
        return `${Math.floor(elapsedSeconds / 60)}分钟前`;
    }

    if (elapsedSeconds < 86400) {
        return `${Math.floor(elapsedSeconds / 3600)}小时前`;
    }

    const month = publishedDate.getMonth() + 1;
    const day = publishedDate.getDate();
    const hour = String(publishedDate.getHours()).padStart(2, '0');
    const minute = String(publishedDate.getMinutes()).padStart(2, '0');

    return `${month}-${day} ${hour}:${minute}`;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof FollowingRequestError) {
        return error.message;
    }

    return '加载动态失败,请稍后重试';
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

export default function FollowingPage({ onVideoPress }: Props) {
    const [videos, setVideos] = useState<FollowingVideo[]>([]);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    const loadFollowingVideos = useCallback(async (refreshing: boolean) => {
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
                throw new FollowingRequestError('登录信息不存在,请重新登录');
            }

            const page = await fetchFollowingVideoPage(cookie, undefined, controller.signal);
            setVideos(page.videos);
            setDiagnostics(page.diagnostics);
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
        void loadFollowingVideos(false);

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadFollowingVideos]);

    if (isLoading && videos.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size='large' />
                <Text style={styles.statusText}>正在加载动态...</Text>
            </View>
        );
    }

    if (errorMessage && videos.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                    style={styles.retryButton}
                    onPress={() => void loadFollowingVideos(false)}
                >
                    <Text style={styles.retryButtonText}>重新加载</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <FlatList
            style={styles.page}
            data={videos}
            keyExtractor={(video) => video.dynamicId}
            renderItem={({ item: video }) => (
                <FollowingVideoCard
                    title={video.title}
                    coverUrl={video.coverUrl}
                    avatarUrl={video.author.avatarUrl}
                    authorName={video.author.name}
                    publishedTimeText={formatPublishedTime(video.publishedAt)}
                    onPress={() => onVideoPress(createVideoPlaybackTarget(video))}
                />
            )}
            contentContainerStyle={videos.length === 0 ? styles.emptyList : styles.list}
            ListEmptyComponent={
                <View style={styles.emptyMessage}>
                    <Text style={styles.statusText}>暂时没有识别到视频动态</Text>
                    {diagnostics ? (
                        <Text selectable style={styles.diagnosticText}>
                            原始条数:{diagnostics.rawItemCount}{'\n'}
                            item.type:{diagnostics.itemTypes.join(',') || '无'}{'\n'}
                            major.type:{diagnostics.majorTypes.join(',') || '无'}
                        </Text>
                    ) : null}
                </View>
            }
            ListHeaderComponent={
                errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null
            }
            refreshing={isRefreshing}
            onRefresh={() => void loadFollowingVideos(true)}
        />
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
        backgroundColor: colors.background,
    },
    list: {
        paddingVertical: spacing.md,
        backgroundColor: colors.background,
    },
    emptyList: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background,
    },
    statusText: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
        fontSize: 14,
    },
    emptyMessage: {
        alignItems: 'center',
    },
    diagnosticText: {
        marginTop: spacing.md,
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    errorText: {
        color: colors.textPrimary,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        color: colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
