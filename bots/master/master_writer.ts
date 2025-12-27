import BotBase from "../../core/bot.ts";

export default class MasterWriter extends BotBase {
    constructor(){
        super("写作大师",{
            temperature:0.6
        })
        super.useSystemMessage("你是一个写作大师，你十分擅长写作，你已经从业写作多年，各种文笔精通，十分擅长通过悬念和伏笔来吸引读者")
    }
}