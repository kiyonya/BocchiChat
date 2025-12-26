import FunctionBase, { type ToolParameter } from "./function.ts";
import BotBase from "./bot.ts";

export interface CreateFunctionOptions<P extends Record<string, any> = any> {
    parameters?: ToolParameter<P>[];
    description?: string;
}

export function createFunction<P extends Record<string, any>, R>(functionName: string,executor: (params: P) => Promise<R>,options?: CreateFunctionOptions<P>): FunctionBase<P, R> {
    if (!executor) {
        throw new Error("No Entry Executor");
    }
    const base = new FunctionBase<P, R>(functionName);
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