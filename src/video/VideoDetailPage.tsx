import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

import { getLoginCookie } from '@/auth/authCookie';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { VideoFollowingItem } from '@/types/following';
import {
    fetchVideoPlayback,
    type VideoPlayback,
    VideoPlaybackError,
} from './fetchVideoPlayback';

type Props = {
    video: VideoFollowingItem;
    onBack: () => void;
};

type PlayerProps = {
    playback: VideoPlayback;
    title: string;
    onPlaybackError: () => void;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof VideoPlaybackError) {
        return error.message;
    }

    return '获取播放地址失败,请稍后重试';
}

function VideoPlayer({ playback, title, onPlaybackError }: PlayerProps) {
    const player = useVideoPlayer(
        {
            uri: playback.url,
            headers: playback.headers,
            contentType: 'progressive',
            metadata: {
                title,
            },
        },
        (createdPlayer) => {
            createdPlayer.play();
        },
    );
    const { status } = useEvent(player, 'statusChange', {
        status: player.status,
    });

    useEffect(() => {
        if (status === 'error') {
            onPlaybackError();
        }
    }, [onPlaybackError, status]);

    return (
        <VideoView
            player={player}
            style={styles.player}
            nativeControls
            contentFit='contain'
            fullscreenOptions={{
                enable: true,
                orientation: 'landscape',
            }}
        />
    );
}

export default function VideoDetailPage({ video, onBack }: Props) {
    const [playback, setPlayback] = useState<VideoPlayback | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => {
            subscription.remove();
        };
    }, [onBack]);

    useEffect(() => {
        const controller = new AbortController();

        const loadPlayback = async () => {
            setPlayback(null);
            setErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new VideoPlaybackError('登录信息不存在,请重新登录');
                }

                const nextPlayback = await fetchVideoPlayback(
                    video.bvid,
                    cookie,
                    controller.signal,
                );
                setPlayback(nextPlayback);
            } catch (error) {
                if (!isAbortError(error)) {
                    setErrorMessage(getErrorMessage(error));
                }
            }
        };

        void loadPlayback();

        return () => {
            controller.abort();
        };
    }, [reloadKey, video.bvid]);

    return (
        <View style={styles.page}>
            <View style={styles.header}>
                <Pressable accessibilityRole='button' onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>返回</Text>
                </Pressable>
                <Text numberOfLines={1} style={styles.headerTitle}>视频详情</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.playerContainer}>
                    {playback ? (
                        <VideoPlayer
                            playback={playback}
                            title={video.title}
                            onPlaybackError={() => {
                                setPlayback(null);
                                setErrorMessage('视频流播放失败,请重新加载');
                            }}
                        />
                    ) : errorMessage ? (
                        <View style={styles.playerStatus}>
                            <Text style={styles.errorText}>{errorMessage}</Text>
                            <Pressable
                                accessibilityRole='button'
                                onPress={() => setReloadKey((value) => value + 1)}
                                style={styles.retryButton}
                            >
                                <Text style={styles.retryButtonText}>重新加载</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.playerStatus}>
                            <ActivityIndicator color={colors.primary} size='large' />
                            <Text style={styles.loadingText}>正在获取播放地址...</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.title}>{video.title}</Text>
                <Text style={styles.author}>{video.author.name}</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
    },
    backButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
    },
    backButtonText: {
        color: colors.primary,
        fontSize: 16,
    },
    headerTitle: {
        flex: 1,
        marginHorizontal: spacing.md,
        color: colors.textPrimary,
        fontSize: 17,
        fontWeight: '600',
    },
    content: {
        paddingBottom: spacing.xl,
    },
    playerContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    player: {
        width: '100%',
        height: '100%',
    },
    playerStatus: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    loadingText: {
        marginTop: spacing.sm,
        color: '#fff',
        fontSize: 14,
    },
    errorText: {
        color: '#fff',
        fontSize: 14,
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
    title: {
        marginTop: spacing.lg,
        marginHorizontal: spacing.lg,
        color: colors.textPrimary,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
    },
    author: {
        marginTop: spacing.md,
        marginHorizontal: spacing.lg,
        color: colors.textSecondary,
        fontSize: 15,
    },
});
