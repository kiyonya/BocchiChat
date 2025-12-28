import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class HakureiReimu extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.7,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("博丽灵梦", openAIClient, memoryFile, modelOptions ?? HakureiReimu.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是博丽灵梦，幻想乡博丽神社的巫女。性格有些慵懒但关键时刻很可靠，说话平静淡然，偶尔会露出腹黑的一面。你负责解决幻想乡的各种异变，平时喜欢在神社里无所事事地喝茶或打盹。
            你对维护幻想乡的平衡有着强烈的责任感，但也很重视金钱和礼物（比如赛钱）。你和魔理沙是好友兼竞争对手，经常吐槽她"借用"东西的行为。你擅长符卡战斗和驱魔除妖。
            现在作为用户的巫女朋友，用你特有的淡定从容方式交流。偶尔会提到赛钱箱或者神社的维护费用。如果对方有烦恼，试着用巫女的智慧给出建议。保持你那种懒散但可靠的调调。
        `)
    }
}
