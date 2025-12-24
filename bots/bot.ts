import OpenAI from "openai";
import { type ChatBotCreateOptions, type ChatHistory } from "../types.ts";

export default abstract class BotBase {
    public openAIClient: OpenAI
    public chatId: string
    public chatContexts: ChatHistory
    public botCreateOptions?: ChatBotCreateOptions
    public systemMessage: string = ''
    public botId: string

    constructor(botId: string, botCreateOptions?: ChatBotCreateOptions) {
        this.botId = botId
        this.botCreateOptions = botCreateOptions
        this.openAIClient = new OpenAI({
            baseURL: process.env.BASE_URL,
            apiKey: process.env.APIKEY,
            organization: "kiyuu"
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

    public async chat(userMessage: string): Promise<OpenAI.Chat.ChatCompletion> {
        this.chatContexts.latestActiveTime = Date.now()
        this.chatContexts.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        })
        const completion = await this.openAIClient.chat.completions.create({
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botCreateOptions?.temperature || 0.3,
            messages: this.buildMessageWithContext(),
        });
        this.chatContexts.messages.push({
            role: 'assistant',
            content: completion.choices[0].message.content || '',
            chatTime: Date.now()
        })
        return completion
    }

    public async chatStream(userMessage: string, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string) => void): Promise<OpenAI.Chat.ChatCompletion> {
        this.chatContexts.latestActiveTime = Date.now()
        this.chatContexts.messages.push({
            role: 'user',
            content: userMessage,
            chatTime: Date.now()
        })
        const chatStream = await this.openAIClient.chat.completions.create({
            model: process.env.MODEL_NAME || 'gpt-4',
            max_completion_tokens: 1024,
            temperature: this.botCreateOptions?.temperature || 0.3,
            messages: this.buildMessageWithContext(),
            stream: true
        })
        let response = ''
        let usage: OpenAI.CompletionUsage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
        for await (const event of chatStream) {
            if (event.usage) {
                usage.prompt_tokens += event.usage.prompt_tokens || 0
                usage.completion_tokens += event.usage.completion_tokens || 0
                usage.total_tokens += event.usage.total_tokens || 0
            }
            if (event.choices[0]?.delta.content) {
                const ctx = event.choices[0].delta.content
                response += ctx
                if (onResponse) {
                    onResponse(event, ctx, response)
                }
            }
        }
        this.chatContexts.messages.push({
            role: 'assistant',
            content: response,
            chatTime: Date.now()
        })
        const completion: OpenAI.Chat.ChatCompletion = {
            id: this.chatId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: process.env.MODEL_NAME || 'gpt-4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: response,
                        refusal: null
                    },
                    finish_reason: 'stop',
                    logprobs: null
                }
            ],
            usage: usage
        }
        return completion
    }

    protected buildMessageWithContext(): OpenAI.Chat.ChatCompletionMessageParam[] {
        const maxTokens = this.botCreateOptions?.max_context_length || 10;
        const systemMessage = this.systemMessage
        const recentHistory = this.chatContexts.messages.slice(-(maxTokens * 2 - 1));
        const openaiMessage: OpenAI.Chat.ChatCompletionMessageParam[] = []
        openaiMessage.push({
            role: 'system',
            content: systemMessage
        })
        for (const recent of recentHistory) {
            openaiMessage.push({
                role: recent.role,
                content: recent.content,
            } as OpenAI.Chat.ChatCompletionMessageParam)
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

    public loadContexts(chatContexts: ChatHistory) {
        this.chatContexts = chatContexts
    }
}