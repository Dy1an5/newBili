import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import FollowingGroupSelector from '@/components/following/FollowingGroupSelector';
import FollowingPictureCard from '@/components/following/FollowingPictureCard';
import FollowingVideoCard from '@/components/following/FollowingVideoCard';
import {
    fetchFollowingGroupMemberMids,
    fetchFollowingGroups,
    fetchFollowingPage,
    FollowingRequestError,
    type FollowingPageData,
} from '@/page/following/fetchFollowing';
import { createVideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { FollowingGroup, FollowingItem } from '@/types/following';
import type { VideoPlaybackTarget } from '@/types/video';

const GROUP_FEED_SCAN_PAGE_LIMIT = 3;

type Diagnostics = FollowingPageData['diagnostics'];
type MemberMidsByTagId = Record<string, string[]>;

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

function mergeFollowingItems(
    currentItems: FollowingItem[],
    nextItems: FollowingItem[],
): FollowingItem[] {
    const dynamicIds = new Set(currentItems.map((item) => item.dynamicId));
    const uniqueNextItems = nextItems.filter((item) => {
        if (dynamicIds.has(item.dynamicId)) {
            return false;
        }

        dynamicIds.add(item.dynamicId);
        return true;
    });

    return [...currentItems, ...uniqueNextItems];
}

function hasGroupDynamic(
    dynamics: FollowingItem[],
    memberMids: ReadonlySet<string>,
): boolean {
    return dynamics.some((item) => memberMids.has(item.author.mid));
}

export default function FollowingPage({ onVideoPress }: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [dynamics, setDynamics] = useState<FollowingItem[]>([]);
    const [groups, setGroups] = useState<FollowingGroup[]>([]);
    const [memberMidsByTagId, setMemberMidsByTagId] =
        useState<MemberMidsByTagId>({});
    const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isGroupScanPaused, setIsGroupScanPaused] = useState(false);
    const [isGroupsLoading, setIsGroupsLoading] = useState(true);
    const [loadingMemberTagId, setLoadingMemberTagId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [paginationErrorMessage, setPaginationErrorMessage] =
        useState<string | null>(null);
    const [groupsErrorMessage, setGroupsErrorMessage] = useState<string | null>(null);
    const [memberErrorMessage, setMemberErrorMessage] = useState<string | null>(null);

    const dynamicsRef = useRef<FollowingItem[]>([]);
    const groupsRef = useRef<FollowingGroup[]>([]);
    const memberMidsByTagIdRef = useRef<MemberMidsByTagId>({});
    const selectedTagIdRef = useRef<number | null>(null);
    const offsetRef = useRef<string | null>(null);
    const hasMoreRef = useRef(false);
    const isFirstPageLoadingRef = useRef(false);
    const isLoadingMoreRef = useRef(false);
    const isGroupScanPausedRef = useRef(false);
    const firstPageControllerRef = useRef<AbortController | null>(null);
    const paginationControllerRef = useRef<AbortController | null>(null);
    const groupsControllerRef = useRef<AbortController | null>(null);
    const membersControllerRef = useRef<AbortController | null>(null);

    const replaceFollowingPage = useCallback((page: FollowingPageData) => {
        dynamicsRef.current = page.dynamics;
        offsetRef.current = page.offset;
        hasMoreRef.current = page.hasMore && page.offset !== null;
        setDynamics(page.dynamics);
        setDiagnostics(page.diagnostics);
        setHasMore(hasMoreRef.current);
    }, []);

    const loadFirstPage = useCallback(async (refreshing: boolean) => {
        firstPageControllerRef.current?.abort();
        paginationControllerRef.current?.abort();
        paginationControllerRef.current = null;
        isLoadingMoreRef.current = false;
        isGroupScanPausedRef.current = false;
        setIsLoadingMore(false);
        setIsGroupScanPaused(false);

        const controller = new AbortController();
        firstPageControllerRef.current = controller;
        isFirstPageLoadingRef.current = true;

        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        setErrorMessage(null);
        setPaginationErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowingRequestError('登录信息不存在,请重新登录');
            }

            const page = await fetchFollowingPage(cookie, undefined, controller.signal);
            replaceFollowingPage(page);
        } catch (error) {
            if (!isAbortError(error)) {
                setErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (firstPageControllerRef.current === controller) {
                firstPageControllerRef.current = null;
                isFirstPageLoadingRef.current = false;
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [replaceFollowingPage]);

    const loadGroups = useCallback(async (): Promise<FollowingGroup[] | null> => {
        groupsControllerRef.current?.abort();
        const controller = new AbortController();
        groupsControllerRef.current = controller;
        setIsGroupsLoading(true);
        setGroupsErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowingRequestError('登录信息不存在,请重新登录');
            }

            const nextGroups = await fetchFollowingGroups(cookie, controller.signal);
            groupsRef.current = nextGroups;
            setGroups(nextGroups);

            const currentTagId = selectedTagIdRef.current;

            if (
                currentTagId !== null &&
                !nextGroups.some((group) => group.tagId === currentTagId)
            ) {
                membersControllerRef.current?.abort();
                paginationControllerRef.current?.abort();
                paginationControllerRef.current = null;
                isLoadingMoreRef.current = false;
                isGroupScanPausedRef.current = false;
                selectedTagIdRef.current = null;
                setSelectedTagId(null);
                setIsLoadingMore(false);
                setIsGroupScanPaused(false);
                setLoadingMemberTagId(null);
                setMemberErrorMessage(null);
            }

            return nextGroups;
        } catch (error) {
            if (!isAbortError(error)) {
                setGroupsErrorMessage(getErrorMessage(error));
            }

            return null;
        } finally {
            if (groupsControllerRef.current === controller) {
                groupsControllerRef.current = null;
                setIsGroupsLoading(false);
            }
        }
    }, []);

    const loadMoreDynamics = useCallback(async (
        memberMids: ReadonlySet<string> | null,
        pageScanLimit: number,
    ) => {
        if (
            isFirstPageLoadingRef.current ||
            isLoadingMoreRef.current ||
            !hasMoreRef.current ||
            !offsetRef.current
        ) {
            return;
        }

        const controller = new AbortController();
        paginationControllerRef.current = controller;
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        setPaginationErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowingRequestError('登录信息不存在,请重新登录');
            }

            let scannedPageCount = 0;
            let foundGroupDynamic = false;

            while (
                scannedPageCount < pageScanLimit &&
                hasMoreRef.current &&
                offsetRef.current
            ) {
                const requestOffset = offsetRef.current;
                const page = await fetchFollowingPage(
                    cookie,
                    requestOffset,
                    controller.signal,
                );
                const existingDynamicIds = new Set(
                    dynamicsRef.current.map((item) => item.dynamicId),
                );
                const newDynamics = page.dynamics.filter(
                    (item) => !existingDynamicIds.has(item.dynamicId),
                );
                const mergedDynamics = mergeFollowingItems(
                    dynamicsRef.current,
                    page.dynamics,
                );
                const nextHasMore =
                    page.hasMore &&
                    page.offset !== null &&
                    page.offset !== requestOffset;

                dynamicsRef.current = mergedDynamics;
                offsetRef.current = page.offset;
                hasMoreRef.current = nextHasMore;
                setDynamics(mergedDynamics);
                setHasMore(nextHasMore);
                scannedPageCount += 1;

                if (
                    memberMids === null ||
                    hasGroupDynamic(newDynamics, memberMids)
                ) {
                    foundGroupDynamic = memberMids !== null;
                    break;
                }
            }

            const shouldPauseGroupScan =
                memberMids !== null &&
                !foundGroupDynamic &&
                hasMoreRef.current;

            isGroupScanPausedRef.current = shouldPauseGroupScan;
            setIsGroupScanPaused(shouldPauseGroupScan);
        } catch (error) {
            if (!isAbortError(error)) {
                setPaginationErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (paginationControllerRef.current === controller) {
                paginationControllerRef.current = null;
                isLoadingMoreRef.current = false;
                setIsLoadingMore(false);
            }
        }
    }, []);

    const loadGroupMembers = useCallback(async (
        group: FollowingGroup,
        forceRefresh = false,
    ) => {
        const cacheKey = String(group.tagId);
        const cachedMemberMids = memberMidsByTagIdRef.current[cacheKey];

        if (cachedMemberMids && !forceRefresh) {
            const memberMids = new Set(cachedMemberMids);

            if (
                selectedTagIdRef.current === group.tagId &&
                memberMids.size > 0 &&
                !hasGroupDynamic(dynamicsRef.current, memberMids)
            ) {
                void loadMoreDynamics(memberMids, GROUP_FEED_SCAN_PAGE_LIMIT);
            }

            return;
        }

        membersControllerRef.current?.abort();
        const controller = new AbortController();
        membersControllerRef.current = controller;
        setLoadingMemberTagId(group.tagId);
        setMemberErrorMessage(null);

        try {
            const cookie = await getLoginCookie();

            if (!cookie) {
                throw new FollowingRequestError('登录信息不存在,请重新登录');
            }

            const memberMids = await fetchFollowingGroupMemberMids(
                group,
                cookie,
                controller.signal,
            );
            const nextCache = {
                ...memberMidsByTagIdRef.current,
                [cacheKey]: memberMids,
            };

            memberMidsByTagIdRef.current = nextCache;
            setMemberMidsByTagId(nextCache);

            if (membersControllerRef.current === controller) {
                membersControllerRef.current = null;
                setLoadingMemberTagId(null);
            }

            const memberMidSet = new Set(memberMids);

            if (
                selectedTagIdRef.current === group.tagId &&
                memberMidSet.size > 0 &&
                !hasGroupDynamic(dynamicsRef.current, memberMidSet)
            ) {
                void loadMoreDynamics(memberMidSet, GROUP_FEED_SCAN_PAGE_LIMIT);
            }
        } catch (error) {
            if (!isAbortError(error)) {
                setMemberErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (membersControllerRef.current === controller) {
                membersControllerRef.current = null;
                setLoadingMemberTagId(null);
            }
        }
    }, [loadMoreDynamics]);

    const handleGroupSelect = useCallback((tagId: number | null) => {
        if (tagId === selectedTagIdRef.current) {
            return;
        }

        membersControllerRef.current?.abort();
        membersControllerRef.current = null;
        paginationControllerRef.current?.abort();
        paginationControllerRef.current = null;
        isLoadingMoreRef.current = false;
        isGroupScanPausedRef.current = false;
        setIsLoadingMore(false);
        setIsGroupScanPaused(false);
        setLoadingMemberTagId(null);
        setMemberErrorMessage(null);
        setPaginationErrorMessage(null);
        selectedTagIdRef.current = tagId;
        setSelectedTagId(tagId);

        if (tagId === null) {
            return;
        }

        const group = groupsRef.current.find((item) => item.tagId === tagId);

        if (group) {
            void loadGroupMembers(group);
        }
    }, [loadGroupMembers]);

    const refreshFollowing = useCallback(async () => {
        membersControllerRef.current?.abort();
        membersControllerRef.current = null;
        memberMidsByTagIdRef.current = {};
        setMemberMidsByTagId({});
        setLoadingMemberTagId(selectedTagIdRef.current);
        setMemberErrorMessage(null);

        const [, refreshedGroups] = await Promise.all([
            loadFirstPage(true),
            loadGroups(),
        ]);
        const currentTagId = selectedTagIdRef.current;

        if (currentTagId === null) {
            return;
        }

        const availableGroups = refreshedGroups ?? groupsRef.current;
        const selectedGroup = availableGroups.find(
            (group) => group.tagId === currentTagId,
        );

        if (selectedGroup) {
            await loadGroupMembers(selectedGroup, true);
        }
    }, [loadFirstPage, loadGroupMembers, loadGroups]);

    useEffect(() => {
        void loadFirstPage(false);
        void loadGroups();

        return () => {
            firstPageControllerRef.current?.abort();
            paginationControllerRef.current?.abort();
            groupsControllerRef.current?.abort();
            membersControllerRef.current?.abort();
            firstPageControllerRef.current = null;
            paginationControllerRef.current = null;
            groupsControllerRef.current = null;
            membersControllerRef.current = null;
        };
    }, [loadFirstPage, loadGroups]);

    const selectedGroup = useMemo(
        () => groups.find((group) => group.tagId === selectedTagId) ?? null,
        [groups, selectedTagId],
    );
    const selectedMemberMids = useMemo(() => {
        if (selectedTagId === null) {
            return null;
        }

        const memberMids = memberMidsByTagId[String(selectedTagId)];

        return memberMids ? new Set(memberMids) : undefined;
    }, [memberMidsByTagId, selectedTagId]);
    const visibleDynamics = useMemo(() => {
        if (selectedMemberMids === null) {
            return dynamics;
        }

        if (!selectedMemberMids) {
            return [];
        }

        return dynamics.filter((item) => selectedMemberMids.has(item.author.mid));
    }, [dynamics, selectedMemberMids]);

    const requestMoreDynamics = useCallback(() => {
        if (
            selectedMemberMids === undefined ||
            isGroupScanPausedRef.current
        ) {
            return;
        }

        void loadMoreDynamics(
            selectedMemberMids,
            selectedMemberMids === null ? 1 : GROUP_FEED_SCAN_PAGE_LIMIT,
        );
    }, [loadMoreDynamics, selectedMemberMids]);

    const continueLoadingDynamics = useCallback(() => {
        if (selectedMemberMids === undefined) {
            return;
        }

        isGroupScanPausedRef.current = false;
        setIsGroupScanPaused(false);
        void loadMoreDynamics(
            selectedMemberMids,
            selectedMemberMids === null ? 1 : GROUP_FEED_SCAN_PAGE_LIMIT,
        );
    }, [loadMoreDynamics, selectedMemberMids]);

    const retrySelectedGroupMembers = useCallback(() => {
        if (selectedGroup) {
            void loadGroupMembers(selectedGroup, true);
        }
    }, [loadGroupMembers, selectedGroup]);

    if (isLoading && dynamics.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} size='large' />
                <Text style={styles.statusText}>正在加载动态...</Text>
            </View>
        );
    }

    if (errorMessage && dynamics.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                    onPress={() => void loadFirstPage(false)}
                    style={styles.retryButton}
                >
                    <Text style={styles.retryButtonText}>重新加载</Text>
                </Pressable>
            </View>
        );
    }

    const renderEmptyContent = () => {
        if (selectedTagId !== null && loadingMemberTagId === selectedTagId) {
            return (
                <View style={styles.emptyMessage}>
                    <ActivityIndicator color={colors.primary} size='small' />
                    <Text style={styles.statusText}>正在加载分组成员...</Text>
                </View>
            );
        }

        if (selectedTagId !== null && memberErrorMessage) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.errorText}>{memberErrorMessage}</Text>
                    <Pressable
                        onPress={retrySelectedGroupMembers}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>重试</Text>
                    </Pressable>
                </View>
            );
        }

        if (selectedMemberMids instanceof Set && selectedMemberMids.size === 0) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.statusText}>该分组暂无关注UP主</Text>
                </View>
            );
        }

        if (isLoadingMore) {
            return (
                <View style={styles.emptyMessage}>
                    <ActivityIndicator color={colors.primary} size='small' />
                    <Text style={styles.statusText}>正在继续查找动态...</Text>
                </View>
            );
        }

        if (paginationErrorMessage) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.errorText}>{paginationErrorMessage}</Text>
                    <Pressable
                        onPress={continueLoadingDynamics}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>重试</Text>
                    </Pressable>
                </View>
            );
        }

        if (hasMore) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.statusText}>
                        {selectedTagId === null
                            ? '当前页暂无可展示动态'
                            : '当前已加载范围内暂无该分组动态'}
                    </Text>
                    <Pressable onPress={continueLoadingDynamics} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>继续加载</Text>
                    </Pressable>
                </View>
            );
        }

        return (
            <View style={styles.emptyMessage}>
                <Text style={styles.statusText}>
                    {selectedTagId === null
                        ? '暂时没有识别到视频、图文或文字动态'
                        : '该分组暂无可展示动态'}
                </Text>
                {selectedTagId === null && diagnostics ? (
                    <Text selectable style={styles.diagnosticText}>
                        原始条数:{diagnostics.rawItemCount}{'\n'}
                        item.type:{diagnostics.itemTypes.join(',') || '无'}{'\n'}
                        major.type:{diagnostics.majorTypes.join(',') || '无'}
                    </Text>
                ) : null}
            </View>
        );
    };

    return (
        <View style={styles.page}>
            <FollowingGroupSelector
                errorMessage={groupsErrorMessage}
                groups={groups}
                isLoading={isGroupsLoading}
                loadingMemberTagId={loadingMemberTagId}
                onRetry={() => void loadGroups()}
                onSelect={handleGroupSelect}
                selectedTagId={selectedTagId}
            />

            <FlatList
                contentContainerStyle={[
                    visibleDynamics.length === 0 ? styles.emptyList : styles.list,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                data={visibleDynamics}
                keyExtractor={(item) => item.dynamicId}
                ListEmptyComponent={renderEmptyContent}
                ListFooterComponent={
                    visibleDynamics.length > 0 ? (
                        <View style={styles.footer}>
                            {isLoadingMore ? (
                                <ActivityIndicator color={colors.primary} size='small' />
                            ) : null}
                            {paginationErrorMessage ? (
                                <>
                                    <Text style={styles.inlineError}>
                                        {paginationErrorMessage}
                                    </Text>
                                    <Pressable
                                        onPress={continueLoadingDynamics}
                                        style={styles.footerRetryButton}
                                    >
                                        <Text style={styles.footerRetryText}>重试</Text>
                                    </Pressable>
                                </>
                            ) : null}
                            {isGroupScanPaused && !paginationErrorMessage ? (
                                <>
                                    <Text style={styles.footerText}>
                                        接下来3页暂无该分组的新动态
                                    </Text>
                                    <Pressable
                                        onPress={continueLoadingDynamics}
                                        style={styles.footerRetryButton}
                                    >
                                        <Text style={styles.footerRetryText}>继续加载</Text>
                                    </Pressable>
                                </>
                            ) : null}
                            {!hasMore && !isLoadingMore && !paginationErrorMessage ? (
                                <Text style={styles.footerText}>没有更多了</Text>
                            ) : null}
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    errorMessage ? (
                        <Text style={styles.inlineError}>{errorMessage}</Text>
                    ) : null
                }
                onEndReached={requestMoreDynamics}
                onEndReachedThreshold={0.4}
                onRefresh={() => void refreshFollowing()}
                refreshing={isRefreshing}
                renderItem={({ item }) => {
                    const publishedTimeText = formatPublishedTime(item.publishedAt);

                    if (item.kind === 'picture' || item.kind === 'text') {
                        return (
                            <FollowingPictureCard
                                authorName={item.author.name}
                                avatarUrl={item.author.avatarUrl}
                                contentText={item.contentText}
                                imageUrls={item.kind === 'picture' ? item.imageUrls : []}
                                publishedTimeText={publishedTimeText}
                            />
                        );
                    }

                    return (
                        <FollowingVideoCard
                            authorName={item.author.name}
                            avatarUrl={item.author.avatarUrl}
                            coverUrl={item.coverUrl}
                            onPress={() => onVideoPress(createVideoPlaybackTarget(item))}
                            publishedTimeText={publishedTimeText}
                            title={item.title}
                        />
                    );
                }}
                style={styles.listView}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listView: {
        flex: 1,
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
        textAlign: 'center',
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
        marginVertical: spacing.sm,
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
    footer: {
        minHeight: 48,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerText: {
        color: colors.textMuted,
        fontSize: 12,
    },
    footerRetryButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    footerRetryText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
});
