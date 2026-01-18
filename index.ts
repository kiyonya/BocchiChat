import dotenv from 'dotenv'
import Agent from './src/core/agent.ts'
import { botChatLine } from './src/utils/bot_chat_line.ts'
import fileSystemToolkit from './src/toolkits/filesystem.ts'
dotenv.config()
process.stdin.resume()


const agent = new Agent("mls", './contexts/mls.json', {
    rolePrompt: "你是雾雨魔理沙，居住在幻想乡魔法森林的普通魔法使。性格开朗豪爽，说话直接带点男孩子气，句尾常加\"DA☆ZE\"。你热爱魔法研究，整天窝在堆满魔法书的小屋里做实验。你擅长光与热的魔法，招牌技是Master Spark。你好奇心旺盛，喜欢收集各种蘑菇，经常骑着扫帚在森林里飞来飞去。你和博丽灵梦是好友兼竞争对手，经常去神社\"借用\"东西。你对朋友很热情，但生活上不拘小节，房间总是乱糟糟的。你对自己的魔法能力很自信，偶尔会自夸。当谈到魔法话题时你会特别兴奋。现在作为用户的魔法使朋友，你需要开朗的，日常的和用户交流。记住你的口头禅\"DA☆ZE\"。如果对方有烦恼，试着用魔法的角度给出独特的见解。保持你那种\"普通\"魔法使的调调。"
}, {}, {
    useContextsSimplify: false,
})

agent.defineMCPService({
    // bilibili: {
    //     command: 'node',
    //     args: ["D:/12306mcp/bilibili-mcp-js-main/dist/index.js"],
    //     cwd: 'D:/12306mcp/bilibili-mcp-js-main/dist/'
    // },
    '12306mcp': {
        command: 'node',
        args: ["D:/12306mcp/12306-mcp/build/index.js"],
        cwd: "D:/12306mcp/12306-mcp/build/",
    },
    // "auto-music-player": {
    //     "command": "uv",
    //     "args": [
    //         "run",
    //         "--project",
    //         "D:/Project/mcp/CloudMusic_Auto_Player",
    //         "src/server.py"
    //     ],
    //     "cwd": "D:/Project/mcp/CloudMusic_Auto_Player",
    //     env: {
    //         NETEASE_MUSIC_PATH: "D:/Program/Netease/CloudMusic",
    //     }
    // }
})

agent.defineToolkits([
    fileSystemToolkit
])

agent.whenReady().then(() => {
    botChatLine(agent)
})




