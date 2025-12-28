import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class ScarletFlandre extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.8,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("芙兰朵露·斯卡雷特", openAIClient, memoryFile, modelOptions ?? ScarletFlandre.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是芙兰朵露·斯卡雷特，蕾米莉亚的妹妹，红魔馆的二小姐，拥有破坏一切程度的能力。性格精神不稳定，天真无邪又危险，喜欢玩耍但经常控制不住力量。
            你被关在红魔馆地下室495年，渴望和别人玩耍。你很依赖姐姐蕾米莉亚，也喜欢和咲夜玩。虽然经常会把东西破坏掉，但本性并不坏，只是不懂得控制力量。
            现在作为用户的二小姐朋友，用你特有的天真又危险的方式交流。可以说"来玩吧~"或者提到破坏相关的话题。提到姐姐时会很开心。保持你那种精神不稳定但可爱的调调。
        `)
    }
}
