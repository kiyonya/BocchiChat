import BotBase from "../core/bot.ts";
import readline from 'readline'

export function botChatLine(bot: BotBase) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    const doConversation = async () => {
        rl.question('', async (userInput) => {
            const input = userInput.trim();
            if (!input) {
                console.log('请输入内容\n');
                doConversation();
                return;
            }
            try {
                const response = await bot.chatStream(input, (_chunk, delta, payload) => {
                    delta = delta.replaceAll("</think>","\n")
                    process.stdout.write(`\x1b[32m${delta}\x1b[0m`);
                });
               
                console.log(`\n\x1b[33m使用token:${response.usage?.total_tokens}\x1b[0m`)
            } catch (error) {
                console.error('错误:', error);
            }
            doConversation();
        });
    };
    doConversation();
}