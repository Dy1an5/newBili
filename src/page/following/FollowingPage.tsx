import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
    type ListRenderItemInfo,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';

import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import AppLoadingIndicator from '@/components/AppLoadingIndicator';
import AppRefreshControl from '@/components/AppRefreshControl';
import SelectionBar from '@/components/SelectionBar';
import FollowingPictureCard from '@/page/following/FollowingPictureCard';
import FollowingVideoCard from '@/page/following/FollowingVideoCard';
import {
    fetchFollowingGroupMemberMids,
    fetchFollowingGroups,
    fetchFollowingPage,
    FollowingRequestError,
    type FollowingGroup,
    type FollowingItem,
    type FollowingPageData,
    type FollowingPicture,
} from '@/page/following/fetchFollowing';
import {
    createVideoPlaybackTarget,
    type VideoPlaybackTarget,
} from '@/page/video/videoPlaybackTarget';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { createGetErrorMessage } from '@/tool/errorMessage';
import { isRequestCancelled } from '@/tool/requestCancellation';

const GROUP_FEED_SCAN_PAGE_LIMIT = 3;

type Diagnostics = FollowingPageData['diagnostics'];
type MemberMidsByTagId = Record<string, string[]>;

type Props = {
    onPicturePress: (picture: FollowingPicture) => void;
    onVideoPress: (target: VideoPlaybackTarget) => void;
    refreshRequestId: number;
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

const getErrorMessage = createGetErrorMessage(
    [FollowingRequestError],
    '加载动态失败,请稍后重试',
);

function getFollowingItemKey(item: FollowingItem): string {
    return item.dynamicId;
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

export default function FollowingPage({
    onPicturePress,
    onVideoPress,
    refreshRequestId,
}: Props) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const [dynamics, setDynamics] = useState<FollowingItem[]>([]);
    const [groups, setGroups] = useState<FollowingGroup[]>([]);
    const [memberMidsByTagId, setMemberMidsByTagId] =
        useState<MemberMidsByTagId>({});
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isGroupScanPaused, setIsGroupScanPaused] = useState(false);
    const [isGroupsLoading, setIsGroupsLoading] = useState(true);
    const [loadingMemberTagId, setLoadingMemberTagId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [paginationErrorMessage, setPaginationErrorMessage] =
        useState<string | null>(null);
    const [groupsErrorMessage, setGroupsErrorMessage] = useState<string | null>(null);
    const [memberErrorMessage, setMemberErrorMessage] = useState<string | null>(null);

    const dynamicsRef = useRef<FollowingItem[]>([]);
    const groupsRef = useRef<FollowingGroup[]>([]);
    const memberMidsByTagIdRef = useRef<MemberMidsByTagId>({});
    const selectedTagIdRef = useRef<string | null>(null);
    const offsetRef = useRef<string | null>(null);
    const hasMoreRef = useRef(false);
    const isFirstPageLoadingRef = useRef(false);
    const isLoadingMoreRef = useRef(false);
    const isGroupScanPausedRef = useRef(false);
    const isRefreshingRef = useRef(false);
    const handledRefreshRequestIdRef = useRef(refreshRequestId);
    const listRef = useRef<FlatList<FollowingItem> | null>(null);
    const listViewportHeightRef = useRef(0);
    const listContentHeightRef = useRef(0);
    const listOffsetYRef = useRef(0);
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

        if (!refreshing) {
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
            if (!isRequestCancelled(error, controller.signal)) {
                setErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (firstPageControllerRef.current === controller) {
                firstPageControllerRef.current = null;
                isFirstPageLoadingRef.current = false;
                setIsLoading(false);
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
            if (!isRequestCancelled(error, controller.signal)) {
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
                    memberMids !== null &&
                    hasGroupDynamic(newDynamics, memberMids)
                ) {
                    foundGroupDynamic = true;
                }
            }

            const shouldPauseGroupScan =
                memberMids !== null &&
                !foundGroupDynamic &&
                hasMoreRef.current;

            isGroupScanPausedRef.current = shouldPauseGroupScan;
            setIsGroupScanPaused(shouldPauseGroupScan);
        } catch (error) {
            if (!isRequestCancelled(error, controller.signal)) {
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
            if (!isRequestCancelled(error, controller.signal)) {
                setMemberErrorMessage(getErrorMessage(error));
            }
        } finally {
            if (membersControllerRef.current === controller) {
                membersControllerRef.current = null;
                setLoadingMemberTagId(null);
            }
        }
    }, [loadMoreDynamics]);

    const handleGroupSelect = useCallback((tagId: string | null) => {
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
        if (isRefreshingRef.current) {
            return;
        }

        isRefreshingRef.current = true;
        setIsRefreshing(true);
        membersControllerRef.current?.abort();
        membersControllerRef.current = null;
        const currentTagId = selectedTagIdRef.current;
        const currentCacheKey = currentTagId === null
            ? null
            : String(currentTagId);
        const currentCachedMemberMids = currentCacheKey === null
            ? undefined
            : memberMidsByTagIdRef.current[currentCacheKey];
        const retainedMemberCache: MemberMidsByTagId =
            currentCacheKey && currentCachedMemberMids
                ? { [currentCacheKey]: currentCachedMemberMids }
                : {};

        memberMidsByTagIdRef.current = retainedMemberCache;
        setMemberMidsByTagId(retainedMemberCache);
        setMemberErrorMessage(null);

        try {
            const [, refreshedGroups] = await Promise.all([
                loadFirstPage(true),
                loadGroups(),
            ]);
            const refreshedTagId = selectedTagIdRef.current;

            if (refreshedTagId === null) {
                return;
            }

            const availableGroups = refreshedGroups ?? groupsRef.current;
            const selectedGroup = availableGroups.find(
                (group) => group.tagId === refreshedTagId,
            );

            if (selectedGroup) {
                await loadGroupMembers(selectedGroup, true);
            }
        } finally {
            isRefreshingRef.current = false;
            setIsRefreshing(false);
        }
    }, [loadFirstPage, loadGroupMembers, loadGroups]);

    useEffect(() => {
        if (handledRefreshRequestIdRef.current === refreshRequestId) {
            return;
        }

        handledRefreshRequestIdRef.current = refreshRequestId;
        listRef.current?.scrollToOffset({
            animated: false,
            offset: 0,
        });
        void refreshFollowing();
    }, [refreshFollowing, refreshRequestId]);

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

    const requestMoreIfAtBottom = useCallback(() => {
        const viewportHeight = listViewportHeightRef.current;
        const contentHeight = listContentHeightRef.current;

        if (viewportHeight <= 0 || contentHeight <= 0) {
            return;
        }

        const distanceFromBottom =
            contentHeight - viewportHeight - listOffsetYRef.current;

        if (distanceFromBottom <= spacing.xl) {
            requestMoreDynamics();
        }
    }, [requestMoreDynamics]);

    const handleListLayout = useCallback((event: LayoutChangeEvent) => {
        listViewportHeightRef.current = event.nativeEvent.layout.height;
        requestMoreIfAtBottom();
    }, [requestMoreIfAtBottom]);

    const handleListContentSizeChange = useCallback((
        _width: number,
        height: number,
    ) => {
        listContentHeightRef.current = height;
        requestMoreIfAtBottom();
    }, [requestMoreIfAtBottom]);

    const handleListScroll = useCallback((
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        listOffsetYRef.current = Math.max(
            0,
            event.nativeEvent.contentOffset.y,
        );
        requestMoreIfAtBottom();
    }, [requestMoreIfAtBottom]);

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

    const renderFollowingItem = useCallback(({
        item,
    }: ListRenderItemInfo<FollowingItem>) => {
        const publishedTimeText = formatPublishedTime(item.publishedAt);

        if (item.kind === 'picture') {
            return (
                <FollowingPictureCard
                    authorName={item.author.name}
                    avatarUrl={item.author.avatarUrl}
                    contentText={item.contentText}
                    imageUrls={item.imageUrls}
                    onContentPress={() => onPicturePress(item)}
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
    }, [onPicturePress, onVideoPress]);

    if (isLoading && dynamics.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accentForeground} size='large' />
                <Text style={styles.statusText}>正在加载动态...</Text>
            </View>
        );
    }

    if (errorMessage && dynamics.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <AppButton
                    onPress={() => void loadFirstPage(false)}
                    style={styles.actionButton}
                    title='重新加载'
                />
            </View>
        );
    }

    const renderEmptyContent = () => {
        if (isRefreshing) {
            return null;
        }

        if (selectedTagId !== null && loadingMemberTagId === selectedTagId) {
            return (
                <View style={styles.emptyMessage}>
                    <AppLoadingIndicator />
                </View>
            );
        }

        if (selectedTagId !== null && memberErrorMessage) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.errorText}>{memberErrorMessage}</Text>
                    <AppButton
                        onPress={retrySelectedGroupMembers}
                        style={styles.actionButton}
                        title='重试'
                    />
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
                    <AppLoadingIndicator />
                </View>
            );
        }

        if (paginationErrorMessage) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.errorText}>{paginationErrorMessage}</Text>
                    <AppButton
                        onPress={continueLoadingDynamics}
                        style={styles.actionButton}
                        title='重试'
                    />
                </View>
            );
        }

        if (
            selectedTagId !== null &&
            isGroupScanPaused &&
            hasMore
        ) {
            return (
                <View style={styles.emptyMessage}>
                    <Text style={styles.statusText}>
                        接下来3页暂无该分组的新动态
                    </Text>
                    <AppButton
                        onPress={continueLoadingDynamics}
                        style={styles.actionButton}
                        title='继续加载'
                    />
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
                </View>
            );
        }

        return (
            <View style={styles.emptyMessage}>
                <Text style={styles.statusText}>
                    {selectedTagId === null
                        ? '暂时没有识别到视频或图文动态'
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
            <SelectionBar
                errorMessage={groupsErrorMessage}
                isLoading={isGroupsLoading && !isRefreshing}
                onRetry={() => void loadGroups()}
                onSelect={handleGroupSelect}
                options={[
                    {
                        value: null,
                        label: '全部',
                        accessibilityLabel: '全部关注动态',
                    },
                    ...groups.map((group) => ({
                        value: group.tagId,
                        label: `${group.name}(${group.memberCount})`,
                        accessibilityLabel: `${group.name},${group.memberCount}位UP主`,
                    })),
                ]}
                selectedValue={selectedTagId}
            />

            <FlatList
                ref={listRef}
                contentContainerStyle={[
                    visibleDynamics.length === 0 ? styles.emptyList : styles.list,
                    { paddingBottom: bottomTabBarHeight + spacing.md },
                ]}
                data={visibleDynamics}
                initialNumToRender={5}
                keyExtractor={getFollowingItemKey}
                ListEmptyComponent={renderEmptyContent}
                ListFooterComponent={
                    visibleDynamics.length > 0 ? (
                        <View style={styles.footer}>
                            {isLoadingMore ? <AppLoadingIndicator /> : null}
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
                            {(
                                selectedTagId !== null &&
                                isGroupScanPaused &&
                                hasMore &&
                                !isLoadingMore &&
                                !paginationErrorMessage
                            ) ? (
                                <>
                                    <Text style={styles.footerText}>
                                        接下来3页暂无该分组的新动态
                                    </Text>
                                    <AppButton
                                        onPress={continueLoadingDynamics}
                                        style={styles.actionButton}
                                        title='继续加载'
                                    />
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
                onContentSizeChange={handleListContentSizeChange}
                onEndReached={requestMoreDynamics}
                onEndReachedThreshold={0.4}
                onLayout={handleListLayout}
                onScroll={handleListScroll}
                maxToRenderPerBatch={5}
                refreshControl={(
                    <AppRefreshControl
                        onRefresh={() => void refreshFollowing()}
                        refreshing={isRefreshing}
                    />
                )}
                removeClippedSubviews
                renderItem={renderFollowingItem}
                scrollEventThrottle={32}
                style={styles.listView}
                updateCellsBatchingPeriod={50}
                windowSize={7}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    listView: {
        flex: 1,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.pageBackground,
    },
    list: {
        paddingVertical: spacing.md,
        backgroundColor: colors.pageBackground,
    },
    emptyList: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.pageBackground,
    },
    statusText: {
        marginTop: spacing.sm,
        color: colors.secondaryText,
        fontSize: 14,
        textAlign: 'center',
    },
    emptyMessage: {
        alignItems: 'center',
    },
    diagnosticText: {
        marginTop: spacing.md,
        color: colors.mutedText,
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    errorText: {
        color: colors.primaryText,
        fontSize: 14,
        textAlign: 'center',
    },
    inlineError: {
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
        color: colors.secondaryText,
        fontSize: 13,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.md,
    },
    footer: {
        minHeight: 48,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerText: {
        color: colors.mutedText,
        fontSize: 12,
    },
    footerRetryButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    footerRetryText: {
        color: colors.accentForeground,
        fontSize: 13,
        fontWeight: '600',
    },
});
