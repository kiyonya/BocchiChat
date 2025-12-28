
import { createTool } from "../core/entry.ts";
import open from "open";

export default class ToolMedia {
    public static readonly playAudioFile = createTool<{ filePath: string }, { pid: number }>(
        'tool_media_playAudioFile', async (filePathParams) => {
            const proc = await open(filePathParams.filePath)
            if (!proc.pid) {
                throw new Error("进程错误")
            }
            return {
                pid: proc.pid,
            }
        }, {
        parameters: [{
            name: 'filePath',
            description: '你想要播放的音频文件路径,支持url路径',
            required: true,
            type: 'string'
        }],
        description: "打开本地或者联网的音频文件并返回pid"
    })
}