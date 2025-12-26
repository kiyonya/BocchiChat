import OpenAI from "openai"

export interface ToolParameter<T = any> {
    name: keyof T & string,
    type: "string" | "number" | "integer" | "boolean" | "array" | "object",
    description: string,
    required?: boolean,
    enum?: any[]
}

export default class FunctionBase<TParams extends Record<string, any> = any, TResult = any> {
    public parameters: ToolParameter<TParams>[] = [];
    public functionName: string = 'default_function';
    public functionDescription: string = '';

    protected executor: ((params: TParams) => Promise<TResult>) | null = null;

    constructor(functionName: string) {
        this.functionName = functionName;
    }

    public defineParameters(parameters: ToolParameter<TParams>[]): this {
        this.parameters = parameters;
        return this;
    }

    public defineDescription(description: string): this {
        this.functionDescription = description;
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
            
            throw new Error(`No executor defined for function ${this.functionName}`);
        } catch (error) {
            console.error(`Error executing function ${this.functionName}:`, error);
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
                name: this.functionName,
                description: this.functionDescription
            }
        };

        const defineParams: OpenAI.FunctionParameters = {};
        const requiredParams: string[] = [];

        for (const param of this.parameters) {
            const paramName = param.name;
            defineParams[paramName] = {
                type: param.type,
                description: param.description,
                ...(param.enum ? {enum:param.enum} : {})
            };
            if (param.required ?? true) {
                requiredParams.push(paramName);
            }
        }

        chatCompletionFunctionTool.function.parameters = defineParams;

        if (requiredParams.length > 0) {
            chatCompletionFunctionTool.function.parameters.required = requiredParams;
        }

        return chatCompletionFunctionTool;
    }
}