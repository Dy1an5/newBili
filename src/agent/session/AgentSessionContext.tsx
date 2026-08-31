import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

type AgentSessionContextValue = {
    deepSeekApiKey: string | null;
    setDeepSeekApiKey: (apiKey: string) => void;
    clearDeepSeekApiKey: () => void;
};

const AgentSessionContext = createContext<AgentSessionContextValue | null>(null);

export function AgentSessionProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [deepSeekApiKey, setDeepSeekApiKeyState] = useState<string | null>(null);

    const setDeepSeekApiKey = useCallback((apiKey: string) => {
        const normalizedApiKey = apiKey.trim();

        setDeepSeekApiKeyState(normalizedApiKey || null);
    }, []);

    const clearDeepSeekApiKey = useCallback(() => {
        setDeepSeekApiKeyState(null);
    }, []);

    const value = useMemo<AgentSessionContextValue>(() => ({
        deepSeekApiKey,
        setDeepSeekApiKey,
        clearDeepSeekApiKey,
    }), [
        clearDeepSeekApiKey,
        deepSeekApiKey,
        setDeepSeekApiKey,
    ]);

    return (
        <AgentSessionContext.Provider value={value}>
            {children}
        </AgentSessionContext.Provider>
    );
}

export function useAgentSession(): AgentSessionContextValue {
    const context = useContext(AgentSessionContext);

    if (!context) {
        throw new Error('useAgentSession必须在AgentSessionProvider中使用');
    }

    return context;
}
