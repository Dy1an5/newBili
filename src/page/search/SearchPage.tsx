import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    FlatList,
    Keyboard,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppLoadingIndicator from '@/components/AppLoadingIndicator';
import AppText from '@/components/AppText';
import VideoListCard from '@/components/VideoListCard';
import {
    fetchSearchVideoPage,
    SearchRequestError,
    type SearchVideo,
} from '@/page/search/fetchSearch';
import {
    createVideoPlaybackTarget,
    type VideoPlaybackTarget,
} from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { createGetErrorMessage } from '@/tool/errorMessage';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type SearchMode = 'initial' | 'more';

type SearchStackParamList = {
    Search: undefined;
    VideoDetail: {
        target: VideoPlaybackTarget;
    };
};

type SearchNavigation = NativeStackNavigationProp<
    SearchStackParamList,
    'Search'
>;

const getErrorMessage = createGetErrorMessage(
    [SearchRequestError],
    '搜索失败,请稍后重试',
);

function formatPlayCount(value: number): string {
    if (value >= 10000) {
        const count = value / 10000;

        return `${count >= 100 ? Math.floor(count) : count.toFixed(1).replace(/\.0$/, '')}万`;
    }

    return String(value);
}

export default function SearchPage() {
    const navigation = useNavigation<SearchNavigation>();
    const insets = useSafeAreaInsets();
    const controllerRef = useRef<AbortController | null>(null);
    const [query, setQuery] = useState('');
    const [keyword, setKeyword] = useState('');
    const [videos, setVideos] = useState<SearchVideo[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [status, setStatus] = useState<SearchStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [paginationErrorMessage, setPaginationErrorMessage] =
        useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            'keyboardDidShow',
            (event) => setKeyboardHeight(event.endCoordinates.height),
        );
        const hideSubscription = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardHeight(0),
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    useEffect(() => () => {
        controllerRef.current?.abort();
    }, []);

    const search = useCallback(async (
        nextKeyword: string,
        nextPage: number,
        mode: SearchMode,
    ) => {
        controllerRef.current?.abort();

        const controller = new AbortController();
        controllerRef.current = controller;

        if (mode === 'initial') {
            setStatus('loading');
            setErrorMessage(null);
            setPaginationErrorMessage(null);
            setVideos([]);
            setHasMore(false);
            setIsLoadingMore(false);
        } else {
            setIsLoadingMore(true);
            setPaginationErrorMessage(null);
        }

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new SearchRequestError('登录信息已失效,请重新登录');
            }

            const result = await fetchSearchVideoPage(
                nextKeyword,
                nextPage,
                cookie,
                controller.signal,
            );

            if (controller.signal.aborted) {
                return;
            }

            setVideos((current) => {
                if (mode === 'initial') {
                    return result.videos;
                }

                const knownBvids = new Set(current.map((video) => video.bvid));

                return [
                    ...current,
                    ...result.videos.filter((video) => !knownBvids.has(video.bvid)),
                ];
            });
            setCurrentPage(nextPage);
            setHasMore(result.hasMore);
            setStatus('ready');
            setErrorMessage(null);
        } catch (error) {
            if (controller.signal.aborted) {
                return;
            }

            const message = getErrorMessage(error);

            if (mode === 'initial') {
                setStatus('error');
                setErrorMessage(message);
            } else {
                setPaginationErrorMessage(message);
            }
        } finally {
            if (controllerRef.current === controller) {
                setIsLoadingMore(false);
            }
        }
    }, []);

    const handleSubmit = () => {
        const nextKeyword = query.trim();

        if (!nextKeyword) {
            return;
        }

        setKeyword(nextKeyword);
        void search(nextKeyword, 1, 'initial');
    };

    const handleEndReached = () => {
        if (
            status !== 'ready' ||
            !hasMore ||
            isLoadingMore ||
            paginationErrorMessage
        ) {
            return;
        }

        void search(keyword, currentPage + 1, 'more');
    };

    const renderEmpty = () => {
        if (status === 'loading') {
            return <AppLoadingIndicator />;
        }

        if (status === 'error') {
            return (
                <>
                    <AppText color={colors.alertText} style={styles.emptyText} variant='bodySmall'>
                        {errorMessage}
                    </AppText>
                    <AppButton
                        onPress={handleSubmit}
                        style={styles.retryButton}
                        title='重新搜索'
                    />
                </>
            );
        }

        if (status === 'ready') {
            return (
                <AppText color={colors.mutedText} style={styles.emptyText} variant='bodySmall'>
                    没有找到相关视频
                </AppText>
            );
        }

        return (
            <>
                <AppText style={styles.emptyTitle} variant='titleSmall'>
                    搜索 B 站视频
                </AppText>
                <AppText color={colors.mutedText} style={styles.emptyText} variant='bodySmall'>
                    输入关键词, 结果会显示在这里
                </AppText>
            </>
        );
    };

    const canSubmit = query.trim().length > 0;

    const renderVideo = useCallback(({ item }: ListRenderItemInfo<SearchVideo>) => (
        <View style={styles.resultItem}>
            <VideoListCard
                metaText={`${formatPlayCount(item.playCount)}播放`}
                onPress={() => {
                    Keyboard.dismiss();
                    navigation.navigate('VideoDetail', {
                        target: createVideoPlaybackTarget(item),
                    });
                }}
                video={item}
            />
        </View>
    ), [navigation]);

    return (
        <View
            style={[
                styles.page,
                keyboardHeight > 0 && { paddingBottom: keyboardHeight },
            ]}
        >
            <View style={styles.header}>
                <Pressable
                    accessibilityLabel='返回'
                    accessibilityRole='button'
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <MaterialIcons
                        color={colors.primaryText}
                        name='arrow-back'
                        size={24}
                    />
                </Pressable>
                <AppText variant='heading'>搜索</AppText>
            </View>

            <FlatList
                contentContainerStyle={[
                    styles.listContent,
                    videos.length === 0 && styles.emptyList,
                ]}
                data={videos}
                initialNumToRender={8}
                keyboardDismissMode='on-drag'
                keyboardShouldPersistTaps='handled'
                keyExtractor={(video) => video.bvid}
                ListEmptyComponent={renderEmpty()}
                ListFooterComponent={isLoadingMore ? (
                    <AppLoadingIndicator style={styles.footerLoading} />
                ) : paginationErrorMessage ? (
                    <View style={styles.footerError}>
                        <AppText color={colors.alertText} variant='caption'>
                            {paginationErrorMessage}
                        </AppText>
                        <AppButton
                            onPress={() => void search(keyword, currentPage + 1, 'more')}
                            style={styles.footerRetry}
                            title='重试'
                        />
                    </View>
                ) : null}
                maxToRenderPerBatch={8}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
                removeClippedSubviews
                renderItem={renderVideo}
                style={styles.list}
                updateCellsBatchingPeriod={50}
                windowSize={9}
            />

            <View
                style={[
                    styles.composerArea,
                    { paddingBottom: Math.max(insets.bottom, spacing.md) },
                ]}
            >
                <View style={styles.composer}>
                    <TextInput
                        accessibilityLabel='搜索关键词'
                        autoCapitalize='none'
                        autoCorrect={false}
                        blurOnSubmit={false}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSubmit}
                        placeholder='搜索视频'
                        placeholderTextColor={colors.mutedText}
                        returnKeyType='search'
                        selectionColor={colors.accentForeground}
                        style={[typography.body, styles.input]}
                        value={query}
                    />
                    <Pressable
                        accessibilityLabel='搜索'
                        accessibilityRole='button'
                        accessibilityState={{ disabled: !canSubmit }}
                        disabled={!canSubmit}
                        onPress={handleSubmit}
                        style={({ pressed }) => [
                            styles.sendButton,
                            !canSubmit && styles.sendButtonDisabled,
                            pressed && canSubmit && styles.sendButtonPressed,
                        ]}
                    >
                        <MaterialIcons
                            color={colors.accentSolidText}
                            name='arrow-upward'
                            size={22}
                        />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    backButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    resultItem: {
        marginBottom: spacing.md,
    },
    emptyTitle: {
        textAlign: 'center',
    },
    emptyText: {
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    retryButton: {
        alignSelf: 'center',
        marginTop: spacing.md,
    },
    footerLoading: {
        marginVertical: spacing.md,
    },
    footerError: {
        alignItems: 'center',
        marginVertical: spacing.md,
    },
    footerRetry: {
        marginTop: spacing.sm,
    },
    composerArea: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceBorder,
        backgroundColor: colors.pageBackground,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 56,
        paddingLeft: spacing.lg,
        paddingRight: spacing.xs,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceBackground,
    },
    input: {
        flex: 1,
        minHeight: 48,
        paddingVertical: 0,
        color: colors.primaryText,
    },
    sendButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: colors.accentForeground,
    },
    sendButtonDisabled: {
        opacity: 0.38,
    },
    sendButtonPressed: {
        opacity: 0.75,
    },
});
