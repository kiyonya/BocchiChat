import { createFunction } from "../core/entry.ts";
import os from 'node:os'


export default class LibOS {

    public static readonly GetUserOSInfo = createFunction("LibOS_GetUserOSInfo", async () => {
        const arch = os.arch()
        const platform = os.platform()
        const osRelease = os.release()
        const totalMemory = os.totalmem()
        const freeMemory = os.freemem()
        const cpu = os.cpus()?.[0].model
        return {
            arch, platform, osRelease, totalMemory, freeMemory, cpu
        }
    }, {
        parameters: [],
        description: "获取用户的系统信息"
    })

    public static readonly GetUserHomeDir = createFunction('LibOS_GetUserHomeDir', async () => {
        const homedir = os.homedir()
        return { homedir }
    })

}