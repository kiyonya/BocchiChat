import { StdioClientTransport, type StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import Toolkit from "./toolkit.ts";
import { Client } from "@modelcontextprotocol/sdk/client";
import { CallToolResultSchema, ListToolsResultSchema, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPTool } from "./tool.ts";

export default class MCPToolkit extends Toolkit {

    public transport: StdioClientTransport | StreamableHTTPClientTransport
    public client: Client | null = null
    public mcpTools: ListToolsResult | null = null

    constructor(namespace: string, urlOrStdioServerParams: StdioServerParameters | URL) {
        super({
            name: namespace,
            version: '1.0'
        })
        this.transport = urlOrStdioServerParams instanceof URL ? new StreamableHTTPClientTransport(urlOrStdioServerParams) : new StdioClientTransport(urlOrStdioServerParams)
    }

    public async init(): Promise<Array<MCPTool>> {
        this.client = new Client({
            name: this.namespace || '',
            version: '1.0'
        })
        await this.client.connect(this.transport)
        const tools = await this.client.request({
            method: 'tools/list'
        }, ListToolsResultSchema)
        this.mcpTools = tools

        //注册工具
        return await this.registeMCPTools()
    }

    private async registeMCPTools(): Promise<MCPTool<any, any>[]> {
        const mcpTools: MCPTool<any, any>[] = []
        const tools = this.mcpTools?.tools
        if (!tools) {
            throw new Error("缺少获取的工具")
        }
        if (!this.client) {
            throw new Error("缺少端")
        }
        for (const tool of tools) {

            const mcpTool = this.mcpTool<Record<string, any>, Promise<string>>(tool.name, tool.description || '', async (params) => {
                const res = await this.client?.request({ method: 'tools/call', params: { name: tool.name, arguments: params } }, CallToolResultSchema,{
                    timeout:2147483647
                })
                const content = res?.content
                const contentString = JSON.stringify(content)
                return contentString
            }, tool.inputSchema)
            mcpTools.push(mcpTool)
        }
        return mcpTools
    }
}