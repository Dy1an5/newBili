import type {
    ModelMessage,
    StructuredOutputDefinition,
} from './modelProvider';

export type PromptSpec<Input, Output> = {
    readonly id: string;
    readonly version: number;
    readonly structuredOutput: StructuredOutputDefinition;
    readonly maxOutputTokens?: number;
    readonly temperature?: number;

    buildMessages(input: Input): readonly ModelMessage[];

    parseOutput(value: unknown, input: Input): Output;
};
