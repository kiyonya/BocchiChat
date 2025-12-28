//这是一份用于测试的文件

import dotenv from 'dotenv'
import { botChatLine } from './utils/bot_chat_line.ts'
import AITool from './tools/tool.ts'
import KirisameMarisa from './bots/tohou/kirisame_marisa.ts'
dotenv.config()
process.stdin.resume()

const bot = new KirisameMarisa()

bot.defineResponseFormat({ type: 'text' })

bot.defineSentiment({
    'angry': {
        sentiment: '生气',
        prompt: "你生气的时候态度会变得很差,回复的话语也会减少，但是你很好哄开心"
    },
    'happy': {
        sentiment: '开心',
        prompt: "开心的时候你会非常高兴，聊天的性质也很高，你总愿意多说一些话来分享今天的开心事"
    },
    'sad': {
        sentiment: "难过",
        prompt: "你难过的时候总是期待他人的安慰，如果得到他人的安慰的话，一切很快会好起来的"
    }
})

bot.on('toolCall', (toolName, toolArgs) => {
    console.log(`\n\n${bot.botId} 调用了函数 ${toolName}\n 参数 ${toolArgs}\n\n`)
})

bot.defineTools([
    
    AITool.File.readdir,
    AITool.File.readTextFromFile,
    AITool.File.writeTextToFile,
    AITool.File.isExist,
    AITool.File.mkdir,
    AITool.File.pathJoin,
    AITool.File.copy,
    AITool.File.rename,

    AITool.OS.getNetworkInfo,
    AITool.OS.getUserOSInfo,
    AITool.OS.getMemoryUsage,
    AITool.OS.getSystemLoad,
    AITool.OS.getInstalledApps,
    AITool.OS.showSystemNotification,
    AITool.OS.getCurrentDeviceUser,
    AITool.OS.getHostInfo,
    AITool.OS.openPerformanceMonitor,
    AITool.OS.getDisk,
    AITool.OS.showMessageBox,

    AITool.Shell.listProcess,
    AITool.Shell.killProcess,
    AITool.Shell.startSystemApp,
    AITool.Shell.getCwd,
    AITool.Shell.chdir,

    AITool.Network.fileDownloader,
    AITool.Network.httpRequest,
    AITool.Network.openBrowser,

    AITool.Robot.dragMouse, //按住左键移动鼠标
    AITool.Robot.moveMouseSmooth, //移动鼠标
    AITool.Robot.typeString, //键盘打字
    AITool.Robot.screenshot //截图
])

botChatLine(bot)

