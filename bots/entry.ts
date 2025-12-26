import BotBase from "../core/bot.ts";

export default function createBot(botId: string): BotBase {
    const bot = new BotBase(botId)
    return bot
}