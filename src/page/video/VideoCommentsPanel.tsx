import {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    FlatList,
    type ListRenderItemInfo,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    type TextLayoutEvent,
    View,
    type ViewToken,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppLoadingIndicator from '@/components/AppLoadingIndicator';
import AppRefreshControl from '@/components/AppRefreshControl';
import BilibiliImage from '@/components/BilibiliImage';
import FullscreenImageViewer from '@/components/FullscreenImageViewer';
import UserAvatar from '@/components/UserAvatar';
import {
    fetchVideoCommentPage,
    fetchVideoCommentReplyPage,
    fetchVideoCommentReplyPreview,
    type CommentSubject,
    type VideoComment,
    VideoCommentsError,
} from '@/page/video/fetchVideoComments';
import type {
    CollapsiblePageScrollHandle,
    CollapsiblePageScrollProps,
} from '@/page/video/collapsibleVideoScroll';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = CollapsiblePageScrollProps & {
    active: boolean;
    contentHeader?: ReactNode;
    onTotalCountChange: (count: number | null) => void;
    subject: CommentSubject | null;
    subjectUnavailableMessage?: string;
};

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

const MAX_COMMENT_PICTURE_COUNT = 9;
const REPLY_PREVIEW_IDLE_DELAY_MS = 150;
const MAX_REPLY_PREVIEW_CONCURRENCY = 2;
const EMPTY_REPLIES: VideoComment[] = [];
const COLLAPSED_REPLY_LINE_COUNT = 2;

type ReplyThreadState = {
    comments: VideoComment[];
    currentPage: number;
    hasMore: boolean;
    isExpanded: boolean;
    isLoading: boolean;
    errorMessage: string | null;
};

type PicturePreviewState = {
    imageUrls: string[];
    initialIndex: number;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof VideoCommentsError) {
        return error.message;
    }

    return '获取评论失败,请稍后重试';
}

function formatCount(count: number): string {
    if (count >= 10000) {
        const value = count / 10000;
        return `${value >= 100 ? Math.floor(value) : value.toFixed(1).replace(/\.0$/, '')}万`;
    }

    return String(count);
}

function formatCreatedAt(createdAt: number): string {
    if (createdAt <= 0) {
        return '';
    }

    const date = new Date(createdAt * 1000);
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const dateText = date.getFullYear() === now.getFullYear()
        ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return `${dateText} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function appendUniqueComments(
    currentComments: VideoComment[],
    nextComments: VideoComment[],
): VideoComment[] {
    const existingIds = new Set(currentComments.map((comment) => comment.id));

    return [
        ...currentComments,
        ...nextComments.filter((comment) => !existingIds.has(comment.id)),
    ];
}

type CommentPicturesProps = {
    comment: VideoComment;
    compact?: boolean;
    onOpen: (imageUrls: string[], initialIndex: number) => void;
};

const CommentPictures = memo(function CommentPictures({
    comment,
    compact = false,
    onOpen,
}: CommentPicturesProps) {
    const displayedPictures = useMemo(
        () => comment.pictures.slice(0, MAX_COMMENT_PICTURE_COUNT),
        [comment.pictures],
    );
    const imageUrls = useMemo(
        () => displayedPictures.map((picture) => picture.url),
        [displayedPictures],
    );

    if (displayedPictures.length === 0) {
        return null;
    }

    const pictureSize = compact ? 72 : 108;

    return (
        <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
                styles.pictureList,
                compact && styles.replyPictureList,
            ]}
        >
            {displayedPictures.map((picture, index) => (
                <Pressable
                    accessibilityLabel={`查看图片,第${index + 1}张,共${displayedPictures.length}张`}
                    accessibilityRole='button'
                    key={`${picture.url}:${index}`}
                    onPress={() => onOpen(imageUrls, index)}
                    style={({ pressed }) => [
                        styles.commentPictureButton,
                        compact && styles.replyPictureButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <BilibiliImage
                        contentFit='cover'
                        style={styles.commentPicture}
                        thumbnailSize={{
                            width: pictureSize,
                            height: pictureSize,
                        }}
                        transition={0}
                        uri={picture.url}
                    />
                </Pressable>
            ))}
        </ScrollView>
    );
});

type CommentCardProps = {
    comment: VideoComment;
    displayedReplies: VideoComment[];
    hasMoreReplies: boolean;
    isExpanded: boolean;
    isLoadingPreview: boolean;
    isLoadingReplies: boolean;
    replyErrorMessage: string | null;
    onLoadMore: (comment: VideoComment) => void;
    onOpenPictures: (imageUrls: string[], initialIndex: number) => void;
};

const CommentCard = memo(function CommentCard({
    comment,
    displayedReplies,
    hasMoreReplies,
    isExpanded,
    isLoadingPreview,
    isLoadingReplies,
    replyErrorMessage,
    onLoadMore,
    onOpenPictures,
}: CommentCardProps) {
    const createdAt = formatCreatedAt(comment.createdAt);
    const [isPreviewTextExpanded, setIsPreviewTextExpanded] = useState(false);
    const [overflowingReplyIds, setOverflowingReplyIds] = useState<Set<string>>(
        () => new Set(),
    );
    const isLoading = isLoadingPreview || isLoadingReplies;
    const renderedReplies = isExpanded
        ? displayedReplies
        : displayedReplies.slice(0, 2);
    const shouldShowLoadMore = isExpanded
        ? hasMoreReplies
        : comment.replyCount > renderedReplies.length;
    const hasOverflowingReply = renderedReplies.some((reply) => (
        overflowingReplyIds.has(reply.id)
    ));
    const shouldShowPreviewToggle = !isExpanded
        && !shouldShowLoadMore
        && hasOverflowingReply;

    const handleReplyTextLayout = useCallback((
        replyId: string,
        event: TextLayoutEvent,
    ) => {
        const nextIsOverflowing =
            event.nativeEvent.lines.length > COLLAPSED_REPLY_LINE_COUNT;

        setOverflowingReplyIds((currentIds) => {
            const currentlyOverflowing = currentIds.has(replyId);

            if (currentlyOverflowing === nextIsOverflowing) {
                return currentIds;
            }

            const nextIds = new Set(currentIds);

            if (nextIsOverflowing) {
                nextIds.add(replyId);
            } else {
                nextIds.delete(replyId);
            }

            return nextIds;
        });
    }, []);

    return (
        <View
            accessibilityLabel={`${comment.author.name}的评论`}
            style={styles.commentCard}
        >
            <UserAvatar
                name={comment.author.name}
                size={36}
                style={styles.commentAvatar}
                uri={comment.author.avatarUrl}
                transition={0}
            />

            <View style={styles.commentBody}>
                <View style={styles.authorLine}>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.commentAuthor,
                            comment.isUpAuthor && styles.upAuthorName,
                        ]}
                    >
                        {comment.author.name}
                    </Text>
                    {comment.isUpAuthor ? (
                        <Text style={styles.badge}>UP</Text>
                    ) : null}
                    {comment.isPinned ? (
                        <Text style={styles.pinnedBadge}>置顶</Text>
                    ) : null}
                </View>

                {createdAt || comment.location ? (
                    <Text style={styles.commentMeta}>
                        {[createdAt, comment.location].filter(Boolean).join(' · ')}
                    </Text>
                ) : null}

                {comment.message ? (
                    <Text style={styles.commentMessage}>{comment.message}</Text>
                ) : null}

                <CommentPictures
                    comment={comment}
                    onOpen={onOpenPictures}
                />

                <View style={styles.commentStats}>
                    <Text style={styles.commentStat}>赞 {formatCount(comment.likeCount)}</Text>
                    {comment.replyCount > 0 ? (
                        <Text style={styles.commentStat}>
                            {formatCount(comment.replyCount)}条回复
                        </Text>
                    ) : null}
                </View>

                {comment.replyCount > 0 ? (
                    <View style={styles.replyPreview}>
                        {renderedReplies.map((reply) => (
                            <View key={reply.id} style={styles.replyItem}>
                                <Text
                                    numberOfLines={
                                        isExpanded || isPreviewTextExpanded
                                            ? undefined
                                            : COLLAPSED_REPLY_LINE_COUNT
                                    }
                                    style={styles.replyPreviewText}
                                >
                                    <Text
                                        style={[
                                            styles.replyPreviewAuthor,
                                            reply.isUpAuthor && styles.upAuthorName,
                                        ]}
                                    >
                                        {reply.author.name}{reply.isUpAuthor ? ' [UP]' : ''}:
                                    </Text>
                                    {reply.message ? ` ${reply.message}` : ''}
                                </Text>
                                {!isExpanded ? (
                                    <Text
                                        accessibilityElementsHidden
                                        importantForAccessibility='no-hide-descendants'
                                        onTextLayout={(event) => {
                                            handleReplyTextLayout(reply.id, event);
                                        }}
                                        pointerEvents='none'
                                        style={[
                                            styles.replyPreviewText,
                                            styles.replyTextMeasurement,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.replyPreviewAuthor,
                                                reply.isUpAuthor && styles.upAuthorName,
                                            ]}
                                        >
                                            {reply.author.name}{reply.isUpAuthor ? ' [UP]' : ''}:
                                        </Text>
                                        {reply.message ? ` ${reply.message}` : ''}
                                    </Text>
                                ) : null}
                                <CommentPictures
                                    comment={reply}
                                    compact
                                    onOpen={onOpenPictures}
                                />
                            </View>
                        ))}
                        {replyErrorMessage ? (
                            <Text style={styles.replyErrorText}>
                                {replyErrorMessage}
                            </Text>
                        ) : null}
                        {isLoading || shouldShowLoadMore ? (
                            <Pressable
                                accessibilityRole='button'
                                disabled={isLoading}
                                onPress={() => onLoadMore(comment)}
                                style={({ pressed }) => [
                                    styles.loadMoreButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.showAllReplies}>
                                    {isLoading
                                        ? '正在加载回复...'
                                        : replyErrorMessage
                                            ? '重试'
                                            : '加载更多'}
                                </Text>
                            </Pressable>
                        ) : null}
                        {shouldShowPreviewToggle ? (
                            <Pressable
                                accessibilityLabel={
                                    isPreviewTextExpanded
                                        ? '收起回复全文'
                                        : '展开回复全文'
                                }
                                accessibilityRole='button'
                                onPress={() => {
                                    setIsPreviewTextExpanded((value) => !value);
                                }}
                                style={({ pressed }) => [
                                    styles.loadMoreButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.showAllReplies}>
                                    {isPreviewTextExpanded ? '收起' : '展开全文'}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
            </View>
        </View>
    );
});

const VideoCommentsPanel = forwardRef<CollapsiblePageScrollHandle, Props>(
function VideoCommentsPanel({
    active,
    contentHeader,
    headerSpacerHeight,
    minimumContentHeight,
    onScroll,
    onScrollEnd,
    onTotalCountChange,
    subject,
    subjectUnavailableMessage,
}, ref) {
    const safeAreaInsets = useSafeAreaInsets();
    const listRef = useRef<FlatList<VideoComment>>(null);
    const statusScrollRef = useRef<ScrollView>(null);
    const scrollOffsetRef = useRef(0);
    const requestControllerRef = useRef<AbortController | null>(null);
    const [comments, setComments] = useState<VideoComment[]>([]);
    const [status, setStatus] = useState<LoadStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [nextOffset, setNextOffset] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const previewRequestControllersRef = useRef(
        new Map<string, AbortController>(),
    );
    const replyPageRequestControllersRef = useRef(
        new Map<string, AbortController>(),
    );
    const previewIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isListScrollingRef = useRef(false);
    const pendingLoadMoreRef = useRef(false);
    const visibleCommentsRef = useRef<VideoComment[]>([]);
    const scheduleReplyPreviewsRef = useRef<() => void>(() => undefined);
    const completedPreviewIdsRef = useRef(new Set<string>());
    const [loadingPreviewIds, setLoadingPreviewIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [replyThreads, setReplyThreads] = useState<
        Record<string, ReplyThreadState>
    >({});
    const replyThreadsRef = useRef(replyThreads);
    const [picturePreview, setPicturePreview] = useState<
        PicturePreviewState | null
    >(null);

    replyThreadsRef.current = replyThreads;

    useImperativeHandle(ref, () => ({
        scrollToOffset: (offset, animated = false) => {
            scrollOffsetRef.current = offset;

            if (status === 'success') {
                listRef.current?.scrollToOffset({ offset, animated });
                return;
            }

            statusScrollRef.current?.scrollTo({ y: offset, animated });
        },
    }), [status]);

    useEffect(() => {
        const offset = scrollOffsetRef.current;

        if (status === 'success') {
            listRef.current?.scrollToOffset({ offset, animated: false });
        } else {
            statusScrollRef.current?.scrollTo({ y: offset, animated: false });
        }
    }, [status]);

    const openPicturePreview = useCallback((
        imageUrls: string[],
        initialIndex: number,
    ) => {
        setPicturePreview({ imageUrls, initialIndex });
    }, []);

    const closePicturePreview = useCallback(() => {
        setPicturePreview(null);
    }, []);

    const clearReplyPreviewTimer = useCallback(() => {
        if (previewIdleTimerRef.current !== null) {
            clearTimeout(previewIdleTimerRef.current);
            previewIdleTimerRef.current = null;
        }
    }, []);

    const abortReplyRequests = useCallback(() => {
        clearReplyPreviewTimer();
        previewRequestControllersRef.current.forEach((controller) => {
            controller.abort();
        });
        replyPageRequestControllersRef.current.forEach((controller) => {
            controller.abort();
        });
        previewRequestControllersRef.current.clear();
        replyPageRequestControllersRef.current.clear();
        completedPreviewIdsRef.current.clear();
    }, [clearReplyPreviewTimer]);

    const loadInitialPage = useCallback(async (refresh: boolean) => {
        if (!subject || requestControllerRef.current) {
            return;
        }

        if (refresh) {
            abortReplyRequests();
            setLoadingPreviewIds(new Set());
            setReplyThreads({});
        }

        const controller = new AbortController();
        requestControllerRef.current = controller;

        if (refresh) {
            setIsRefreshing(true);
        } else {
            setStatus('loading');
        }
        setErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new VideoCommentsError('登录信息不存在,请重新登录');
            }

            const result = await fetchVideoCommentPage(
                subject,
                cookie,
                null,
                controller.signal,
            );

            if (
                controller.signal.aborted
                || requestControllerRef.current !== controller
            ) {
                return;
            }

            setComments(result.comments);
            setNextOffset(result.nextOffset);
            setHasMore(result.hasMore);
            setStatus('success');
            onTotalCountChange(result.totalCount);
        } catch (error) {
            if (
                !isAbortError(error)
                && requestControllerRef.current === controller
            ) {
                setErrorMessage(getErrorMessage(error));
                setStatus((currentStatus) => refresh ? currentStatus : 'error');
            }
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
                setIsRefreshing(false);
            }
        }
    }, [abortReplyRequests, onTotalCountChange, subject]);

    const loadMore = useCallback(async () => {
        if (!subject || !nextOffset || !hasMore || requestControllerRef.current) {
            return;
        }

        const controller = new AbortController();
        requestControllerRef.current = controller;
        setIsLoadingMore(true);
        setErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new VideoCommentsError('登录信息不存在,请重新登录');
            }

            const result = await fetchVideoCommentPage(
                subject,
                cookie,
                nextOffset,
                controller.signal,
            );

            if (
                controller.signal.aborted
                || requestControllerRef.current !== controller
            ) {
                return;
            }

            setComments((currentComments) => appendUniqueComments(
                currentComments,
                result.comments,
            ));
            setNextOffset(result.nextOffset);
            setHasMore(result.hasMore);
            onTotalCountChange(result.totalCount);
        } catch (error) {
            if (
                !isAbortError(error)
                && requestControllerRef.current === controller
            ) {
                setErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
                setIsLoadingMore(false);
            }
        }
    }, [hasMore, nextOffset, onTotalCountChange, subject]);

    const loadReplyPreview = useCallback(async (comment: VideoComment) => {
        if (!subject || comment.replyCount <= 0) {
            return;
        }

        const requiredPreviewCount = Math.min(2, comment.replyCount);

        if (
            comment.previewReplies.length >= requiredPreviewCount
            || completedPreviewIdsRef.current.has(comment.id)
            || previewRequestControllersRef.current.has(comment.id)
            || replyPageRequestControllersRef.current.has(comment.id)
            || previewRequestControllersRef.current.size
                >= MAX_REPLY_PREVIEW_CONCURRENCY
        ) {
            return;
        }

        const controller = new AbortController();
        previewRequestControllersRef.current.set(comment.id, controller);
        setLoadingPreviewIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.add(comment.id);
            return nextIds;
        });

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new VideoCommentsError('登录信息不存在,请重新登录');
            }

            const result = await fetchVideoCommentReplyPreview(
                subject,
                comment.id,
                cookie,
                controller.signal,
            );

            if (
                controller.signal.aborted
                || previewRequestControllersRef.current.get(comment.id) !== controller
            ) {
                return;
            }

            setComments((currentComments) => currentComments.map((currentComment) => (
                currentComment.id === comment.id
                    ? {
                        ...currentComment,
                        previewReplies: result.comments.slice(0, 2),
                    }
                    : currentComment
            )));
        } catch (error) {
            if (!isAbortError(error)) {
                completedPreviewIdsRef.current.add(comment.id);
            }
        } finally {
            if (previewRequestControllersRef.current.get(comment.id) === controller) {
                previewRequestControllersRef.current.delete(comment.id);
                completedPreviewIdsRef.current.add(comment.id);
                setLoadingPreviewIds((currentIds) => {
                    const nextIds = new Set(currentIds);
                    nextIds.delete(comment.id);
                    return nextIds;
                });
            }
        }
    }, [subject]);

    const loadVisibleReplyPreviews = useCallback(() => {
        if (!active || isListScrollingRef.current) {
            return;
        }

        const availableSlots = Math.max(
            0,
            MAX_REPLY_PREVIEW_CONCURRENCY
                - previewRequestControllersRef.current.size,
        );

        if (availableSlots === 0) {
            return;
        }

        const candidates = visibleCommentsRef.current.filter((comment) => {
            const requiredPreviewCount = Math.min(2, comment.replyCount);

            return requiredPreviewCount > comment.previewReplies.length
                && !completedPreviewIdsRef.current.has(comment.id)
                && !previewRequestControllersRef.current.has(comment.id)
                && !replyPageRequestControllersRef.current.has(comment.id)
                && !(replyThreads[comment.id]?.isExpanded ?? false);
        });

        candidates.slice(0, availableSlots).forEach((comment) => {
            void loadReplyPreview(comment);
        });
    }, [active, loadReplyPreview, replyThreads]);

    const scheduleVisibleReplyPreviews = useCallback(() => {
        clearReplyPreviewTimer();

        if (!active || isListScrollingRef.current) {
            return;
        }

        previewIdleTimerRef.current = setTimeout(() => {
            previewIdleTimerRef.current = null;

            if (pendingLoadMoreRef.current) {
                pendingLoadMoreRef.current = false;
                void loadMore();
            }

            loadVisibleReplyPreviews();
        }, REPLY_PREVIEW_IDLE_DELAY_MS);
    }, [active, clearReplyPreviewTimer, loadMore, loadVisibleReplyPreviews]);

    scheduleReplyPreviewsRef.current = scheduleVisibleReplyPreviews;

    useEffect(() => {
        scheduleVisibleReplyPreviews();
    }, [loadingPreviewIds, scheduleVisibleReplyPreviews]);

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 40,
        minimumViewTime: 100,
    }).current;
    const onViewableItemsChanged = useRef(({
        viewableItems,
    }: {
        viewableItems: ViewToken<VideoComment>[];
    }) => {
        visibleCommentsRef.current = viewableItems.flatMap((viewToken) => (
            viewToken.isViewable && viewToken.item ? [viewToken.item] : []
        ));
        scheduleReplyPreviewsRef.current();
    }).current;

    const handleScrollBegin = useCallback(() => {
        isListScrollingRef.current = true;
        clearReplyPreviewTimer();
        previewRequestControllersRef.current.forEach((controller) => {
            controller.abort();
        });
        previewRequestControllersRef.current.clear();
        setLoadingPreviewIds((currentIds) => (
            currentIds.size === 0 ? currentIds : new Set()
        ));
    }, [clearReplyPreviewTimer]);

    const handleScrollEnd = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        scrollOffsetRef.current = Math.max(
            0,
            event.nativeEvent.contentOffset.y,
        );
        isListScrollingRef.current = false;
        onScrollEnd(event);
        scheduleVisibleReplyPreviews();
    }, [onScrollEnd, scheduleVisibleReplyPreviews]);

    const loadMoreReplies = useCallback(async (comment: VideoComment) => {
        if (!subject || replyPageRequestControllersRef.current.has(comment.id)) {
            return;
        }

        const currentThread = replyThreadsRef.current[comment.id];

        if (currentThread?.isExpanded && !currentThread.hasMore) {
            return;
        }

        const previewController = previewRequestControllersRef.current.get(comment.id);

        if (previewController) {
            previewController.abort();
            previewRequestControllersRef.current.delete(comment.id);
            completedPreviewIdsRef.current.add(comment.id);
            setLoadingPreviewIds((currentIds) => {
                const nextIds = new Set(currentIds);
                nextIds.delete(comment.id);
                return nextIds;
            });
        }

        const page = (currentThread?.currentPage ?? 0) + 1;
        const controller = new AbortController();
        replyPageRequestControllersRef.current.set(comment.id, controller);
        setReplyThreads((currentThreads) => {
            const thread = currentThreads[comment.id];

            return {
                ...currentThreads,
                [comment.id]: {
                    comments: thread?.comments ?? comment.previewReplies.slice(0, 2),
                    currentPage: thread?.currentPage ?? 0,
                    hasMore: thread?.hasMore ?? true,
                    isExpanded: true,
                    isLoading: true,
                    errorMessage: null,
                },
            };
        });

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new VideoCommentsError('登录信息不存在,请重新登录');
            }

            const result = await fetchVideoCommentReplyPage(
                subject,
                comment.id,
                page,
                cookie,
                controller.signal,
            );

            if (
                controller.signal.aborted
                || replyPageRequestControllersRef.current.get(comment.id) !== controller
            ) {
                return;
            }

            setReplyThreads((currentThreads) => {
                const thread = currentThreads[comment.id];
                const previousComments = thread?.comments ?? [];

                return {
                    ...currentThreads,
                    [comment.id]: {
                        comments: page === 1
                            ? result.comments
                            : appendUniqueComments(previousComments, result.comments),
                        currentPage: page,
                        hasMore: result.hasMore,
                        isExpanded: true,
                        isLoading: false,
                        errorMessage: null,
                    },
                };
            });
        } catch (error) {
            if (
                !isAbortError(error)
                && replyPageRequestControllersRef.current.get(comment.id) === controller
            ) {
                setReplyThreads((currentThreads) => {
                    const thread = currentThreads[comment.id];

                    return {
                        ...currentThreads,
                        [comment.id]: {
                            comments: thread?.comments ?? comment.previewReplies.slice(0, 2),
                            currentPage: thread?.currentPage ?? page - 1,
                            hasMore: thread?.hasMore ?? true,
                            isExpanded: true,
                            isLoading: false,
                            errorMessage: getErrorMessage(error),
                        },
                    };
                });
            }
        } finally {
            if (replyPageRequestControllersRef.current.get(comment.id) === controller) {
                replyPageRequestControllersRef.current.delete(comment.id);
            }
        }
    }, [subject]);

    useEffect(() => {
        abortReplyRequests();
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;
        setComments([]);
        setStatus('idle');
        setErrorMessage(null);
        setNextOffset(null);
        setHasMore(true);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        setLoadingPreviewIds(new Set());
        setReplyThreads({});
        setPicturePreview(null);
        visibleCommentsRef.current = [];
        isListScrollingRef.current = false;
        pendingLoadMoreRef.current = false;
        onTotalCountChange(null);
    }, [abortReplyRequests, onTotalCountChange, subject]);

    useEffect(() => {
        if (active && subject && status === 'idle') {
            void loadInitialPage(false);
        }
    }, [active, loadInitialPage, status, subject]);

    useEffect(() => () => {
        abortReplyRequests();
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;
    }, [abortReplyRequests]);

    const renderComment = useCallback(({
        item,
    }: ListRenderItemInfo<VideoComment>) => {
        const thread = replyThreads[item.id];
        const isExpanded = thread?.isExpanded ?? false;
        const displayedReplies = isExpanded
            ? thread?.comments ?? EMPTY_REPLIES
            : item.previewReplies;

        return (
            <CommentCard
                comment={item}
                displayedReplies={displayedReplies}
                hasMoreReplies={thread?.hasMore ?? true}
                isExpanded={isExpanded}
                isLoadingPreview={loadingPreviewIds.has(item.id)}
                isLoadingReplies={thread?.isLoading ?? false}
                onLoadMore={loadMoreReplies}
                onOpenPictures={openPicturePreview}
                replyErrorMessage={thread?.errorMessage ?? null}
            />
        );
    }, [
        loadMoreReplies,
        loadingPreviewIds,
        openPicturePreview,
        replyThreads,
    ]);

    if (!subject || status === 'idle' || status === 'loading') {
        return (
            <Animated.ScrollView
                ref={statusScrollRef}
                contentOffset={{ x: 0, y: scrollOffsetRef.current }}
                contentContainerStyle={[
                    styles.statusContent,
                    {
                        minHeight: minimumContentHeight,
                        paddingTop: headerSpacerHeight,
                    },
                ]}
                onMomentumScrollEnd={handleScrollEnd}
                onScroll={onScroll}
                onScrollBeginDrag={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                scrollEventThrottle={16}
                style={styles.panel}
            >
                {contentHeader}
                <View style={styles.centeredStatus}>
                    {subject || !subjectUnavailableMessage ? (
                        <AppLoadingIndicator />
                    ) : null}
                    <Text style={styles.statusText}>
                        {subject
                            ? '正在获取评论...'
                            : subjectUnavailableMessage ?? '正在获取评论信息...'}
                    </Text>
                </View>
            </Animated.ScrollView>
        );
    }

    if (status === 'error') {
        return (
            <Animated.ScrollView
                ref={statusScrollRef}
                contentOffset={{ x: 0, y: scrollOffsetRef.current }}
                contentContainerStyle={[
                    styles.statusContent,
                    {
                        minHeight: minimumContentHeight,
                        paddingTop: headerSpacerHeight,
                    },
                ]}
                onMomentumScrollEnd={handleScrollEnd}
                onScroll={onScroll}
                onScrollBeginDrag={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                scrollEventThrottle={16}
                style={styles.panel}
            >
                {contentHeader}
                <View style={styles.centeredStatus}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <AppButton
                        onPress={() => void loadInitialPage(false)}
                        style={styles.retryButton}
                        title='重新加载'
                    />
                </View>
            </Animated.ScrollView>
        );
    }

    return (
        <View style={styles.panel}>
            <Animated.FlatList
                ref={listRef}
                contentOffset={{ x: 0, y: scrollOffsetRef.current }}
                data={comments}
                initialNumToRender={5}
                keyExtractor={(comment) => comment.id}
                contentContainerStyle={[
                    comments.length === 0 ? styles.emptyList : undefined,
                    {
                        minHeight: minimumContentHeight,
                        paddingTop: headerSpacerHeight,
                        paddingBottom: safeAreaInsets.bottom + spacing.xl,
                    },
                ]}
                ListHeaderComponent={contentHeader || errorMessage ? (
                    <>
                        {contentHeader}
                        {errorMessage ? (
                            <Text style={styles.inlineError}>{errorMessage}</Text>
                        ) : null}
                    </>
                ) : null}
                ListEmptyComponent={(
                    <Text style={styles.emptyText}>暂时没有可显示的评论</Text>
                )}
                ListFooterComponent={isLoadingMore ? (
                    <View style={styles.listFooter}>
                        <AppLoadingIndicator />
                    </View>
                ) : comments.length > 0 && !hasMore ? (
                    <Text style={styles.endText}>没有更多评论了</Text>
                ) : null}
                onEndReached={() => {
                    if (!isLoadingMore) {
                        if (isListScrollingRef.current) {
                            pendingLoadMoreRef.current = true;
                        } else {
                            void loadMore();
                        }
                    }
                }}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={handleScrollBegin}
                onMomentumScrollEnd={handleScrollEnd}
                onScroll={onScroll}
                onScrollBeginDrag={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onViewableItemsChanged={onViewableItemsChanged}
                refreshControl={(
                    <AppRefreshControl
                        onRefresh={() => void loadInitialPage(true)}
                        refreshing={isRefreshing}
                    />
                )}
                maxToRenderPerBatch={5}
                removeClippedSubviews
                renderItem={renderComment}
                updateCellsBatchingPeriod={50}
                windowSize={7}
                scrollEventThrottle={16}
                viewabilityConfig={viewabilityConfig}
            />

            <FullscreenImageViewer
                imageUrls={picturePreview?.imageUrls ?? []}
                initialIndex={picturePreview?.initialIndex ?? 0}
                onClose={closePicturePreview}
                visible={picturePreview !== null}
            />
        </View>
    );
});

export default VideoCommentsPanel;

const styles = StyleSheet.create({
    panel: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    statusContent: {
        flexGrow: 1,
    },
    centeredStatus: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: colors.pageBackground,
    },
    statusText: {
        marginTop: spacing.sm,
        color: colors.secondaryText,
        fontSize: 14,
    },
    errorText: {
        color: colors.primaryText,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: spacing.md,
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    emptyText: {
        padding: spacing.xl,
        color: colors.mutedText,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        color: colors.alertText,
        fontSize: 13,
        lineHeight: 19,
        backgroundColor: colors.surfaceBackground,
    },
    commentCard: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
        backgroundColor: colors.pageBackground,
    },
    pressed: {
        opacity: 0.7,
    },
    commentAvatar: {
        marginRight: spacing.sm,
    },
    commentBody: {
        flex: 1,
        minWidth: 0,
    },
    authorLine: {
        minHeight: 19,
        flexDirection: 'row',
        alignItems: 'center',
    },
    commentAuthor: {
        maxWidth: '70%',
        color: colors.secondaryText,
        fontSize: 13,
        fontWeight: '600',
    },
    upAuthorName: {
        color: colors.upAuthorText,
    },
    badge: {
        marginLeft: spacing.xs,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.sm,
        color: colors.accentForeground,
        backgroundColor: colors.accentBackground,
        fontSize: 10,
        fontWeight: '700',
    },
    pinnedBadge: {
        marginLeft: spacing.xs,
        color: colors.accentForeground,
        fontSize: 11,
        fontWeight: '600',
    },
    commentMeta: {
        marginTop: 2,
        color: colors.mutedText,
        fontSize: 11,
    },
    commentMessage: {
        marginTop: spacing.sm,
        color: colors.primaryText,
        fontSize: 15,
        lineHeight: 23,
    },
    pictureList: {
        paddingTop: spacing.sm,
        paddingRight: spacing.sm,
    },
    replyPictureList: {
        paddingTop: spacing.xs,
    },
    commentPictureButton: {
        width: 108,
        height: 108,
        marginRight: spacing.sm,
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    replyPictureButton: {
        width: 72,
        height: 72,
    },
    commentPicture: {
        width: '100%',
        height: '100%',
    },
    commentStats: {
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    commentStat: {
        marginRight: spacing.lg,
        color: colors.mutedText,
        fontSize: 12,
    },
    replyPreview: {
        marginTop: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    replyItem: {
        position: 'relative',
        marginVertical: 2,
    },
    replyPreviewText: {
        color: colors.secondaryText,
        fontSize: 13,
        lineHeight: 19,
    },
    replyPreviewAuthor: {
        color: colors.accentForeground,
        fontWeight: '600',
    },
    replyTextMeasurement: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        opacity: 0,
    },
    replyErrorText: {
        marginTop: spacing.xs,
        color: colors.alertText,
        fontSize: 12,
        lineHeight: 18,
    },
    loadMoreButton: {
        minHeight: 32,
        alignSelf: 'flex-start',
        justifyContent: 'center',
        paddingRight: spacing.md,
    },
    showAllReplies: {
        color: colors.accentForeground,
        fontSize: 12,
        fontWeight: '600',
    },
    listFooter: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    endText: {
        paddingVertical: spacing.lg,
        color: colors.mutedText,
        fontSize: 12,
        textAlign: 'center',
    },
});
