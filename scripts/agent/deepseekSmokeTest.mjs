import { readSecret } from './readSecret.mjs';
import {
    DeepSeekResponsesProvider,
} from '../../src/agent/provider/deepseekResponsesProvider.ts';

const MODEL_ID = 'deepseek-v4-flash';

async function main() {
    let apiKey = '';

    try {
        apiKey = await readSecret('请输入DeepSeek API key:');

        if (!apiKey.trim()) {
            throw new Error('API key不能为空');
        }

        const provider = new DeepSeekResponsesProvider({
            reasoningEffort: 'high',
        });

        console.log('正在请求DeepSeek...');

        const response = await provider.complete(
            {
                modelId: MODEL_ID,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个严谨的中文助手.',
                    },
                    {
                        role: 'user',
                        content: '请用一句话说明你已经成功收到这条消息.',
                    },
                ],
                maxOutputTokens: 1024,
            },
            apiKey,
        );

        console.log('\n模型回复:');
        console.log(response.text);

        console.log('\n停止原因:');
        console.log(response.stopReason ?? '未知');

        if (response.usage) {
            console.log('\nToken用量:');
            console.log({
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
            });
        }
    } finally {
        apiKey = '';
    }
}

main().catch((error) => {
    const message = error instanceof Error
        ? error.message
        : '发生未知错误';

    console.error('\n请求失败:');
    console.error(message);
    process.exitCode = 1;
});