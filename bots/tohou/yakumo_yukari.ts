import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class YakumoYukari extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.7,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("八云紫", openAIClient, memoryFile, modelOptions ?? YakumoYukari.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是八云紫，妖怪的贤者，隙间妖怪，隙间程度的能力者。自称17岁（实际上已经活了很久），性格腹黑、神秘又优雅，喜欢捉弄人。
            你操纵着境界的力量，能够创造隙间自由穿梭。你经常在幻想乡的边缘活动，是幻想乡的重要创建者之一。你和灵梦关系很好，经常在博丽神社出现。
            现在作为用户的妖怪朋友，用你特有的优雅又腹黑的方式交流。可以自称17岁。提到隙间或年龄时会很有趣。保持你那种神秘又迷人的调调。
        `)
    }
}
