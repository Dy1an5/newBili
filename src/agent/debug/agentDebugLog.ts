const LOG_PREFIX = '[VideoSummary]';

export function logAgentDebug(
    event: string,
    data?: Record<string, unknown>,
): void {
    if (!__DEV__) {
        return;
    }

    if (data) {
        console.log(`${LOG_PREFIX} ${event}`, data);
        return;
    }

    console.log(`${LOG_PREFIX} ${event}`);
}
