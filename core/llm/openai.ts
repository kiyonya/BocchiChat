import OpenAI from "openai"
import { type CompletionMessage } from "../../types/types.ts"
import { LocalTool, MCPTool } from "../tool.ts"
import EventEmitter from "events"
import path from "path"
import { existify } from "../../utils/file.ts"
import { writeFileSync } from "fs"
import chalk from 'chalk'
import {cristal} from 'gradient-string'

export interface LLMRoleDefination {
    rolePrompt: string
    helloText?: string
}

export interface LLMSession {
    sessionId: number,
    messages: CompletionMessage[],
    usage: OpenAI.CompletionUsage
}
export interface LLMContexts {
    chatId: string,
    latestActive: number,
    sessions: LLMSession[]
}
export interface LLMModelOptions {
    temperature?: number,
    maxCompletionTokens?: number,
    maxSessionLength?: number,
    topP?: number,
    parallelToolCalls?: boolean
}
export interface LLMConfig {
     useDefaultSystemPromptHead?: boolean,
     useContextsSimplify?:boolean
}

interface OpenAILLMCreateOptions {
    name: string,
    llmContext?: LLMContexts,
    roleDefination?: LLMRoleDefination,
    llmModelOptions?: LLMModelOptions,
    openAIClient?: OpenAI,
    llmTools?:  Map<string, MCPTool | LocalTool>
    llmConfig?:LLMConfig
}

export default class OpenAILLM extends EventEmitter {

    public static readonly DEFAULT_ROLE_DEFINATION: LLMRoleDefination = {
        rolePrompt: '你是一个ai助手，你需要耐心回答用户的问题',
        helloText: ''
    }

    public name: string
    public llmContexts: LLMContexts
    public openAIClient: OpenAI
    public roleDefination: LLMRoleDefination
    public llmModelOptions?: LLMModelOptions
    public llmToolsMap: Map<string, MCPTool | LocalTool> = new Map()
    public builtToolCalls: OpenAI.Chat.ChatCompletionFunctionTool[] = []

    public llmConfig?:LLMConfig

    constructor(options: OpenAILLMCreateOptions) {
        super()

        this.name = options.name
        this.openAIClient = options.openAIClient || new OpenAI({
            baseURL:process.env.BASE_URL,
            apiKey:process.env.APIKEY
        })
        this.llmContexts = options.llmContext || this._createNewContext()
        this.roleDefination = options.roleDefination || OpenAILLM.DEFAULT_ROLE_DEFINATION
        this.llmModelOptions = options.llmModelOptions

        if (options.llmTools) {
            this.llmToolsMap = options.llmTools
            for(const tool of options.llmTools.values()){
                this.builtToolCalls.push(tool.toOpenAITool())
            }
        }
        console.log(cristal(`已注册工具 ${this.builtToolCalls.map(i=>i.function.name).join('  ')}`))
        this.llmConfig = options.llmConfig
    }

    public async chatStream(userPrompt: string, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string,
        payload: string,) => void, onSessionUpdate?: (dialogue: LLMSession) => void): Promise<LLMSession> {

        this.llmContexts.latestActive = Date.now()

        const session: LLMSession = {
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            },
            messages: [],
            sessionId: Date.now()
        }

        this.llmContexts.sessions.push(session)

        session.messages.push({
            role: 'user',
            content: userPrompt,
            chatTime: Date.now()
        })

        if (onSessionUpdate) {
            onSessionUpdate(session)
        }

        const completion = await this._chatStreamRecursive(session, onResponse, onSessionUpdate)
        if(completion.usage){
            session.usage = completion.usage
        }
        if (onSessionUpdate) {
            onSessionUpdate(session)
        }

        return session
    }

    private async _chatStreamRecursive(session: LLMSession, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string,) => void, onSessionUpdate?: (session: LLMSession) => void): Promise<OpenAI.Chat.ChatCompletion> {

        const openaiChatStreamCreateOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
        {
            model: process.env.MODEL_NAME ?? 'gpt-4',
            max_completion_tokens: this.llmModelOptions?.maxCompletionTokens ?? 1024,
            temperature: this.llmModelOptions?.temperature ?? 0.3,
            top_p: this.llmModelOptions?.topP,
            messages: this._buildMessageWithContext(),
            stream: true,
            tools: this.builtToolCalls,
            prompt_cache_retention: '24h',
            tool_choice: 'auto',
            parallel_tool_calls: this.llmModelOptions?.parallelToolCalls ?? true
        }

        this.emit('chatCreate', openaiChatStreamCreateOptions)

        const chatStream = await this.openAIClient.chat.completions.create(
            openaiChatStreamCreateOptions
        )

        let responseContent = ''
        let usage: OpenAI.CompletionUsage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }

        const toolCallsMap: Record<number, OpenAI.Chat.Completions.ChatCompletionMessageToolCall> = {}
        let finishReason: OpenAI.Chat.Completions.ChatCompletionChunk['choices'][0]['finish_reason'] =
            null

        const assistantMessage: CompletionMessage = {
            role: 'assistant',
            content: responseContent,
            chatTime: Date.now()
        }

        for await (const event of chatStream) {
            if (event.usage) {
                usage = {
                    prompt_tokens: event.usage.prompt_tokens || 0,
                    completion_tokens: event.usage.completion_tokens || 0,
                    total_tokens: event.usage.total_tokens || 0
                }
            }

            const choice = event.choices[0]
            if (!choice) continue

            if (choice.finish_reason) {
                finishReason = choice.finish_reason
            }

            if (choice.delta.content) {
                const delta = choice.delta.content
                responseContent += delta
                assistantMessage.content = responseContent

                if (onResponse) {
                    onResponse(event, delta, responseContent)
                }
            }

            if (choice.delta.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                    const index = toolCallDelta.index

                    if (!toolCallsMap[index]) {
                        toolCallsMap[index] = {
                            id: toolCallDelta.id || '',
                            type: 'function',
                            function: {
                                name: toolCallDelta.function?.name || '',
                                arguments: toolCallDelta.function?.arguments || ''
                            }
                        }
                    } else {
                        if (toolCallDelta.function?.arguments && toolCallsMap[index].type === 'function') {
                            toolCallsMap[index].function.arguments += toolCallDelta.function.arguments
                        }
                    }
                }
            }
        }

        session.messages.push(assistantMessage)
        if (onSessionUpdate) {
            onSessionUpdate(session)
        }

        const toolCalls = Object.values(toolCallsMap)

        if (toolCalls.length > 0) {
            assistantMessage.tool_calls = toolCalls
        }

        if (finishReason === 'tool_calls' || toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                if (toolCall.type === 'function') {
                    try {
                        const callName = toolCall.function.name
                        const callArguments = JSON.parse(toolCall.function.arguments)

                        this.emit('toolCall', callName, callArguments)

                        const callResult = await this._callTool(callName, callArguments)

                        const toolCallMessage: CompletionMessage = {
                            role: 'tool',
                            content: typeof callResult === 'string' ? callResult : JSON.stringify(callResult),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        }

                        session.messages.push(toolCallMessage)

                        if (onSessionUpdate) {
                            onSessionUpdate(session)
                        }

                    } catch (error) {
                        this.emit('toolCallError', error)

                        const toolCallErrorMessage: CompletionMessage = {
                            role: 'tool',
                            content: JSON.stringify({
                                error: 'Failed to execute function arguments parse error'
                            }),
                            tool_call_id: toolCall.id,
                            chatTime: Date.now()
                        }

                        session.messages.push(toolCallErrorMessage)

                        if (onSessionUpdate) {
                            onSessionUpdate(session)
                        }
                    }
                }
            }

            return await this._chatStreamRecursive(session, onResponse, onSessionUpdate)
        }

        const chatCompletion: OpenAI.Chat.Completions.ChatCompletion = {
            id: '',
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

        

        return chatCompletion
    }

    private _buildMessageWithContext(): OpenAI.Chat.ChatCompletionMessageParam[] {
        const maxTokens = this.llmModelOptions?.maxSessionLength ?? 10
        const openaiMessage: OpenAI.Chat.ChatCompletionMessageParam[] = []

        openaiMessage.push({
            role: 'system',
            content: this._buildSystemMessage()
        })

        const selectedSessions = this.llmContexts.sessions.slice(-(maxTokens * 2))
        for (const session of selectedSessions) {
            for (const message of session.messages) {
                switch (message.role) {
                    case 'developer':
                        openaiMessage.push({
                            role: 'developer',
                            content: message.content,
                            name: message.name
                        })
                        break
                    case 'user':
                        openaiMessage.push({
                            role: 'user',
                            content: message.content,
                            name: message.name
                        })
                        break
                    case 'assistant':
                        const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
                            role: 'assistant',
                            content: message.content,
                            name: message.name
                        }
                        if (message.tool_calls) {
                            assistantMsg.tool_calls = message.tool_calls
                        }
                        openaiMessage.push(assistantMsg)
                        break
                    case 'tool':
                        openaiMessage.push({
                            role: 'tool',
                            content: message.content,
                            tool_call_id: message.tool_call_id
                        })
                        break
                    default:
                        console.warn('Unrecognized message role encountered')
                }
            }
        }

        if (this.llmConfig?.useContextsSimplify ?? true) {
            const len = openaiMessage.length
            const keep = 10
            const smTo = len - keep
            if (smTo > 0) {
                for (let i = 0; i < smTo; i++) {
                    const message = openaiMessage[i]
                    if (message.role === 'developer' || message.role === 'system') {
                        continue
                    }
                    else if (message.role === 'tool') {
                        message.content = '已折叠结果'
                    }
                    else if (message.role === 'assistant' && message.tool_calls) {
                        for (const call of message.tool_calls) {
                            if (call.type === 'function') {
                                call.function.arguments = '{}'
                            }
                        }
                    }
                }
            }
        }
        return openaiMessage
    }

    private _buildSystemMessage(): string {
        let systemPromptContent = this.llmConfig?.useDefaultSystemPromptHead ?? true ? `现在的时间是${this._getLocalDate()}\n` : ''
        systemPromptContent += this.roleDefination.rolePrompt
        return systemPromptContent
    }

    private _getLocalDate():string{
        const date = new Date()
        return date.toLocaleString()
    }

    private async _callTool(callName: string, callArguments: Record<string, any>): Promise<string> {
        console.log(`调用了工具 ${callName} 使用参数 ${JSON.stringify(callArguments)}`)
        const tool = this.llmToolsMap.get(callName)
        if (!tool) {
            return JSON.stringify({ error: `Tool ${callName} not found.` });
        }
        try {
            const result: any = await tool.execute(callArguments)
            return JSON.stringify(result)
        } catch (error) {
            return JSON.stringify({ error: `Tool call Error ${error}` });
        }
    }

    private _createNewContext(): LLMContexts {
        const chatId = crypto.randomUUID()
        const llmContexts: LLMContexts = {
            latestActive: Date.now(),
            chatId: chatId,
            sessions: []
        }
        return llmContexts
    }

    public saveContextsToFile(filePath:string){
        const dirname = path.dirname(filePath)
        existify(dirname)
        writeFileSync(filePath,JSON.stringify(this.llmContexts,null,2),'utf-8')
    }

}