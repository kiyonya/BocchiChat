import { createTool } from "../core/entry.ts";
import os from 'node:os'
import { getInstalledApps } from 'get-installed-apps';
import notifier from 'node-notifier';

interface InstalledAppItem {
    appIdentifier: string,
    appName: string,
    DisplayName: string,
    InstallLocation?: string,
    Publisher: string
}

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

    public static readonly getInstalledApps = createTool<{}, { name: string, publisher: string, installLocation?: string }[]>('tool_os_getInstalledApps', async () => {

        const apps = (await getInstalledApps()) as InstalledAppItem[]

        const filteredApps = Array.from(
            apps
                .filter(i => i.Publisher !== 'Microsoft Corporation')
                .map(i => ({
                    name: i.DisplayName || i.appName,
                    installLocation: i.InstallLocation,
                    publisher: i.Publisher
                }))
                .reduce((map, app) => {
                    if (!map.has(app.publisher)) {
                        map.set(app.publisher, app);
                    }
                    return map;
                }, new Map())
                .values()
        );

        return filteredApps
    }, {
        parameters: [],
        description: "获取当前电脑上安装的所有软件的名称和安装位置数组 返回结构为 {name:string,publisher:string,installLocation?:string}[] 读取出错时会报错"
    })

    public static readonly showSystemNotification = createTool<{
        title: string,
        message: string,
        noticeType:'error' | 'info' | 'warn'
    }, {}>('tool_os_showSystemNotification', async (notifierParams) => {
        const win = notifier.notify({
            title: notifierParams.title || "标题",
            message: notifierParams.message || "信息",
            sound: true,
            wait: true,
            time: 5000,
            type:notifierParams.noticeType || 'info'
        })
        return {}
    }, {
        parameters: [
            {
                name: 'message',
                type: 'string',
                description: "显示的通知内容",
                required: true
            },
            {
                name: "title",
                type: 'string',
                description: "显示的通知标题",
                required: true,
            },{
                name:'noticeType',
                type:'string',
                description:'通知类型，不是必须的',
                required:false,
                enum:['error','info','warn']
            }
        ],
        description: "给用户发送系统通知消息，这个函数不会返回任何内容"
    })
}