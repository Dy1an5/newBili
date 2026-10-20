import type {
    ModelProvider,
    ModelResponse,
    ModelUsage,
} from '../core/modelProvider';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

type JsonRecord = Record<string, unknown>;

export type DeepSeekReasoningEffort =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max';

export type DeepSeekResponsesProviderOptions = {
    baseUrl?: string;
    reasoningEffort?: DeepSeekReasoningEffort;
};

export type DeepSeekRequestFailureReason =
    | 'missing-api-key'
    | 'invalid-api-key'
    | 'network-error'
    | 'invalid-json'
    | 'http-error'
    | 'response-failed'
    | 'response-incomplete'
    | 'missing-output-text';

export class DeepSeekRequestError extends Error {
    readonly status?: number;
    readonly code?: string;
    readonly reason: DeepSeekRequestFailureReason;

    constructor(
        message: string,
        reason: DeepSeekRequestFailureReason,
        status?: number,
        code?: string,
    ) {
        super(message);
        this.name = 'DeepSeekRequestError';
        this.reason = reason;
        this.status = status;
        this.code = code;
    }
}

function asRecord(value: unknown): JsonRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as JsonRecord;
}

function readString(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }

    return value.trim();
}

function readNumber(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
}

function readErrorMessage(value: unknown): string | undefined {
    const record = asRecord(value);
    const error = asRecord(record?.error);

    return readString(error?.message);
}

function readErrorCode(value: unknown): string | undefined {
    const record = asRecord(value);
    const error = asRecord(record?.error);

    return readString(error?.code);
}

function readOutputText(value: unknown): string {
    const record = asRecord(value);
    const output = Array.isArray(record?.output) ? record.output : [];

    const textParts: string[] = [];

    for (const outputItem of output) {
        const outputRecord = asRecord(outputItem);

        if (outputRecord?.type !== 'message' || !Array.isArray(outputRecord.content)) {
            continue;
        }

        for (const contentItem of outputRecord.content) {
            const contentRecord = asRecord(contentItem);

            if (contentRecord?.type !== 'output_text') {
                continue;
            }

            const text = readString(contentRecord.text);

            if (text) {
                textParts.push(text);
            }
        }
    }

    return textParts.join('\n');
}

function readUsage(value: unknown): ModelUsage | undefined {
    const record = asRecord(value);
    const usage = asRecord(record?.usage);
    const inputTokens = readNumber(usage?.input_tokens);
    const outputTokens = readNumber(usage?.output_tokens);

    if (inputTokens === undefined && outputTokens === undefined) {
        return undefined;
    }

    return {
        inputTokens,
        outputTokens,
    };
}

export class DeepSeekResponsesProvider implements ModelProvider {
    readonly id = 'deepseek' as const;

    private readonly responsesUrl: string;
    private readonly reasoningEffort: DeepSeekReasoningEffort;

    constructor(
        options: DeepSeekResponsesProviderOptions = {},
    ) {
        const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

        this.responsesUrl = `${baseUrl.replace(/\/+$/, '')}/responses`;
        this.reasoningEffort = options.reasoningEffort ?? 'high';
    }

    async complete(
        request: Parameters<ModelProvider['complete']>[0],
        apiKey: string,
        signal?: AbortSignal,
    ): Promise<ModelResponse> {
        const normalizedApiKey = apiKey.trim();

        if (!normalizedApiKey) {
            throw new DeepSeekRequestError(
                '没有输入DeepSeek API key',
                'missing-api-key',
            );
        }

        if (!/^[\x21-\x7e]+$/.test(normalizedApiKey)) {
            throw new DeepSeekRequestError(
                'DeepSeek API key包含中文、空格或换行,请重新复制纯key',
                'invalid-api-key',
            );
        }

        let response: Response;

        try {
            response = await fetch(this.responsesUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${normalizedApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: request.modelId,
                    input: request.messages.map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                    reasoning: {
                        effort: this.reasoningEffort,
                    },
                    max_output_tokens: request.maxOutputTokens,
                    temperature: request.temperature,
                    text: request.structuredOutput
                        ? {
                            format: {
                                type: 'json_schema',
                                name: request.structuredOutput.name,
                                schema: request.structuredOutput.schema,
                                strict: true,
                            },
                        }
                        : {
                            format: {
                                type: 'text',
                            },
                        },
                    stream: false,
                }),
                signal,
            });
        } catch (error) {
            if (signal?.aborted) {
                throw error;
            }

            throw new DeepSeekRequestError(
                'DeepSeek网络请求失败,请检查网络连接',
                'network-error',
            );
        }

        let responseBody: unknown;

        try {
            responseBody = await response.json();
        } catch {
            throw new DeepSeekRequestError(
                `DeepSeek返回了无法解析的响应,HTTP ${response.status}`,
                'invalid-json',
                response.status,
            );
        }

        if (!response.ok) {
            throw new DeepSeekRequestError(
                readErrorMessage(responseBody)
                    ?? `DeepSeek请求失败,HTTP ${response.status}`,
                'http-error',
                response.status,
                readErrorCode(responseBody),
            );
        }

        const responseRecord = asRecord(responseBody);
        const responseStatus = readString(responseRecord?.status);

        if (responseStatus === 'failed') {
            throw new DeepSeekRequestError(
                readErrorMessage(responseBody)
                    ?? 'DeepSeek生成失败',
                'response-failed',
                response.status,
                readErrorCode(responseBody),
            );
        }

        const incompleteDetails = asRecord(
            responseRecord?.incomplete_details,
        );
        const incompleteReason = readString(incompleteDetails?.reason);

        if (responseStatus === 'incomplete') {
            throw new DeepSeekRequestError(
                incompleteReason
                    ? `DeepSeek输出未完成:${incompleteReason}`
                    : 'DeepSeek输出未完成',
                'response-incomplete',
                response.status,
            );
        }

        const text = readOutputText(responseBody);

        if (!text) {
            throw new DeepSeekRequestError(
                'DeepSeek响应中没有可用的输出文本',
                'missing-output-text',
                response.status,
            );
        }

        return {
            text,
            stopReason: readString(incompleteDetails?.reason)
                ?? responseStatus,
            usage: readUsage(responseBody),
        };
    }
}
