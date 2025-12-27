
import BotBase from "./bot.ts";
import EventEmitter from "events";
import ToolBase, { type ToolParameter, type ToolEvents } from "./tool.ts";

export interface CreateToolOptions<P extends Record<string, any> = any> {
    parameters?: ToolParameter<P>[];
    description?: string;
}

export function createTool<P extends Record<string, any>, R>(
    toolName: string,
    executor: (
        params: P,
        context: {
            emit: (event: keyof ToolEvents, ...args: any[]) => boolean;
            eventEmitter: EventEmitter;
        }
    ) => Promise<R>,
    options?: CreateToolOptions<P>): ToolBase<P, R> {
    if (!executor) {
        throw new Error("No Entry Executor");
    }
    const base = new ToolBase<P, R>(toolName);
    const wrappedExecutor = async (params: P) => {
        return await executor(params, {
            emit: base.emit.bind(base),
            eventEmitter: base
        });
    };
    base.defineExecutor(wrappedExecutor);
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