export type ModelProviderId =
    | 'openai'
    | 'anthropic'
    | 'gemini'
    | 'deepseek'
    | 'openAiCompatible';

export type ModelMessageRole =
    | 'system'
    | 'user'
    | 'assistant';

export type ModelMessage = {
    role: ModelMessageRole;
    content: string;
};

export type StructuredOutputDefinition = {
    name: string;
    schema: Record<string, unknown>;
};

export type ModelRequest = {
    modelId: string;
    messages: readonly ModelMessage[];
    maxOutputTokens?: number;
    temperature?: number;
    structuredOutput?: StructuredOutputDefinition;
};

export type ModelUsage = {
    inputTokens?: number;
    outputTokens?: number;
};

export type ModelResponse = {
    text: string;
    stopReason?: string;
    usage?: ModelUsage;
};

export interface ModelProvider {
    readonly id: ModelProviderId;

    complete(
        request: ModelRequest,
        apiKey: string,
        signal?: AbortSignal,
    ): Promise<ModelResponse>;
}
