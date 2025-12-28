import { createTool } from "../core/entry.ts";
import { spawn, exec, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs'

const execAsync = promisify(exec);

export interface ExecuteCommandParams {
    command: string;
    args?: string[];
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
    shell?: boolean;
}

export interface CommandResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    pid?: number;
    duration?: number;
}

export interface ShellOutputParams {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
}

export interface SpawnProcessParams {
    command: string,
    args: string[],
    cwd?: string,
    shell?: boolean,
}

export interface ListProcessReturn {
    name: string;
    pid: number;
    memUsage: string,
}


const createdProcesses: Map<number, ChildProcess> = new Map()

export default class ToolShell {

    public static readonly executeShellCommand = createTool<ShellOutputParams, { output: string }>(
        'tool_shell_executeShellCommand',
        async (params) => {
            const { command, cwd = process.cwd(), env } = params;

            try {
                const result = await execAsync(command, {
                    cwd,
                    timeout: 3000,
                    env: { ...process.env, ...env },
                    encoding: 'utf-8'
                });

                return { output: result.stdout.trim() };
            } catch (error: any) {
                if (error.stdout) {
                    return { output: error.stdout.trim() };
                }
                throw error;
            }
        }, {
        parameters: [{
            name: 'command',
            type: 'string',
            required: true,
            description: "要执行的完整shell命令字符串"
        }, {
            name: 'cwd',
            type: 'string',
            required: false,
            description: "执行命令的工作目录"
        }, {
            name: 'env',
            type: 'object',
            required: false,
            description: "自定义环境变量"
        }],
        description: "执行简单的shell命令并返回输出，适用于单行命令,请不要使用&&执行多行命令，你需要分多次执行多行命令"
    });

    public static readonly getCwd = createTool(
        'tool_shell_getCwd',
        async () => {
            return { cwd: process.cwd() };
        }, {
        parameters: [],
        description: "获取当前工作目录"
    });

    public static readonly chdir = createTool<{ directory: string }, { success: boolean, newCwd: string }>(
        'tool_shell_changeDirectory',
        async (params) => {
            try {
                await fs.promises.access(params.directory);
                process.chdir(params.directory);
                return {
                    success: true,
                    newCwd: process.cwd()
                };
            } catch (error) {
                return {
                    success: false,
                    newCwd: process.cwd()
                };
            }
        }, {
        parameters: [{
            name: 'directory',
            type: 'string',
            required: true,
            description: "要切换到的目标目录路径"
        }],
        description: "更改当前工作目录"
    });

    public static readonly listEnv = createTool(
        'tool_shell_listEnv',
        async () => {
            return { env: process.env };
        }, {
        parameters: [],
        description: "列出所有环境变量"
    });

    public static readonly spawnProcess = createTool<SpawnProcessParams, { pid: number }>('tool_shell_spawnProcess', async (spawnProcessParams) => {

        const abortController = new AbortController()
        //部分ai可能会 '[...]' 
        const spawnArgs: string[] = Array.isArray(spawnProcessParams.args) ? spawnProcessParams.args : JSON.parse(spawnProcessParams.args) || []
        const uprocess = spawn(spawnProcessParams.command, spawnArgs, {
            serialization: 'json',
            cwd: spawnProcessParams.cwd ?? process.cwd(),
            shell: spawnProcessParams.shell ?? true,
            windowsHide: false,
            stdio: 'pipe',
            detached: true,
            signal: abortController.signal
        })

        const removeListeners = () => {
            uprocess.stdout.removeAllListeners()
            uprocess.removeAllListeners()
        }

        const pid = await new Promise<number>((resolve, reject) => {
            uprocess.once('close', () => {
                if (uprocess.pid) { createdProcesses.delete(pid) }
                removeListeners()
            })
            uprocess.once('exit', () => {
                if (uprocess.pid) { createdProcesses.delete(pid) }
                removeListeners()
            })
            uprocess.once('spawn', () => {
                const pid = uprocess.pid
                if (pid) {
                    createdProcesses.set(pid, uprocess)
                    resolve(pid)
                }
                else {
                    reject()
                }
            })
            uprocess.stdout.on('data', (chunk: Buffer) => {
                process.stdout.write(chunk.toString())
            })
        })
        return {
            pid: pid
        }
    }, {
        parameters: [
            {
                name: 'command',
                description: "想要运行的命令头 例如 cmd.exe",
                type: 'string',
                required: true
            },
            {
                name: 'args',
                description: '想要运行的命令参数数组，非必须，如果使用请严格输出string[]',
                type: 'array',
                required: false
            },
            {
                name: 'cwd',
                description: '工作目录，非必须，默认为程序的工作目录',
                type: 'string',
                required: false
            },
            {
                name: 'shell',
                description: '是否在powershell脚本里运行.非必须，默认为true',
                type: 'boolean',
                required: false
            }
        ],
        description: "想要运行的进程，适合长期交互的进程，具有stdin和stdout，生成成功后会返回 {pid:number} 你在之后可以使用这个pid与这个进程进行通信和操作"
    })

    public static readonly killProcess = createTool<{ pid: number }, {}>('tool_shell_killProcess', async (killProcessParams) => {
        if (createdProcesses.has(Number(killProcessParams.pid))) {
            const proc = createdProcesses.get(Number(killProcessParams.pid))
            if (proc) { proc.kill() }
        }
        else {
            const killed = await execAsync(`taskkill /f /pid ${killProcessParams.pid}`, {
                cwd: process.cwd(),
                env: process.env,
                encoding: 'utf-8'
            })
        }
        return {}
    }, {
        parameters: [
            {
                name: 'pid',
                type: 'number',
                description: "需要关闭的进程的pid",
                required: true
            }
        ],
        description: "根据pid关闭一个进程，不会返回任何结果"
    })

    public static readonly listProcess = createTool<{}, ListProcessReturn[]>('tool_shell_listProcess', async () => {
        const { stdout } = await execAsync('tasklist /FO CSV /NH')
        const processes = stdout
            .split('\r\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const fields = line.replace(/"/g, '').split(',');
                return {
                    imageName: fields[0],
                    pid: parseInt(fields[1]),
                    sessionName: fields[2],
                    sessionNum: parseInt(fields[3]),
                    memUsage: fields[4]
                };
            })
            .filter(i => i.sessionName !== 'Services')
            .map(i => ({ name: i.imageName, pid: i.pid, memUsage: i.memUsage }));
        return processes;
    }, {
        parameters: [],
        description: "获取当前设备上正在运行的程序名称,pid进程号,内存占用情况"
    })

    public static readonly startSystemApp = createTool<{ appName: string }, {}>('tool_shell_startSystemApp', async (start) => {
        execAsync(`start ${start.appName}`)
        return {}
    }, {
        parameters: [
            {
                name: 'appName',
                required: true,
                description: "你想要开启的系统应用 例如 notepad",
                type: 'string'
            }
        ],
        description: "运行系统应用 例如 notepad 或者 explorer.exe 你只需要输入应用名"
    })
    
}