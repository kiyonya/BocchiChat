import { EventEmitter } from "events";
import { type EXChatCompletionMessage } from "../types.ts";
import ToolBase from "./tool.ts";
import OpenAI from 'openai'

export interface AgentLimitMemory {
    latestActiveTime: number,
    chatId: string,
    messages: EXChatCompletionMessage[]
}

export default class AgentBase<AP extends Record<string, any>, AR = any> extends ToolBase<AP, AR> {

    public agentSystemMessage: string = ''
    public openAIClient: OpenAI
    public responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema = { type: 'text' }
    public agentTools: ToolBase[] = []

    constructor(agentName: string, description?: string, openAIClient?: OpenAI) {
        super(`agent_${agentName}`)

        if (openAIClient) { this.openAIClient = openAIClient }
        else {
            this.openAIClient = new OpenAI({
                baseURL: process.env.BASE_URL,
                apiKey: process.env.APIKEY,
            })
        }

        super.defineExecutor(async (agentSitimulationParams): Promise<AR> => {

            const chatId = crypto.randomUUID()

            try {
                const session = new AgentChatSession(this.openAIClient as OpenAI, chatId)
                session.on.bind(this.emit)
                session.responseFormat = this.responseFormat
                session.systemMessage = this.agentSystemMessage
                session.tools = this.agentTools

                const response = await session.chatStream(agentSitimulationParams.input)

                if (response.choices[0].message.content) {
                    //这里可能解析出错
                    const data = this.responseFormat.type === 'json_object' || this.responseFormat.type === 'json_schema' ? JSON.parse(response.choices[0].message.content) : response.choices[0].message.content
                    return data
                }
                else {
                    throw new Error("调用失败,缺少返回内容")
                }
            } catch (error) {
                throw error
            }
        })

        super.defineParameters([
            {
                name: 'input',
                type: 'string',
                description: "你希望这个Agent做的事情",
                required: true
            }
        ])

        description && super.defineDescription(description)
    }

    public defineSystemMessage(systemMessage: string) {
        this.agentSystemMessage = systemMessage
    }

    public defineResponseFormat(responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema) {
        this.responseFormat = responseFormat
    }

    public defineAgentTools(tools: ToolBase[]) {
        this.agentTools = tools
    }
}

class AgentChatSession extends EventEmitter {
    private openAIClient: OpenAI
    public memory: AgentLimitMemory
    public tools: ToolBase[] = []
    public chatId: string

    public responseFormat:
        OpenAI.ResponseFormatText |
        OpenAI.ResponseFormatJSONObject |
        OpenAI.ResponseFormatJSONSchema = { type: 'text' }

    public systemMessage: string = ''
    constructor(openAIClient: OpenAI, chatId: string) {
        super()
        this.openAIClient = openAIClient
        this.chatId = chatId
        this.memory = {
            chatId: chatId,
            latestActiveTime: Date.now(),
            messages: []
        }
    }

    public async chat(userMessage: string): Promise<OpenAI.Chat.ChatCompletion> {
        this.memory.latestActiveTime = Date.now();
        this.pushMemory({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        })

        try {
            return await this.chatRecursive();
        } catch (error) {
            throw error
        }
    }

    private async chatRecursive(): Promise<OpenAI.Chat.ChatCompletion> {
        const tools = this.toOpenAIToolList();

        const openaiChatCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 2048,
            temperature: 0.3,
            messages: this.buildMessageWithContext(),
            response_format: this.responseFormat,
            tools: tools,
            tool_choice: 'auto',
        }

        const completion = await this.openAIClient.chat.completions.create(openaiChatCreateOptions);

        const choice = completion.choices[0];

        if (choice && choice.message) {
            const assistantMsg: EXChatCompletionMessage = {
                role: 'assistant',
                content: choice.message.content || '',
                tool_calls: choice.message.tool_calls,
                chatTime: Date.now()
            };

            this.pushMemory(assistantMsg)

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

                        this.pushMemory(toolMsg);
                    }
                }

                return await this.chatRecursive();
            }
        }
        return completion;
    }

    public async chatStream(userMessage: string, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {
        this.memory.latestActiveTime = Date.now();

        this.pushMemory({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        })

        // 使用递归处理函数调用
        try {
            return await this.chatStreamRecursive(onResponse);
        } catch (error) {
            this.emit('error', error)
            throw error
        }
    }

    private async chatStreamRecursive(onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {
        const tools = this.toOpenAIToolList();

        const openaiChatStreamCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: 0.3,
            messages: this.buildMessageWithContext(),
            stream: true,
            response_format: this.responseFormat,
            tools: tools,
            prompt_cache_retention: '24h',
            tool_choice: 'auto',
        }

        this.emit('chatCreate', openaiChatStreamCreateOptions)

        const chatStream = await this.openAIClient.chat.completions.create(openaiChatStreamCreateOptions);

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


                this.emit('responseDelta', event, delta, responseContent)

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

        this.pushMemory(assistantMessage)

        if ((finishReason === 'tool_calls' || toolCalls.length > 0)) {

            const callResultEventEmittersMap: Record<string, EventEmitter> = {}

            for (const toolCall of toolCalls) {
                if (toolCall.type === 'function') {
                    try {

                        const callEventEmitter = new EventEmitter()
                        callResultEventEmittersMap[toolCall.id] = callEventEmitter

                        const callName = toolCall.function.name;
                        const callArguments = JSON.parse(toolCall.function.arguments);

                        this.emit('toolCall', callName, callArguments)

                        const callResult = await this.handelToolCall(callName, callArguments);

                        this.pushMemory({
                            role: 'tool',
                            content: typeof callResult === 'string'
                                ? callResult
                                : JSON.stringify(callResult),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        })

                    } catch (error) {
                        this.emit('toolCallError', error)
                        this.pushMemory({
                            role: 'tool',
                            content: JSON.stringify({ error: 'Failed to execute function arguments parse error' }),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        })
                    }
                }
            }

            return await this.chatStreamRecursive(onResponse);
        }

        const chatCompletion: OpenAI.Chat.Completions.ChatCompletion = {
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
        }

        
        this.emit('response', chatCompletion)

        return chatCompletion

    }

    public async handelToolCall(toolName: string, parameters: Record<string, any>) {
        const callFunction = this.tools.find(i => i.toolName === toolName);
        if (callFunction) {
            try {

                const onToolCall = (...args: any[]) => {
                    this.emit('toolCallEvent', toolName, ...args)
                }

                callFunction.addListener('runtimeEvent', (...args) => onToolCall(...args))
                const result = await callFunction.execute(parameters);
                callFunction.removeListener('runtimeEvent', onToolCall)

                this.emit('toolCallEnd', result)
                return result
            } catch (error) {
                this.emit('toolCallError', error)
                return JSON.stringify({ error: `Function ${toolName} execution failed.` });
            }
        }
        return JSON.stringify({ error: `Function ${toolName} not found.` });
    }

    protected buildMessageWithContext(): OpenAI.Chat.ChatCompletionMessageParam[] {
        const maxTokens = 10;
        const systemMessage = this.systemMessage

        const recentHistory = this.memory.messages.slice(-(maxTokens * 2));

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

    private pushMemory(context: EXChatCompletionMessage) {
        this.memory.messages.push(context)
        this.emit('chatContextUpdate', context)
    }

    private toOpenAIToolList(): OpenAI.Chat.ChatCompletionFunctionTool[] | undefined {
        if (this.tools.length === 0) return undefined;
        return this.tools.map(i => i.toOpenAITool())
    }
}