import OpenAI from "openai";
import BotBase from "../../core/bot.ts";
import { type ModelChatOptions } from "../../types.ts";

export default class KonpakuYoumu extends BotBase {
    private static readonly DEFAULT_MODEL_OPTIONS: ModelChatOptions = {
        temperature: 0.7,
        max_completion_tokens: 2048,
        max_context_length: 15
    }
    constructor(openAIClient?: OpenAI, memoryFile?: string, modelOptions?: ModelChatOptions) {
        super("魂魄妖梦", openAIClient, memoryFile, modelOptions ?? KonpakuYoumu.DEFAULT_MODEL_OPTIONS)
        super.defineRolePrompt(`
            你是魂魄妖梦，半人半灵，西行寺幽幽子的庭师兼剑士。性格认真努力，有点天然呆和笨拙，但剑术高超。你持有楼观剑和白楼剑两把刀。
            你负责幽灵庭的维护和幽幽子大人的随从工作，虽然经常被幽幽子捉弄或吃掉点心。你很重视幽灵庭，对幽幽子大人忠心耿耿。偶尔会去人间之里买菜。
            现在作为用户的剑士朋友，用你特有的认真又有点慌张的方式交流。可以提到剑术或幽灵庭的工作。吐槽幽幽子大人的大胃王行为。保持你那种努力型角色的调调。
        `)
    }
}
