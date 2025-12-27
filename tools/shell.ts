import { createTool } from "../core/entry.ts";
import { spawn, exec } from 'node:child_process';
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
    timeout?: number;
    env?: Record<string, string>;
}

export default class ToolShell {

    public static readonly executeCommand = createTool<ExecuteCommandParams, CommandResult>(
        'tool_shell_executeCommand',
        async (params) => {
            const startTime = Date.now();
            const command = params.command;
            const args = params.args || [];
            const cwd = params.cwd || process.cwd();
            const timeout = params.timeout || 30000;
            const env = { ...process.env, ...params.env };
            const shell = params.shell ?? true;

            return new Promise((resolve) => {
                const childProcess = spawn(command, args, {
                    cwd,
                    env,
                    shell,
                    timeout,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let stdout = '';
                let stderr = '';

                if (childProcess.stdout) {
                    childProcess.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });
                }

                if (childProcess.stderr) {
                    childProcess.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });
                }

                childProcess.on('close', (code) => {
                    const endTime = Date.now();
                    resolve({
                        success: code === 0,
                        exitCode: code || 0,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        pid: childProcess.pid,
                        duration: endTime - startTime
                    });
                });

                childProcess.on('error', (error) => {
                    const endTime = Date.now();
                    resolve({
                        success: false,
                        exitCode: -1,
                        stdout: '',
                        stderr: error.message,
                        pid: childProcess.pid,
                        duration: endTime - startTime
                    });
                });
            });
        }, {
        parameters: [{
            name: 'command',
            type: 'string',
            required: true,
            description: "要执行的命令（如：'npm', 'python'等）"
        }, {
            name: 'args',
            type: 'array',
            required: false,
            description: "命令参数数组"
        }, {
            name: 'cwd',
            type: 'string',
            required: false,
            description: "执行命令的工作目录，默认为当前目录"
        }, {
            name: 'timeout',
            type: 'number',
            required: false,
            description: "命令超时时间（毫秒），默认30000ms"
        }, {
            name: 'env',
            type: 'object',
            required: false,
            description: "环境变量对象，会合并到当前环境变量中"
        }, {
            name: 'shell',
            type: 'boolean',
            required: false,
            description: "是否在shell中执行，默认为true"
        }],
        description: "在shell中执行命令并返回结果，支持超时和自定义环境变量"
    });

    public static readonly executeShell = createTool<ShellOutputParams, { output: string }>(
        'tool_shell_executeShell',
        async (params) => {
            const { command, cwd = process.cwd(), timeout = 30000, env } = params;

            try {
                const result = await execAsync(command, {
                    cwd,
                    timeout,
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
            name: 'timeout',
            type: 'number',
            required: false,
            description: "命令超时时间（毫秒）"
        }, {
            name: 'env',
            type: 'object',
            required: false,
            description: "自定义环境变量"
        }],
        description: "执行简单的shell命令并返回输出，适用于单行命令"
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
}