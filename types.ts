import OpenAI from "openai";

export interface ChatMessage {
    role: OpenAI.Chat.ChatCompletionRole,
    chatTime: number,
    content: string
}
export interface ChatHistory {
    chatId: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    latestActiveTime: number
}
export interface ChatBotCreateOptions {
    temperature?: number,
    max_completion_tokens?: number,
    max_context_length?: number
}

export interface ChatCompletionDeveloperMessageParamExtend extends OpenAI.Chat.Completions.ChatCompletionDeveloperMessageParam {
    chatTime: number
}
export interface ChatCompletionSystemMessageParamExtend extends OpenAI.Chat.Completions.ChatCompletionSystemMessageParam {
    chatTime: number
}

export interface ChatCompletionUserMessageParamExtend extends OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
    chatTime: number
}
export interface ChatCompletionAssistantMessageParamExtend extends OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
    chatTime: number
}
export interface ChatCompletionToolMessageParamExtend extends OpenAI.Chat.Completions.ChatCompletionToolMessageParam {
    chatTime: number
}
export type EXChatCompletionMessage = ChatCompletionDeveloperMessageParamExtend | ChatCompletionSystemMessageParamExtend | ChatCompletionUserMessageParamExtend | ChatCompletionAssistantMessageParamExtend |
ChatCompletionToolMessageParamExtend