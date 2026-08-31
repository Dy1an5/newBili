import type {
    ModelProvider,
    ModelProviderId,
    ModelUsage,
} from './modelProvider';
import type { PromptSpec } from './promptSpec';

export type AgentTaskResult<Output> = {
    output: Output;
    providerId: ModelProviderId;
    modelId: string;
    usage?: ModelUsage;
};

export class AgentTaskError extends Error {
    readonly rawOutput?: string;

    constructor(message: string, rawOutput?: string) {
        super(message);
        this.name = 'AgentTaskError';
        this.rawOutput = rawOutput;
    }
}

function parseModelJson(text: string): unknown {
    const normalizedText = text.trim();

    try {
        return JSON.parse(normalizedText);
    } catch {
        const fencedJson = normalizedText.match(
            /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
        );

        if (fencedJson) {
            try {
                return JSON.parse(fencedJson[1]);
            } catch {
                // 交给统一错误处理,并保留原始输出用于开发阶段排查.
            }
        }

        throw new AgentTaskError('模型没有返回有效的JSON', text);
    }
}

export async function runAgentTask<Input, Output>(
    provider: ModelProvider,
    prompt: PromptSpec<Input, Output>,
    input: Input,
    modelId: string,
    apiKey: string,
    signal?: AbortSignal,
): Promise<AgentTaskResult<Output>> {
    if (!modelId.trim()) {
        throw new AgentTaskError('没有配置模型ID');
    }

    if (!apiKey.trim()) {
        throw new AgentTaskError('没有配置API key');
    }

    const response = await provider.complete(
        {
            modelId,
            messages: prompt.buildMessages(input),
            maxOutputTokens: prompt.maxOutputTokens,
            temperature: prompt.temperature,
            structuredOutput: prompt.structuredOutput,
        },
        apiKey,
        signal,
    );

    const rawOutput = parseModelJson(response.text);

    const output = prompt.parseOutput(rawOutput, input);

    return {
        output,
        providerId: provider.id,
        modelId,
        usage: response.usage,
    };
}
