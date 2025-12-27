import EventEmitter from "events";
import OpenAI from "openai"

export interface ToolParameter<T = any> {
    name: keyof T & string,
    type: "string" | "number" | "integer" | "boolean" | "array" | "object",
    description: string,
    required?: boolean,
    enum?: any[]
}

export interface ToolEvents {
    runtimeEvent: (...args: any[]) => void,

}

export default class ToolBase<TParams extends Record<string, any> = any, TResult = any> extends EventEmitter {

    on<K extends keyof ToolEvents>(
        event: K,
        listener: ToolEvents[K]
    ): this {
        return super.on(event as string, listener);
    }

    once<K extends keyof ToolEvents>(
        event: K,
        listener: ToolEvents[K]
    ): this {
        return super.once(event as string, listener);
    }

    emit<K extends keyof ToolEvents>(
        event: K,
        ...args: Parameters<(ToolEvents)[K]>
    ): boolean {
        return super.emit(event as string, ...args);
    }

    public parameters: ToolParameter<TParams>[] = [];
    public toolName: string = 'default_tool';
    public toolDescription: string = '';

    protected executor: ((params: TParams) => Promise<TResult>) | null = null;

    constructor(toolName: string) {
        super()
        this.toolName = toolName;
    }

    public defineParameters(parameters: ToolParameter<TParams>[]): this {
        this.parameters = parameters;
        return this;
    }

    public defineDescription(description: string): this {
        this.toolDescription = description;
        return this;
    }

    public defineExecutor(executor: (params: TParams) => Promise<TResult>): this {
        this.executor = executor;
        return this;
    }

    public async execute(parameters: TParams): Promise<TResult> {
        try {
            this.validateParameters(parameters);

            if (this.executor) {
                return await this.executor(parameters);
            }

            throw new Error(`No executor defined for tool ${this.toolName}`);
        } catch (error) {
            console.error(`Error executing tool ${this.toolName}:`, error);
            throw error;
        }
    }

    protected validateParameters(parameters: TParams): void {
        const requiredParams = this.parameters
            .filter(param => param.required ?? true)
            .map(param => param.name);

        for (const requiredParam of requiredParams) {
            if (!(requiredParam in parameters)) {
                throw new Error(`Missing required parameter: ${requiredParam}`);
            }
        }
    }

    public toOpenAITool(): OpenAI.Chat.ChatCompletionFunctionTool {
        const chatCompletionFunctionTool: OpenAI.Chat.ChatCompletionFunctionTool = {
            type: 'function',
            function: {
                name: this.toolName,
                description: this.toolDescription
            }
        };

        const properties: Record<string, any> = {};
        const requiredParams: string[] = [];

        for (const param of this.parameters) {
            const paramName = param.name;
            properties[paramName] = {
                type: param.type,
                description: param.description,
                ...(param.enum ? { enum: param.enum } : {})
            };
            if (param.required ?? true) {
                requiredParams.push(paramName);
            }
        }

        chatCompletionFunctionTool.function.parameters = {
            type: "object",
            properties: properties,
            ...(requiredParams.length > 0 && { required: requiredParams })
        };

        return chatCompletionFunctionTool;
    }
}