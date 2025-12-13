export interface AdapterBridge {
    execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface ToolCallMessage {
    id: string;
    name: string;
    params?: Record<string, unknown>;
}

export interface ToolResultMessage {
    id: string;
    result: {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
    };
}

export type AdapterBridgeRegistry = Map<string, AdapterBridge>;

