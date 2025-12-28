import OpenAI from "openai";
import { type EXChatCompletionMessage, type ModelChatOptions } from "../types.ts";
import ToolBase from "./tool.ts";
import EventEmitter from "node:events";
import path from "node:path";
import fs from 'fs'
import { createTool } from "./entry.ts";
import chalk from "chalk";

interface SentimentPrompt {
    sentiment: string,
    prompt: string
}

interface BotEvents {
    toolCall: (toolName: string, toolParams: any) => void;
    toolCallError: (toolCallError: unknown) => void;
    toolCallEnd: (toolCallEnd: any) => void;
    toolCallEvent: (toolName: string, ...args: any[]) => void;
    response: (completion: OpenAI.Chat.Completions.ChatCompletion) => void;
    responseDelta: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void;
    chatCreate: (chatCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming) => void;
    chatContextUpdate: (context: EXChatCompletionMessage) => void;
    error: (error: unknown) => void;
    clearContext: () => void;
    newChat: (chatId: string) => void;
}

export default class BotBase<S extends string = string> extends EventEmitter {

    public static readonly DEFAULT_ROLE_PROMPT = `你是一个AI助手，今天是${new Date().toLocaleDateString()}`

    on<K extends keyof BotEvents>(
        event: K,
        listener: BotEvents[K]
    ): this {
        return super.on(event, listener);
    }

    once<K extends keyof BotEvents>(
        event: K,
        listener: BotEvents[K]
    ): this {
        return super.once(event, listener);
    }

    emit<K extends keyof BotEvents>(
        event: K,
        ...args: Parameters<BotEvents[K]>
    ): boolean {
        return super.emit(event, ...args);
    }

    public openAIClient: OpenAI
    public chatId: string

    public botMemories: {
        latestActiveTime: number,
        chatId: string,
        messages: EXChatCompletionMessage[],
        system: string
    }

    public botChatOptions?: ModelChatOptions

    public botId: string
    public responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema = { type: 'text' }

    //
    public botRolePrompt: string = ''
    public helloText: string = ''
    //
    public isAISentimentSwitchEnable: boolean = false
    public currentSentiment: string | null = null
    public botSentiments: Record<string, SentimentPrompt> = {}
    //
    public definedTools: ToolBase[] = []
    //
    private innerSwitchSentiment: ToolBase | null = null
    private innerClearSentiment: ToolBase | null = null
    //
    private bindMemoriesFile?: string

    constructor(botId: string, OpenAIClient?: OpenAI, memoryFile?: string, botCreateOptions?: ModelChatOptions) {
        super()
        this.botId = botId
        this.botChatOptions = botCreateOptions
        this.openAIClient = OpenAIClient || new OpenAI({
            baseURL: process.env.BASE_URL,
            apiKey: process.env.APIKEY,
        })
        this.chatId = crypto.randomUUID()
        this.botMemories = {
            chatId: this.chatId,
            messages: [],
            latestActiveTime: Date.now(),
            system: ''
        }

        if (memoryFile) {
            this.bindMemoriesFile = memoryFile
            const isImported = this.importMemoryFromFile(this.bindMemoriesFile)
            if (isImported) {
                console.log(chalk.bgBlue.white(`${this.botId} 已使用记忆文件 ${memoryFile}`))
            }
        }

        this.helloText && console.log(this.helloText)
    }

    public useSystemMessage(systemMessage: string) {
        this.botRolePrompt = systemMessage
    }
    /**
     * @deprecated
     * @param systemMessage 
     */
    public defineSystemMessage(systemMessage: string) {
        this.botRolePrompt = systemMessage
    }

    public defineResponseFormat(responseFormat: OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema) {
        this.responseFormat = responseFormat
    }

    public defineSentiment<TSentiment extends S | string>(sentiments: Record<TSentiment, SentimentPrompt>) {
        this.botSentiments = sentiments as Record<S, SentimentPrompt>;
    }

    public enableAISentimentSwitch(state: boolean = false) {
        this.isAISentimentSwitchEnable = state
    }

    public defineHelloText(helloText: string) {
        this.helloText = helloText
    }

    public defineTools(tools: ToolBase[]) {
        this.definedTools = tools
    }

    public defineRolePrompt(role: string) {
        this.botRolePrompt = role
    }

    public buildTools(): ToolBase[] {
        const tools: ToolBase[] = []
        //注册情感转换工具
        if (this.isAISentimentSwitchEnable) {
            this.innerSwitchSentiment = createTool<{ sentiment: S }, {}>('bot_inner_switchSentiment', async (sentimentParams) => {
                this.switchSentiment(sentimentParams.sentiment)
                return {}
            }, {
                description: "修改你当前的情绪类型，如果你希望恢复正常程序，请使用bot_inner_clearSentiment",
                parameters: [{
                    name: 'sentiment',
                    required: true,
                    description: "你希望的情绪类型",
                    type: 'string',
                    enum: Object.keys(this.botSentiments) as S[]
                }]
            })
            tools.push(this.innerSwitchSentiment)

            this.innerClearSentiment = createTool<{}, {}>('bot_inner_clearSentiment', async () => {
                this.clearSentiment()
                return {}
            }, {
                description: "清除当前的情绪，恢复正常的自己,函数没有返回结果",
                parameters: []
            })
            tools.push(this.innerClearSentiment)
        }
        tools.push(...this.definedTools)
        return tools
    }

    public async chat(userMessage: string, onRecursiveStep?: (message: EXChatCompletionMessage) => void): Promise<OpenAI.Chat.ChatCompletion> {
        this.botMemories.latestActiveTime = Date.now();
        this.botMemories.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        });

        try {
            return await this.chatRecursive();
        } catch (error) {
            this.emit('error', error)
            throw error
        }
    }

    private async chatRecursive(): Promise<OpenAI.Chat.ChatCompletion> {

        //当前这一轮的工具
        const tools = this.buildTools();

        const openaiChatCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botChatOptions?.temperature || 0.3,
            messages: this.buildMessageWithMemory(),
            response_format: this.responseFormat,
            tools: tools.map(i => i.toOpenAITool()),
            tool_choice: 'auto',
            parallel_tool_calls: true
        }

        this.emit('chatCreate', openaiChatCreateOptions)

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
            this.emit('response', completion)

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

                        this.emit('toolCall', callName, callArguments)
                        const callResult = await this.handelToolCall(tools, callName, callArguments);

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
        this.botMemories.latestActiveTime = Date.now();
        this.botMemories.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        });

        // 使用递归处理函数调用
        try {
            return await this.chatStreamRecursive(onResponse);
        } catch (error) {
            this.emit('error', error)
            throw error
        }
    }

    private async chatStreamRecursive(onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {

        const tools = this.buildTools()

        const openaiChatStreamCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botChatOptions?.temperature || 0.3,
            messages: this.buildMessageWithMemory(),
            stream: true,
            response_format: this.responseFormat,
            tools: tools.map(i => i.toOpenAITool()),
            prompt_cache_retention: '24h',
            tool_choice: 'auto',
            parallel_tool_calls: true
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

            for (const toolCall of toolCalls) {
                if (toolCall.type === 'function') {
                    try {

                        const callName = toolCall.function.name;
                        const callArguments = JSON.parse(toolCall.function.arguments);

                        this.emit('toolCall', callName, callArguments)

                        const callResult = await this.handelToolCall(tools, callName, callArguments);

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

    public async handelToolCall(toolList: ToolBase[] = [], toolName: string, parameters: Record<string, any>, callEventEmitter?: EventEmitter) {
        const callFunction = toolList.find(i => i.toolName === toolName);
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

    protected buildMessageWithMemory(): OpenAI.Chat.ChatCompletionMessageParam[] {
        const maxTokens = this.botChatOptions?.max_context_length || 10;

        const recentHistory = this.botMemories.messages.slice(-(maxTokens * 2));

        const openaiMessage: OpenAI.Chat.ChatCompletionMessageParam[] = []

        openaiMessage.push({
            role: 'system',
            content: this.buildSystemMessage()
        })

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

    public buildSystemMessage(): string {
        let systemMessage = `${this.botRolePrompt || BotBase.DEFAULT_ROLE_PROMPT}`
        if (this.currentSentiment) {
            const sentimentPrompt: SentimentPrompt = this.botSentiments[this.currentSentiment]
            if (sentimentPrompt?.prompt) {
                systemMessage += `\n你现在的心情是${sentimentPrompt.sentiment},${sentimentPrompt.prompt}`
            }
        }
        //更新系统存储
        this.botMemories.system = systemMessage
        return systemMessage
    }

    public switchSentiment(sentiment: S): void {
        if (!Object.keys(this.botSentiments).length) {
            throw new Error("你没有可以切换的情绪")
        }
        if (!this.botSentiments[sentiment]) {
            throw new Error(`情绪${sentiment}没有被定义`)
        }
        this.currentSentiment = sentiment
    }

    public clearSentiment(): void {
        this.currentSentiment = null
    }

    private pushMemory(context: EXChatCompletionMessage) {
        this.botMemories.messages.push(context)

        this.emit('chatContextUpdate', context)
        if (this.bindMemoriesFile) {
            const dirname = path.dirname(this.bindMemoriesFile)
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true })
            }
            fs.writeFileSync(this.bindMemoriesFile, JSON.stringify(this.botMemories, null, 4), 'utf-8')
        }
    }

    public importMemoryFromFile(filePath: string) {
        if (fs.existsSync(filePath)) {
            this.botMemories = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            return true
        }
        return false
    }

    public exportMemoriesToFile(filePath: string) {
        const dirname = path.dirname(filePath)
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true })
        }
        fs.writeFileSync(filePath, JSON.stringify(this.botMemories, null, 4), 'utf-8')
    }

    public clearMemories() {
        this.botMemories.messages = []
        this.botMemories.latestActiveTime = Date.now()
        this.emit('clearContext')
    }

    public listMemories() {
        return this.botMemories
    }

    public newChat() {
        this.clearMemories()
        this.chatId = crypto.randomUUID()
        this.emit('newChat', this.chatId)
        if (this.helloText) {
            console.log(this.helloText)
        }
    }


}