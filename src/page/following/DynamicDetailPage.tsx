import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import {
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useAnimatedScrollHandler } from 'react-native-reanimated';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import BilibiliImage from '@/components/BilibiliImage';
import FullscreenImageViewer from '@/components/FullscreenImageViewer';
import UserAvatar from '@/components/UserAvatar';
import {
    fetchFollowingPictureDetail,
    FollowingRequestError,
    type FollowingPicture,
} from '@/page/following/fetchFollowing';
import VideoCommentsPanel from '@/page/video/VideoCommentsPanel';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { isRequestCancelled } from '@/tool/requestCancellation';

type Props = {
    initialPicture: FollowingPicture;
};

type DetailStatus = 'loading' | 'success' | 'error';

function getErrorMessage(error: unknown): string {
    if (error instanceof FollowingRequestError) {
        return error.message;
    }

    return '加载动态详情失败,请稍后重试';
}

function formatPublishedTime(timestamp: number): string {
    if (timestamp <= 0) {
        return '时间未知';
    }

    const date = new Date(timestamp * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCommentCount(count: number | null): string {
    if (count === null) {
        return '评论';
    }

    if (count < 10000) {
        return `评论 ${count}`;
    }

    const value = count / 10000;
    const countText = value >= 100
        ? String(Math.floor(value))
        : value.toFixed(1).replace(/\.0$/, '');

    return `评论 ${countText}万`;
}

export default function DynamicDetailPage({ initialPicture }: Props) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [picture, setPicture] = useState(initialPicture);
    const [detailStatus, setDetailStatus] = useState<DetailStatus>('loading');
    const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [commentCount, setCommentCount] = useState<number | null>(
        initialPicture.commentCount,
    );
    const [previewPictureIndex, setPreviewPictureIndex] = useState(0);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const scrollHandler = useAnimatedScrollHandler(() => undefined);
    const handleScrollEnd = useCallback((
        _event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => undefined, []);

    useEffect(() => {
        const controller = new AbortController();

        const loadDetail = async () => {
            setDetailStatus('loading');
            setDetailErrorMessage(null);

            try {
                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new FollowingRequestError('登录信息不存在,请重新登录');
                }

                const nextPicture = await fetchFollowingPictureDetail(
                    initialPicture.dynamicId,
                    cookie,
                    controller.signal,
                );

                if (controller.signal.aborted) {
                    return;
                }

                setPicture(nextPicture);
                if (nextPicture.commentCount !== null) {
                    setCommentCount(nextPicture.commentCount);
                }
                setDetailStatus('success');
            } catch (error) {
                if (!isRequestCancelled(error, controller.signal)) {
                    setDetailErrorMessage(getErrorMessage(error));
                    setDetailStatus('error');
                }
            }
        };

        void loadDetail();

        return () => controller.abort();
    }, [initialPicture.dynamicId, reloadKey]);

    const imageUrls = useMemo(
        () => picture.imageUrls
            .filter((imageUrl) => imageUrl.trim().length > 0)
            .slice(0, 9),
        [picture.imageUrls],
    );
    const pictureColumnCount = imageUrls.length <= 1
        ? 1
        : imageUrls.length === 2 || imageUrls.length === 4
            ? 2
            : 3;
    const contentWidth = Math.max(0, windowWidth - spacing.lg * 2);
    const pictureWidth = Math.max(
        0,
        (contentWidth - spacing.xs * (pictureColumnCount - 1)) /
            pictureColumnCount,
    );
    const subjectUnavailableMessage = detailStatus === 'loading'
        ? undefined
        : '该动态没有返回有效的评论参数';
    const commentSubject = useMemo(() => picture.commentSubject === null
        ? null
        : {
            oid: picture.commentSubject.oid,
            type: picture.commentSubject.type,
        }, [picture.commentSubject?.oid, picture.commentSubject?.type]);

    const detailHeader = (
        <>
            <View style={styles.dynamicContent}>
                <View style={styles.authorRow}>
                    <UserAvatar
                        name={picture.author.name}
                        size={40}
                        style={styles.avatar}
                        uri={picture.author.avatarUrl}
                    />
                    <View style={styles.authorText}>
                        <Text numberOfLines={1} style={styles.authorName}>
                            {picture.author.name}
                        </Text>
                        <Text style={styles.publishedTime}>
                            {formatPublishedTime(picture.publishedAt)}
                        </Text>
                    </View>
                </View>

                {picture.contentText ? (
                    <Text selectable style={styles.contentText}>
                        {picture.contentText}
                    </Text>
                ) : null}

                <View style={styles.pictureGrid}>
                    {imageUrls.map((imageUrl, index) => (
                        <Pressable
                            accessibilityLabel={`查看图片,第${index + 1}张,共${imageUrls.length}张`}
                            accessibilityRole='button'
                            key={`${imageUrl}:${index}`}
                            onPress={() => {
                                setPreviewPictureIndex(index);
                                setIsPreviewVisible(true);
                            }}
                            style={({ pressed }) => [
                                styles.pictureButton,
                                {
                                    width: pictureWidth,
                                    aspectRatio: imageUrls.length === 1 ? 4 / 3 : 1,
                                },
                                pressed && styles.pressed,
                            ]}
                        >
                            <BilibiliImage
                                style={styles.picture}
                                thumbnailSize={{
                                    width: pictureWidth,
                                    height: imageUrls.length === 1
                                        ? pictureWidth * 3 / 4
                                        : pictureWidth,
                                }}
                                uri={imageUrl}
                            />
                        </Pressable>
                    ))}
                </View>

                {detailStatus === 'loading' ? (
                    <Text style={styles.detailStatus}>正在更新动态详情...</Text>
                ) : null}

                {detailErrorMessage ? (
                    <View style={styles.detailError}>
                        <Text style={styles.detailErrorText}>
                            {detailErrorMessage}
                        </Text>
                        <AppButton
                            onPress={() => setReloadKey((currentKey) => currentKey + 1)}
                            title='重试详情'
                        />
                    </View>
                ) : null}
            </View>

            <Text style={styles.commentsTitle}>
                {formatCommentCount(commentCount)}
            </Text>
        </>
    );

    return (
        <View style={styles.page}>
            <VideoCommentsPanel
                active
                contentHeader={detailHeader}
                headerSpacerHeight={0}
                minimumContentHeight={windowHeight}
                onScroll={scrollHandler}
                onScrollEnd={handleScrollEnd}
                onTotalCountChange={setCommentCount}
                subject={commentSubject}
                subjectUnavailableMessage={subjectUnavailableMessage}
            />

            <FullscreenImageViewer
                imageUrls={imageUrls}
                initialIndex={previewPictureIndex}
                onClose={() => setIsPreviewVisible(false)}
                visible={isPreviewVisible}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    dynamicContent: {
        padding: spacing.lg,
        backgroundColor: colors.pageBackground,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: spacing.sm,
    },
    authorText: {
        flex: 1,
        minWidth: 0,
    },
    authorName: {
        color: colors.primaryText,
        fontSize: 15,
        fontWeight: '700',
    },
    publishedTime: {
        marginTop: 2,
        color: colors.mutedText,
        fontSize: 12,
    },
    contentText: {
        marginTop: spacing.lg,
        color: colors.primaryText,
        fontSize: 17,
        lineHeight: 26,
    },
    pictureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    pictureButton: {
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    picture: {
        width: '100%',
        height: '100%',
    },
    pressed: {
        opacity: 0.72,
    },
    detailStatus: {
        marginTop: spacing.md,
        color: colors.mutedText,
        fontSize: 12,
    },
    detailError: {
        alignItems: 'flex-start',
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceBackground,
    },
    detailErrorText: {
        marginBottom: spacing.sm,
        color: colors.alertText,
        fontSize: 13,
        lineHeight: 19,
    },
    commentsTitle: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.accentForeground,
        fontSize: 16,
        fontWeight: '700',
        backgroundColor: colors.pageBackground,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surfaceBorder,
    },
});
