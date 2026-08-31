import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentTaskError, runAgentTask } from '../core/agentTaskRunner';
import { logAgentDebug } from '../debug/agentDebugLog';
import type {
    VideoPartKnowledgeDocument,
    VideoPartSummary,
    VideoPartSummaryTarget,
} from '../domain/videoSummary';
import {
    videoPartSummaryPrompt,
    VideoSummaryPromptError,
} from '../prompt/videoPartSummaryPrompt';
import {
    DeepSeekRequestError,
    DeepSeekResponsesProvider,
} from '../provider/deepseekResponsesProvider';
import {
    BilibiliSubtitleError,
    fetchBilibiliSubtitle,
} from '../source/fetchBilibiliSubtitle';
import {
    getStoredVideoPartSummary,
    saveVideoPartSummary,
    VideoPartSummaryStorageError,
} from '../storage/videoPartSummaryRepository';
import { getLoginCookie } from '@/auth/authCookie';
import AppButton from '@/components/AppButton';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

const DEEPSEEK_MODEL_ID = 'deepseek-v4-flash';
const deepSeekProvider = new DeepSeekResponsesProvider({
    reasoningEffort: 'high',
});

type SummaryState =
    | { status: 'idle' }
    | { status: 'checking-cache' }
    | { status: 'loading' }
    | { status: 'unavailable' }
    | { status: 'error'; message: string }
    | {
        status: 'success';
        target: VideoPartSummaryTarget;
        summary: VideoPartSummary;
        subtitleName: string;
        inputTokens?: number;
        outputTokens?: number;
        isCached: boolean;
        storageWarning?: string;
    };

type Props = {
    target: VideoPartSummaryTarget | null;
    apiKey: string | null;
};

type SummaryRequest = {
    id: number;
    target: VideoPartSummaryTarget;
};

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
    if (
        error instanceof BilibiliSubtitleError
        || error instanceof DeepSeekRequestError
        || error instanceof AgentTaskError
        || error instanceof VideoSummaryPromptError
        || error instanceof VideoPartSummaryStorageError
    ) {
        return error.message;
    }

    return '生成总结失败,请稍后重试';
}

function formatTime(timeMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds]
            .map((value, index) => (
                index === 0 ? String(value) : String(value).padStart(2, '0')
            ))
            .join(':');
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function createCuePreview(
    cues: VideoPartKnowledgeDocument['cues'],
): readonly Record<string, unknown>[] {
    const previewCues = cues.length <= 6
        ? cues
        : [
            ...cues.slice(0, 3),
            ...cues.slice(-3),
        ];

    return previewCues.map((cue) => ({
        startMs: cue.startMs,
        endMs: cue.endMs,
        text: cue.text,
    }));
}

export default function VideoSummaryPanel({ target, apiKey }: Props) {
    const safeAreaInsets = useSafeAreaInsets();
    const requestIdRef = useRef(0);
    const [request, setRequest] = useState<SummaryRequest | null>(null);
    const [state, setState] = useState<SummaryState>({ status: 'idle' });
    const targetKey = target
        ? `${target.identity.bvid}:${target.identity.cid}`
        : '';

    useEffect(() => {
        let isCurrent = true;

        setRequest(null);

        if (!target) {
            setState({ status: 'idle' });
            return () => {
                isCurrent = false;
            };
        }

        setState({ status: 'checking-cache' });

        const loadStoredSummary = async () => {
            try {
                const storedSummary = await getStoredVideoPartSummary(target);

                if (!isCurrent) {
                    return;
                }

                if (!storedSummary) {
                    logAgentDebug('本地总结查询', {
                        bvid: target.identity.bvid,
                        cid: target.identity.cid,
                        status: 'miss',
                    });
                    setState({ status: 'idle' });
                    return;
                }

                logAgentDebug('本地总结查询', {
                    bvid: target.identity.bvid,
                    cid: target.identity.cid,
                    status: 'hit',
                    modelId: storedSummary.modelId,
                    promptId: storedSummary.promptId,
                    promptVersion: storedSummary.promptVersion,
                    updatedAt: storedSummary.updatedAt,
                });
                setState({
                    status: 'success',
                    target: storedSummary.target,
                    summary: storedSummary.summary,
                    subtitleName: storedSummary.subtitleName,
                    isCached: true,
                });
            } catch (error) {
                if (isCurrent) {
                    logAgentDebug('本地总结查询失败', {
                        name: error instanceof Error ? error.name : 'UnknownError',
                    });
                    setState({
                        status: 'error',
                        message: '读取本地总结失败,可以点击重新生成',
                    });
                }
            }
        };

        void loadStoredSummary();

        return () => {
            isCurrent = false;
        };
    }, [targetKey]);

    const startSummary = () => {
        if (!target) {
            return;
        }

        if (!apiKey?.trim()) {
            setState({
                status: 'error',
                message: '没有配置DeepSeek API key,请返回列表页点击右下角AI按钮配置',
            });
            return;
        }

        requestIdRef.current += 1;
        logAgentDebug('点击开始生成', {
            bvid: target.identity.bvid,
            cid: target.identity.cid,
            videoTitle: target.videoTitle,
            partTitle: target.partTitle,
            partNumber: target.partNumber,
        });
        setRequest({
            id: requestIdRef.current,
            target,
        });
    };

    useEffect(() => {
        if (!request) {
            return;
        }

        const controller = new AbortController();
        const requestTarget = request.target;

        const loadSummary = async () => {
            setState({ status: 'loading' });

            try {
                if (!apiKey?.trim()) {
                    throw new AgentTaskError('没有配置DeepSeek API key');
                }

                const cookie = await getLoginCookie();

                if (!cookie) {
                    throw new BilibiliSubtitleError('登录信息不存在,请重新登录');
                }

                logAgentDebug('请求B站字幕', {
                    endpoint: '/x/player/wbi/v2',
                    bvid: requestTarget.identity.bvid,
                    cid: requestTarget.identity.cid,
                });

                const subtitleResult = await fetchBilibiliSubtitle(
                    requestTarget.identity.bvid,
                    requestTarget.identity.cid,
                    cookie,
                    controller.signal,
                );

                if (subtitleResult.status === 'unavailable') {
                    logAgentDebug('B站字幕返回', {
                        status: 'unavailable',
                        reason: subtitleResult.reason,
                    });
                    setState({ status: 'unavailable' });
                    return;
                }

                const { subtitle } = subtitleResult;
                const subtitleCharacterCount = subtitle.cues.reduce(
                    (total, cue) => total + cue.text.length,
                    0,
                );

                logAgentDebug('B站字幕返回', {
                    status: 'available',
                    language: subtitle.track.language,
                    displayName: subtitle.track.displayName,
                    source: subtitle.track.source,
                    cueCount: subtitle.cues.length,
                    characterCount: subtitleCharacterCount,
                    cuePreview: createCuePreview(subtitle.cues),
                    previewNote: subtitle.cues.length > 6
                        ? '仅显示开头3条和结尾3条字幕'
                        : '字幕较短,已显示全部字幕条目',
                });
                const lastCue = subtitle.cues[subtitle.cues.length - 1];
                const durationMs = Math.max(
                    requestTarget.durationMs,
                    lastCue?.endMs ?? 0,
                );
                const document: VideoPartKnowledgeDocument = {
                    identity: requestTarget.identity,
                    videoTitle: requestTarget.videoTitle,
                    authorName: requestTarget.authorName,
                    tags: [],
                    partTitle: requestTarget.partTitle,
                    partNumber: requestTarget.partNumber,
                    durationMs,
                    transcriptLanguage: subtitle.track.language,
                    transcriptSource: subtitle.track.source,
                    cues: subtitle.cues,
                    sourceHash: subtitle.sourceHash,
                };

                logAgentDebug('发送给DeepSeek', {
                    modelId: DEEPSEEK_MODEL_ID,
                    promptId: videoPartSummaryPrompt.id,
                    promptVersion: videoPartSummaryPrompt.version,
                    videoTitle: document.videoTitle,
                    authorName: document.authorName ?? '未知',
                    partTitle: document.partTitle,
                    partNumber: document.partNumber,
                    durationMs: document.durationMs,
                    transcriptLanguage: document.transcriptLanguage ?? '未知',
                    transcriptSource: document.transcriptSource,
                    cueCount: document.cues.length,
                    characterCount: subtitleCharacterCount,
                    cuePreview: createCuePreview(document.cues),
                    omittedSensitiveFields: [
                        'apiKey',
                        'Authorization',
                        'Cookie',
                        '完整字幕',
                    ],
                });

                const result = await runAgentTask(
                    deepSeekProvider,
                    videoPartSummaryPrompt,
                    { document },
                    DEEPSEEK_MODEL_ID,
                    apiKey,
                    controller.signal,
                );

                logAgentDebug('DeepSeek返回', {
                    providerId: result.providerId,
                    modelId: result.modelId,
                    usage: result.usage,
                    output: result.output,
                });
                logAgentDebug('准备保存总结到本地数据库', {
                    database: 'newbili.db',
                    table: 'video_part_summaries',
                    bvid: requestTarget.identity.bvid,
                    cid: requestTarget.identity.cid,
                });

                let storageWarning: string | undefined;

                try {
                    await saveVideoPartSummary({
                        target: {
                            ...requestTarget,
                            durationMs,
                        },
                        summary: result.output,
                        providerId: result.providerId,
                        modelId: result.modelId,
                        promptId: videoPartSummaryPrompt.id,
                        promptVersion: videoPartSummaryPrompt.version,
                        subtitleName: subtitle.track.displayName,
                        sourceHash: subtitle.sourceHash,
                    });
                    logAgentDebug('总结已保存到本地数据库', {
                        database: 'newbili.db',
                        table: 'video_part_summaries',
                        bvid: requestTarget.identity.bvid,
                        cid: requestTarget.identity.cid,
                    });
                } catch (error) {
                    storageWarning = error instanceof Error
                        ? error.message
                        : '本地保存失败';
                    logAgentDebug('总结保存失败', {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        message: storageWarning,
                    });
                }

                setState({
                    status: 'success',
                    target: requestTarget,
                    summary: result.output,
                    subtitleName: subtitle.track.displayName,
                    inputTokens: result.usage?.inputTokens,
                    outputTokens: result.usage?.outputTokens,
                    isCached: false,
                    storageWarning,
                });
            } catch (error) {
                if (!isAbortError(error)) {
                    const errorRecord = error instanceof DeepSeekRequestError
                        ? {
                            name: error.name,
                            reason: error.reason,
                            status: error.status,
                            code: error.code,
                            message: error.reason === 'response-failed'
                                ? 'DeepSeek报告生成失败,原始错误内容未写入日志'
                                : error.message,
                        }
                        : error instanceof AgentTaskError
                        ? {
                            name: error.name,
                            message: error.message,
                            rawModelOutput: error.rawOutput
                                ?? '没有可记录的模型输出',
                        }
                        : error instanceof VideoPartSummaryStorageError
                        ? {
                            name: error.name,
                            message: error.message,
                        }
                        : error instanceof Error
                        ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                        }
                        : {
                            name: 'UnknownError',
                            message: '生成总结失败,请稍后重试',
                        };

                    logAgentDebug('总结流程失败', errorRecord);
                    setState({
                        status: 'error',
                        message: getErrorMessage(error),
                    });
                }
            }
        };

        void loadSummary();

        return () => {
            controller.abort();
        };
    }, [apiKey, request]);

    return (
        <View style={styles.page}>
            {state.status === 'checking-cache' ? (
                <View style={styles.centerState}>
                    <ActivityIndicator color={colors.accentForeground} size='small' />
                    <Text style={styles.stateDescription}>正在查找本地总结...</Text>
                </View>
            ) : state.status === 'idle' ? (
                <View style={styles.centerState}>
                    <Text style={styles.stateTitle}>AI视频总结</Text>
                    <Text style={styles.stateDescription}>
                        {target
                            ? `将根据P${target.partNumber} ${target.partTitle}的B站字幕生成总结`
                            : '正在等待当前分P信息'}
                    </Text>
                    <AppButton
                        disabled={target === null}
                        onPress={startSummary}
                        style={styles.actionButton}
                        title='开始生成'
                    />
                </View>
            ) : state.status === 'loading' ? (
                <View style={styles.centerState}>
                    <ActivityIndicator color={colors.accentForeground} size='large' />
                    <Text style={styles.stateTitle}>正在生成总结...</Text>
                    <Text style={styles.stateDescription}>
                        正在获取当前分P字幕并请求DeepSeek
                    </Text>
                </View>
            ) : state.status === 'unavailable' ? (
                <View style={styles.centerState}>
                    <Text style={styles.stateTitle}>当前分P暂无字幕</Text>
                    <Text style={styles.stateDescription}>
                        没有字幕时不会调用模型
                    </Text>
                    <AppButton
                        onPress={startSummary}
                        style={styles.actionButton}
                        title='重新检查'
                    />
                </View>
            ) : state.status === 'error' ? (
                <View style={styles.centerState}>
                    <Text style={styles.errorTitle}>总结失败</Text>
                    <Text style={styles.stateDescription}>{state.message}</Text>
                    <AppButton
                        onPress={startSummary}
                        style={styles.actionButton}
                        title='重新生成'
                    />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: safeAreaInsets.bottom + spacing.xl },
                    ]}
                >
                    <View style={styles.resultHeader}>
                        <AppButton
                            onPress={startSummary}
                            style={styles.resultActionButton}
                            title='重新生成总结'
                        />

                        <Text style={styles.videoTitle}>{state.target.videoTitle}</Text>
                        <Text style={styles.metaText}>
                            P{state.target.partNumber} {state.target.partTitle} · {state.subtitleName}
                            {state.isCached ? ' · 本地缓存' : ''}
                        </Text>
                        {state.storageWarning ? (
                            <Text style={styles.storageWarningText}>
                                总结已生成,但{state.storageWarning}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>概述</Text>
                        <Text style={styles.bodyText}>{state.summary.overview}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>重点</Text>
                        {state.summary.keyPoints.map((point, index) => (
                            <View key={`${index}:${point.text}`} style={styles.listItem}>
                                <Text style={styles.listIndex}>{index + 1}</Text>
                                <View style={styles.listContent}>
                                    <Text style={styles.bodyText}>{point.text}</Text>
                                    <Text style={styles.timeText}>
                                        {point.evidence.map((evidence) => (
                                            `${formatTime(evidence.startMs)}-${formatTime(evidence.endMs)}`
                                        )).join(' · ')}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {state.summary.chapters.length > 0 ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>章节</Text>
                            {state.summary.chapters.map((chapter, index) => (
                                <View
                                    key={`${index}:${chapter.startMs}`}
                                    style={styles.chapter}
                                >
                                    <Text style={styles.chapterTitle}>
                                        {formatTime(chapter.startMs)} {chapter.title}
                                    </Text>
                                    <Text style={styles.bodyText}>{chapter.summary}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {state.summary.limitations.length > 0 ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>局限</Text>
                            {state.summary.limitations.map((limitation, index) => (
                                <Text
                                    key={`${index}:${limitation}`}
                                    style={styles.limitationText}
                                >
                                    · {limitation}
                                </Text>
                            ))}
                        </View>
                    ) : null}

                    {state.inputTokens !== undefined || state.outputTokens !== undefined ? (
                        <Text style={styles.usageText}>
                            Token用量:输入{state.inputTokens ?? '-'},输出{state.outputTokens ?? '-'}
                        </Text>
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    stateTitle: {
        marginTop: spacing.md,
        color: colors.primaryText,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    errorTitle: {
        color: colors.alertText,
        fontSize: 18,
        fontWeight: '700',
    },
    stateDescription: {
        marginTop: spacing.sm,
        color: colors.secondaryText,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.lg,
    },
    content: {
        padding: spacing.lg,
    },
    resultHeader: {
        alignItems: 'stretch',
    },
    resultActionButton: {
        alignSelf: 'flex-end',
        marginBottom: spacing.md,
    },
    videoTitle: {
        color: colors.primaryText,
        fontSize: 19,
        lineHeight: 27,
        fontWeight: '700',
    },
    metaText: {
        marginTop: spacing.xs,
        color: colors.mutedText,
        fontSize: 13,
    },
    storageWarningText: {
        marginTop: spacing.xs,
        color: colors.alertText,
        fontSize: 12,
        lineHeight: 18,
    },
    section: {
        marginTop: spacing.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceBackground,
    },
    sectionTitle: {
        marginBottom: spacing.md,
        color: colors.primaryText,
        fontSize: 17,
        fontWeight: '700',
    },
    bodyText: {
        color: colors.secondaryText,
        fontSize: 15,
        lineHeight: 23,
    },
    listItem: {
        marginBottom: spacing.md,
        flexDirection: 'row',
    },
    listIndex: {
        width: 28,
        color: colors.accentForeground,
        fontSize: 15,
        fontWeight: '700',
    },
    listContent: {
        flex: 1,
    },
    timeText: {
        marginTop: spacing.xs,
        color: colors.accentForeground,
        fontSize: 12,
    },
    chapter: {
        marginBottom: spacing.lg,
    },
    chapterTitle: {
        marginBottom: spacing.xs,
        color: colors.accentForeground,
        fontSize: 14,
        fontWeight: '700',
    },
    limitationText: {
        marginBottom: spacing.sm,
        color: colors.mutedText,
        fontSize: 14,
        lineHeight: 21,
    },
    usageText: {
        marginTop: spacing.lg,
        color: colors.mutedText,
        fontSize: 12,
        textAlign: 'center',
    },
});
