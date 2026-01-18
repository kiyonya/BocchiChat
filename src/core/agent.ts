import EventEmitter from "events";
import OpenAILLM, { type LLMModelOptions, type LLMContexts, type LLMRoleDefination, type LLMSession, type LLMConfig } from "./llm/openai.ts";
import MCPToolkit from "./mcp.ts";
import { LocalTool, MCPTool } from "./tool.ts";
import Toolkit from "./toolkit.ts";

import fs from 'fs'
import OpenAI from "openai";
import { type StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";

type LLMContextsFileORContexts = string | LLMContexts

export default class Agent extends EventEmitter {

    public toolkits: Toolkit[] = []
    public mcpToolkits: MCPToolkit[] = []
    public definedMCPServices: Record<string, any> = {}

    public agentToolsMap: Map<string, MCPTool | LocalTool> = new Map<string, MCPTool | LocalTool>()

    public agentName: string
    public roleDefination?: LLMRoleDefination
    public llmContexts?: LLMContexts
    public llmModelOptions?: LLMModelOptions
    public llm: OpenAILLM | null = null
    public llmChatOptions?: LLMConfig

    public llmContextsDumpFile?: string

    public isGenerating: boolean = false
    public isInit: boolean = false

    constructor(agentName: string, context?: LLMContextsFileORContexts, roleDefination?: LLMRoleDefination, llmModelOptions?: LLMModelOptions, llmChatOptions?: LLMConfig) {

        super()
        this.agentName = agentName
        this.roleDefination = roleDefination
        this.llmModelOptions = llmModelOptions
        this.llmChatOptions = llmChatOptions

        this.llmContextsDumpFile = `contexts/${agentName}.json`

        if (typeof context === 'string') {
            if (fs.existsSync(context)) {
                const llmContexts = JSON.parse(fs.readFileSync(context, 'utf-8'))
                this.llmContextsDumpFile = context
                this.llmContexts = llmContexts
            }
        }
        else {
            this.llmContexts = context
        }
    }

    public defineMCPService(services: Record<string, URL | StdioServerParameters>) {
        this.definedMCPServices = services
    }

    public defineToolkits(toolkits: Toolkit<any>[]) {
        this.toolkits = toolkits
    }

    public addToolkit(toolKit: Toolkit<any>) {
        this.toolkits.push(toolKit)
    }

    public defineMCPToolkits(mcpToolkits: MCPToolkit[]) {
        this.mcpToolkits = mcpToolkits
    }

    public async whenReady() {

        if (this.isInit) {
            return
        }

        try {
            const tools: (LocalTool | MCPTool)[] = this.toolkits.map(i => i.toToolList()).flat()
            //创建mcp工具箱
            if (Object.keys(this.definedMCPServices)) {
                for (const [serverName, serverParams] of Object.entries(this.definedMCPServices)) {
                    const mcpToolKit = new MCPToolkit(serverName, serverParams)
                    this.mcpToolkits.push(mcpToolKit)
                    console.log("已启动工具箱" + serverName)
                }
            }
            //初始化mcp
            for (const mcpToolkit of this.mcpToolkits) {
                const mcpTools = await mcpToolkit.init()
                tools.push(...mcpTools)
            }

            for (const tool of tools) {
                const toolName = tool.toolName
                if (this.agentToolsMap.has(toolName)) {
                    throw new Error(`namedepll ${toolName}`)
                }
                this.agentToolsMap.set(toolName, tool)
            }

            this.emit('toolsReady')
            console.log("工具ok")

            const llm = new OpenAILLM({
                name: this.agentName,
                roleDefination: this.roleDefination,
                llmContext: this.llmContexts,
                llmModelOptions: this.llmModelOptions,
                llmTools: this.agentToolsMap,
                llmConfig: this.llmChatOptions
            })

            this.llm = llm
            this.isInit = true

        } catch (error) {

        }

    }
    public async chatStream(userPrompt: string, onResponse?: (chunk: OpenAI.Chat.Completions.ChatCompletionChunk, delta: string, payload: string,) => void, onSessionUpdate?: (dialogue: LLMSession) => void, mode: "context" | "sessionOnly" | "sessionIsolation" = 'context'): Promise<LLMSession | null> {
        if (!this.llm) {
            throw new Error("缺少LLM")
        }
        if (this.isGenerating) {
            return null
        }
        this.isGenerating = true
        const session = await this.llm.chatStream(userPrompt, onResponse, onSessionUpdate, mode)
        if (this.llmContextsDumpFile) {
            this.llm?.saveContextsToFile(this.llmContextsDumpFile)
        }
        this.isGenerating = false
        return session
    }

    public async chat(userPrompt: string, onSessionUpdate?: (session: LLMSession) => void, mode: 'context' | 'sessionOnly' | 'sessionIsolation' = 'context'): Promise<LLMSession | null> {
        if (!this.llm) {
            throw new Error("缺少LLM")
        }
        if (this.isGenerating) {
            return null
        }
        this.isGenerating = true
        const session = await this.llm.chat(userPrompt, onSessionUpdate, mode)
        if (this.llmContextsDumpFile) {
            this.llm?.saveContextsToFile(this.llmContextsDumpFile)
        }
        this.isGenerating = false
        return session
    }

    public pushSessionState(session: LLMSession) {
        this.llm?.pushSession(session)
        if (this.llmContextsDumpFile) {
            this.llm?.saveContextsToFile(this.llmContextsDumpFile)
        }
    }
}