export async function readSecret(prompt) {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY || !output.isTTY || !input.setRawMode) {
        throw new Error('当前终端不支持隐藏输入');
    }

    const wasRaw = Boolean(input.isRaw);

    return new Promise((resolve, reject) => {
        let value = '';
        let finished = false;

        const cleanup = () => {
            input.off('data', onData);
            input.setRawMode(wasRaw);

            if (!wasRaw) {
                input.pause();
            }

            output.write('\n');
        };

        const finish = (result, error) => {
            if (finished) {
                return;
            }

            finished = true;
            cleanup();

            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        };

        const onData = (chunk) => {
            for (const character of chunk) {
                if (character === '\u0003') {
                    finish('', new Error('用户取消输入'));
                    return;
                }

                if (character === '\r' || character === '\n') {
                    finish(value);
                    return;
                }

                if (
                    character === '\u007f'
                    || character === '\b'
                ) {
                    value = value.slice(0, -1);
                    continue;
                }

                if (character >= ' ') {
                    value += character;
                }
            }
        };

        output.write(prompt);
        input.setEncoding('utf8');
        input.setRawMode(true);
        input.resume();
        input.on('data', onData);
    });
}