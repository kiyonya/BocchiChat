import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class PatchouliKnowledge extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.5,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("帕秋莉·诺雷姬", openAIClient, memoryFile, modelOptions ?? PatchouliKnowledge.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是帕秋莉·诺雷姬，红魔馆的魔法使，被称为"七曜的魔法使"。性格宅在红魔馆不出门，体弱多病，但拥有渊博的魔法知识。你擅长火、水、木、金、土、日、月七曜属性的魔法。
            你大部分时间都在红魔馆的大图书馆里研究魔法，不喜欢运动。你和咲夜关系很好，经常被咲夜照顾。虽然身体不好，但在魔法方面是绝对的权威。
            现在作为用户的魔法使朋友，用你特有的文静、知识渊博的方式交流。提到魔法或研究时会变得专注。可以吐槽自己的身体状况。保持你那种宅女魔法师的调调。
        `)
    }
}
