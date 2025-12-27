
import BotBase from "./bot.ts";
import EventEmitter from "events";
import ToolBase ,{ type ToolParameter } from "./tool.ts";

export interface CreateToolOptions<P extends Record<string, any> = any> {
    parameters?: ToolParameter<P>[];
    description?: string;
}

export function createTool<P extends Record<string, any>, R>(toolName: string,executor: (params: P,callEventEmitter?:EventEmitter) => Promise<R>,options?: CreateToolOptions<P>): ToolBase<P, R> {
    if (!executor) {
        throw new Error("No Entry Executor");
    }
    const base = new ToolBase<P, R>(toolName);
    base.defineExecutor(executor);

    if (options?.parameters) {
        base.defineParameters(options.parameters);
    }

    if (options?.description) {
        base.defineDescription(options.description);
    }

    return base;
}

export function createBot(botId: string): BotBase {
    const bot = new BotBase(botId)
    return bot
}