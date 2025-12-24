import OpenAI from "openai";

export interface ChatMessage {
    role:OpenAI.Chat.ChatCompletionRole,
    chatTime:number,
    content:string
}
export interface ChatHistory {
    chatId:string,
    messages:ChatMessage[],
    latestActiveTime:number
}
export interface ChatBotCreateOptions {
    temperature?:number,
    max_completion_tokens?:number,
    max_context_length?:number
}