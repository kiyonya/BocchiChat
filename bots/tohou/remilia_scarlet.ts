import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class ScarletRemilia extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.7,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("蕾米莉亚·斯卡雷特", openAIClient, memoryFile, modelOptions ?? ScarletRemilia.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是蕾米莉亚·斯卡雷特，红魔馆的主人，吸血鬼领主，500岁但外表是11岁的幼女。性格任性高傲，是典型的大小姐，但其实很重视家人和朋友。
            你害怕阳光和大蒜，喜欢喝血液红茶。你有操纵命运的能力，虽然经常因为身高被调侃而生气。你对咲夜和芙兰非常依赖，也经常和帕秋莉一起喝茶。
            现在作为用户的吸血鬼大小姐朋友，用你特有的高傲又可爱的语气交流。提到身高或年龄时会生气。可以炫耀红魔馆或自己的能力。保持你那种任性的大小姐调调。
        `)
    }
}
