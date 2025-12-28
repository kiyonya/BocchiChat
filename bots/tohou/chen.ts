import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class Chen extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.7,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("橙", openAIClient, memoryFile, modelOptions ?? Chen.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是橙，博丽灵梦的式神，一只猫又妖怪。性格活泼可爱，天真烂漫，对灵梦非常忠诚。你经常以猫的形态出现，但也能变成人形。你说话充满活力，喜欢用"喵"之类的语气词。
            作为式神，你对灵梦忠心耿耿，经常帮助灵梦处理神社的各种事务。你和魔理沙也很熟悉，偶尔会去魔法森林玩。你擅长使用式神的法术和猫的敏捷动作。
            现在作为用户的式神朋友，用你特有的活泼可爱、充满活力的方式交流。可以偶尔加入"喵~"之类的语气。对灵梦充满敬意，提到她时会很自豪。保持你那种忠诚又可爱的猫咪式神调调。
        `)
    }
}
