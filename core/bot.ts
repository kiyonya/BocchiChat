import OpenAI from "openai";
import { type EXChatCompletionMessage, type ChatBotCreateOptions } from "../types.ts";
import FunctionBase from "./function.ts";

export default class BotBase {
    public openAIClient: OpenAI
    public chatId: string

    public chatContexts: {
        latestActiveTime: number,
        chatId: string,
        messages: EXChatCompletionMessage[]
    }

    public botCreateOptions?: ChatBotCreateOptions
    public systemMessage: string = ''

    public botId: string
    public responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema = { type: 'text' }

    public botFunctions: FunctionBase[] = []

    constructor(botId: string, botCreateOptions?: ChatBotCreateOptions) {
        this.botId = botId
        this.botCreateOptions = botCreateOptions
        this.openAIClient = new OpenAI({
            baseURL: process.env.BASE_URL,
            apiKey: process.env.APIKEY,
        })
        this.chatId = crypto.randomUUID()
        this.chatContexts = {
            chatId: this.chatId,
            messages: [],
            latestActiveTime: Date.now()
        }
    }

    public useSystemMessage(systemMessage: string) {
        this.systemMessage = systemMessage
    }

    public defineResponseFormat(responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema) {
        this.responseFormat = responseFormat
    }

    public defineFunctions(functions: FunctionBase[]) {
        this.botFunctions = functions
    }

    private toOpenAIToolList(): OpenAI.Chat.ChatCompletionFunctionTool[] | undefined {
        if (this.botFunctions.length === 0) return undefined;
        return this.botFunctions.map(i => i.toOpenAITool())
    }

    public async chat(userMessage: string, onRecursiveStep?: (message: EXChatCompletionMessage) => void): Promise<OpenAI.Chat.ChatCompletion> {
        this.chatContexts.latestActiveTime = Date.now();
        this.chatContexts.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        });

        return await this.chatRecursive(onRecursiveStep);
    }

    private async chatRecursive(onRecursiveStep?: (message: EXChatCompletionMessage) => void): Promise<OpenAI.Chat.ChatCompletion> {
        const tools = this.toOpenAIToolList();

        const completion = await this.openAIClient.chat.completions.create({
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botCreateOptions?.temperature || 0.3,
            messages: this.buildMessageWithContext(),
            response_format: this.responseFormat,
            tools: tools,
            tool_choice: 'auto',

        });

        const choice = completion.choices[0];

        if (choice && choice.message) {
            const assistantMsg: EXChatCompletionMessage = {
                role: 'assistant',
                content: choice.message.content || '',
                tool_calls: choice.message.tool_calls,
                chatTime: Date.now()
            };

            this.chatContexts.messages.push(assistantMsg);

            onRecursiveStep && onRecursiveStep(assistantMsg);

            if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
                for (const toolCall of choice.message.tool_calls) {
                    if (toolCall.type === 'function') {
                        const callName = toolCall.function.name;
                        let callArguments = {};
                        try {
                            callArguments = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error("参数解析失败", e);
                        }

                        const callResult = await this.handelToolCall(callName, callArguments);

                        const toolMsg: EXChatCompletionMessage = {
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            content: typeof callResult === 'string'
                                ? callResult
                                : JSON.stringify(callResult),
                            chatTime: Date.now()
                        };

                        this.chatContexts.messages.push(toolMsg);
                        onRecursiveStep && onRecursiveStep(toolMsg);
                    }
                }

                return await this.chatRecursive(onRecursiveStep);
            }
        }
        return completion;
    }

    public async handelToolCall(functionName: string, parameters: Record<string, any>) {
        const callFunction = this.botFunctions.find(i => i.functionName === functionName);
        if (callFunction) {
            try {
                return await callFunction.execute(parameters);
            } catch (error) {
                console.error(`执行函数 ${functionName} 出错:`, error);
                return JSON.stringify({ error: `Function ${functionName} execution failed.` });
            }
        }
        return JSON.stringify({ error: `Function ${functionName} not found.` });
    }

    public async chatStream(userMessage: string, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {
        this.chatContexts.latestActiveTime = Date.now();
        this.chatContexts.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        });

        // 使用递归处理函数调用
        return await this.chatStreamRecursive(onResponse);
    }

    private async chatStreamRecursive(onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {
        const tools = this.toOpenAIToolList();

        const chatStream = await this.openAIClient.chat.completions.create({
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botCreateOptions?.temperature || 0.3,
            messages: this.buildMessageWithContext(),
            stream: true,
            response_format: this.responseFormat,
            tools: tools,
            prompt_cache_retention: '24h',
            tool_choice: 'auto',
        });

        let responseContent = '';
        let usage: OpenAI.CompletionUsage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        };

        const toolCallsMap: Record<number, OpenAI.Chat.Completions.ChatCompletionMessageToolCall> = {};
        let finishReason: OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0]['finish_reason'] = null;

        for await (const event of chatStream) {
            if (event.usage) {
                usage = {
                    prompt_tokens: event.usage.prompt_tokens || 0,
                    completion_tokens: event.usage.completion_tokens || 0,
                    total_tokens: event.usage.total_tokens || 0
                };
            }

            const choice = event.choices[0];
            if (!choice) continue;

            if (choice.finish_reason) {
                finishReason = choice.finish_reason;
            }

            if (choice.delta.content) {
                const delta = choice.delta.content;
                responseContent += delta;
                if (onResponse) {
                    onResponse(event, delta, responseContent);
                }
            }

            if (choice.delta.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                    const index = toolCallDelta.index;

                    if (!toolCallsMap[index]) {
                        toolCallsMap[index] = {
                            id: toolCallDelta.id || '',
                            type: 'function',
                            function: {
                                name: toolCallDelta.function?.name || '',
                                arguments: toolCallDelta.function?.arguments || ''
                            }
                        };
                    } else {

                        if (toolCallDelta.function?.arguments && toolCallsMap[index].type === 'function') {
                            toolCallsMap[index].function.arguments += toolCallDelta.function.arguments;
                        }

                    }
                }
            }
        }

        const toolCalls = Object.values(toolCallsMap);

        const assistantMessage: EXChatCompletionMessage = {
            role: 'assistant',
            content: responseContent,
            chatTime: Date.now()
        };

        if (toolCalls.length > 0) {
            assistantMessage.tool_calls = toolCalls;
        }

        this.chatContexts.messages.push(assistantMessage);

        if ((finishReason === 'tool_calls' || toolCalls.length > 0)) {
            for (const toolCall of toolCalls) {
                if (toolCall.type === 'function') {
                    try {

                        const callName = toolCall.function.name;
                        const callArguments = JSON.parse(toolCall.function.arguments);

                        console.log(`\n> 我调用了函数${callName}\n`)

                        const callResult = await this.handelToolCall(callName, callArguments);

                        this.chatContexts.messages.push({
                            role: 'tool',
                            content: typeof callResult === 'string'
                                ? callResult
                                : JSON.stringify(callResult),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        });
                    } catch (error) {
                        console.error('Error handling tool call:', error);
                        this.chatContexts.messages.push({
                            role: 'tool',
                            content: JSON.stringify({ error: 'Failed to execute function arguments parse error' }),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        });
                    }
                }
            }

            return await this.chatStreamRecursive(onResponse);
        }

        return {
            id: this.chatId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: process.env.MODEL_NAME || 'gpt-4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: responseContent,
                        refusal: null,
                        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
                    },
                    finish_reason: finishReason || 'stop',
                    logprobs: null
                }
            ],
            usage: usage
        };
    }

    protected buildMessageWithContext(): OpenAI.Chat.ChatCompletionMessageParam[] {
        const maxTokens = this.botCreateOptions?.max_context_length || 10;
        const systemMessage = this.systemMessage

        const recentHistory = this.chatContexts.messages.slice(-(maxTokens * 2));

        const openaiMessage: OpenAI.Chat.ChatCompletionMessageParam[] = []

        if (systemMessage) {
            openaiMessage.push({
                role: 'system',
                content: systemMessage
            })
        }

        for (const recent of recentHistory) {
            switch (recent.role) {
                case "developer":
                    openaiMessage.push({
                        role: 'developer',
                        content: recent.content,
                        name: recent.name
                    })
                    break
                case "user":
                    openaiMessage.push({
                        role: 'user',
                        content: recent.content,
                        name: recent.name
                    })
                    break
                case "assistant":
                    const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
                        role: 'assistant',
                        content: recent.content,
                        name: recent.name,
                    };
                    if (recent.tool_calls) {
                        assistantMsg.tool_calls = recent.tool_calls;
                    }
                    openaiMessage.push(assistantMsg);
                    break
                case "tool":
                    openaiMessage.push({
                        role: 'tool',
                        content: recent.content,
                        tool_call_id: recent.tool_call_id
                    })
                    break
                default:

                    console.warn("Unrecognized message role encountered");
            }
        }
        return openaiMessage;
    }

    public clearContexts() {
        this.chatContexts.messages = []
        this.chatContexts.latestActiveTime = Date.now()
    }

    public listContexts() {
        return this.chatContexts
    }
}