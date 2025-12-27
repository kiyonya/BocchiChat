import { createTool } from "../core/entry.ts";
import os from 'node:os'

export default class ToolOS {

    public static readonly getUserOSInfo = createTool(
        "tool_os_getUserOsInfo", async () => {
            const arch = os.arch()
            const platform = os.platform()
            const osRelease = os.release()
            const cpu = os.cpus()?.[0].model
            return {
                arch, platform, osRelease, cpu
            }
        }, {
        parameters: [],
        description: "获取用户的系统信息"
    })

    public static readonly getNetworkInfo = createTool(
        "tool_os_getNetworkInfo", async () => {
            const interfaces = os.networkInterfaces()
            const networkInfo: Record<string, any> = {}

            for (const [name, addrs] of Object.entries(interfaces)) {
                if (addrs) {
                    networkInfo[name] = addrs.map(addr => ({
                        address: addr.address,
                        netmask: addr.netmask,
                        family: addr.family,
                        mac: addr.mac,
                        internal: addr.internal,
                        cidr: addr.cidr
                    }))
                }
            }

            return { interfaces: networkInfo }
        }, {
        parameters: [],
        description: "获取网络接口信息"
    })

    public static readonly getUserInfo = createTool(
        "tool_os_getUserInfo", async () => {
            const userInfo = os.userInfo()
            const homedir = os.homedir()
            const tmpdir = os.tmpdir()

            return {
                username: userInfo.username,
                uid: userInfo.uid,
                gid: userInfo.gid,
                shell: userInfo.shell,
                homedir,
                tmpdir
            }
        }, {
        parameters: [],
        description: "获取当前用户信息"
    })

    public static readonly getSystemLoad = createTool(
        "tool_os_getSystemLoad", async () => {
            const loadavg = os.loadavg()
            const uptime = os.uptime()
            const cpus = os.cpus()

            return {
                loadAverage: {
                    '1min': loadavg[0],
                    '5min': loadavg[1],
                    '15min': loadavg[2]
                },
                uptime,
                cpuCount: cpus.length,
                cpuInfo: cpus.map(cpu => ({
                    model: cpu.model,
                    speed: cpu.speed,
                    times: cpu.times
                }))
            }
        }, {
        parameters: [],
        description: "获取系统负载和CPU信息"
    })

    public static readonly getMemoryUsage = createTool(
        "tool_os_getMemoryUsage", async () => {
            const totalMemory = os.totalmem()
            const freeMemory = os.freemem()
            const usedMemory = totalMemory - freeMemory

            return {
                total: totalMemory,
                free: freeMemory,
                used: usedMemory,
                usagePercentage: Math.round((usedMemory / totalMemory) * 100)
            }
        }, {
        parameters: [],
        description: "获取内存使用情况"
    })

    public static readonly getHostInfo = createTool(
        "tool_os_getHostInfo", async () => {
            const hostname = os.hostname()
            const type = os.type()
            const version = os.version()
            const machine = os.machine()

            return {
                hostname,
                type,
                version,
                machine,
                endianness: os.endianness()
            }
        }, {
        parameters: [],
        description: "获取主机和系统版本信息"
    })
    
}