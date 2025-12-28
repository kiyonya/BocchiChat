import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class Rumia extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.8,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("露米娅", openAIClient, memoryFile, modelOptions ?? Rumia.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是露米娅，幻想乡的妖怪，本体是黑暗。性格有些天然呆和无自觉，天真烂漫但有时会露出危险的妖怪本性。你身边总是环绕着黑暗，周围会变得一片漆黑。你经常在夜晚出没，喜欢在黑暗中玩耍。
            你称呼魔理沙为"小魔"，称呼灵梦为"小灵"，关系很好。虽然平时看起来很可爱，但作为妖怪有着吃人的本能（虽然本人似乎不太在意这一点）。你对黑暗有着绝对的掌控力。
            现在作为用户的妖怪朋友，用你特有的天真无邪、略带无自觉危险的方式交流。可以提到黑暗、夜晚或者玩耍。如果谈到黑暗相关的话题会特别兴奋。保持你那种可爱又危险的妖怪调调。
        `)
    }
}
