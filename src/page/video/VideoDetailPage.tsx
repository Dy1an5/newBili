import { useEffect, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { VideoPlaybackTarget } from '@/types/video';
import {
    fetchVideoParts,
    fetchVideoPlayback,
    type VideoPart,
    type VideoPlayback,
    VideoPlaybackError,
} from '@/page/video/fetchVideoPlayback';

type Props = {
    target: VideoPlaybackTarget;
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

function formatDuration(durationSeconds: number): string {
    if (durationSeconds <= 0) {
        return '';
    }

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds]
            .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
            .join(':');
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

export default function VideoDetailPage({ target, onBack }: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [parts, setParts] = useState<VideoPart[]>([]);
    const [selectedCid, setSelectedCid] = useState<number | null>(null);
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

        const loadParts = async () => {
            setParts([]);
            setSelectedCid(null);
            setPlayback(null);
            setErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new VideoPlaybackError('登录信息不存在,请重新登录');
                }

                const nextParts = await fetchVideoParts(
                    target.bvid,
                    cookie,
                    controller.signal,
                );
                const initialPart = target.initialCid === undefined
                    ? undefined
                    : nextParts.find((part) => part.cid === target.initialCid);

                setParts(nextParts);
                setSelectedCid(initialPart?.cid ?? nextParts[0].cid);
            } catch (error) {
                if (!isAbortError(error)) {
                    setErrorMessage(getErrorMessage(error));
                }
            }
        };

        void loadParts();

        return () => {
            controller.abort();
        };
    }, [reloadKey, target.bvid, target.initialCid]);

    useEffect(() => {
        if (selectedCid === null) {
            return;
        }

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
                    target.bvid,
                    selectedCid,
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
    }, [selectedCid, target.bvid]);

    const selectedPartIndex = parts.findIndex((part) => part.cid === selectedCid);
    const selectedPart = selectedPartIndex >= 0 ? parts[selectedPartIndex] : null;

    return (
        <View style={styles.page}>
            <View style={styles.header}>
                <Pressable accessibilityRole='button' onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>返回</Text>
                </Pressable>
                <Text numberOfLines={1} style={styles.headerTitle}>视频详情</Text>
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
            >
                <View style={styles.playerContainer}>
                    {playback ? (
                        <VideoPlayer
                            playback={playback}
                            title={target.title}
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

                <Text style={styles.title}>{target.title}</Text>
                {target.authorName ? (
                    <Text style={styles.author}>{target.authorName}</Text>
                ) : null}

                {parts.length > 1 ? (
                    <View style={styles.partsSection}>
                        <View style={styles.partsHeader}>
                            <Text style={styles.partsHeading}>视频选集</Text>
                            <Text numberOfLines={1} style={styles.partsSummary}>
                                {selectedPart
                                    ? `正在播放:P${selectedPart.page} ${selectedPart.title}`
                                    : `共${parts.length}P`}
                            </Text>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.partsList}
                        >
                            {parts.map((part) => {
                                const isSelected = part.cid === selectedCid;
                                const duration = formatDuration(part.durationSeconds);

                                return (
                                    <Pressable
                                        key={part.cid}
                                        accessibilityRole='button'
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={`P${part.page} ${part.title}`}
                                        onPress={() => {
                                            if (!isSelected) {
                                                setSelectedCid(part.cid);
                                            }
                                        }}
                                        style={({ pressed }) => [
                                            styles.partButton,
                                            isSelected && styles.partButtonSelected,
                                            pressed && styles.partButtonPressed,
                                        ]}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.partTitle,
                                                isSelected && styles.partTitleSelected,
                                            ]}
                                        >
                                            P{part.page} {part.title}
                                        </Text>
                                        {duration ? (
                                            <Text
                                                style={[
                                                    styles.partDuration,
                                                    isSelected && styles.partDurationSelected,
                                                ]}
                                            >
                                                {duration}
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : null}
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
        backgroundColor: colors.background,
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
        color: colors.textOnMedia,
        fontSize: 14,
    },
    errorText: {
        color: colors.textOnMedia,
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
        color: colors.textOnPrimary,
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
    partsSection: {
        marginTop: spacing.xl,
    },
    partsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    partsHeading: {
        color: colors.textPrimary,
        fontSize: 17,
        fontWeight: '700',
    },
    partsSummary: {
        flex: 1,
        marginLeft: spacing.md,
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'right',
    },
    partsList: {
        paddingHorizontal: spacing.lg,
    },
    partButton: {
        width: 156,
        minHeight: 64,
        justifyContent: 'center',
        marginRight: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.outline,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    partButtonSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    partButtonPressed: {
        opacity: 0.76,
    },
    partTitle: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    partTitleSelected: {
        color: colors.primary,
    },
    partDuration: {
        marginTop: spacing.xs,
        color: colors.textMuted,
        fontSize: 12,
    },
    partDurationSelected: {
        color: colors.primary,
    },
});
