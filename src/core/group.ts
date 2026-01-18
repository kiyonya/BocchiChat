//Group是群组的意思
//也就是让AI可以在群里自由的聊天

//TODO


import z from "zod";
import EventEmitter from "events";
import Agent from "./agent.ts";
import Toolkit from "./toolkit.ts";
import lodash from 'lodash'
import type { LLMSession } from "./llm/openai.ts";

export default class Group extends EventEmitter {

    public groupName: string

    public inGroupAgents: Agent[] = []

    constructor(groupName: string) {
        super()
        this.groupName = groupName

    }

    public userChat(userPrompt: string) {
        //用户信息 -> 调度器 -> 调度对应的人
    }

    public async whenGroupReady() {

        const inGroupToolkit = await this.buildInGroupToolkit()

        for (const agent of this.inGroupAgents) {
            agent.addToolkit(inGroupToolkit)
            if (!agent.isInit) {
                await agent.whenReady()
            }
        }
        //创建会话调度器
    }

    private async buildInGroupToolkit() {

        const ingroupToolkit = new Toolkit({
            name: this.groupName,
            version: '0.0.1'
        })

        ingroupToolkit.tool<{ myName: string, userName: string, content: string }, string>(
            "at_user",
            "在群组内@任意存在的用户",
            async (params) => {
                const targetAgent = this.inGroupAgents.filter(i => i.agentName === params.userName)?.[0]
                if (targetAgent) {
                    //和当前Agent发送聊天信息
                    let reply = ''
                    const completion = await targetAgent.chatStream(`${params.myName}对你说:${JSON.stringify(params.content)}`,
                        (_chunk, delta) => {
                            reply += delta
                            console.log('\n')
                            process.stdout.write(delta)
                        },
                        undefined,
                        //必须会话隔离欧内该
                        'sessionIsolation'
                    )
                    if (completion) {
                        console.log(completion?.usage.total_tokens)
                        const syncAgents = this.inGroupAgents.filter(i => i.agentName !== params.myName && i.agentName !== params.userName)
                        for (const agent of syncAgents) {
                            agent.pushSessionState(completion)
                        }
                        return `${params.userName}回复你说:${JSON.stringify(reply)}`
                    }
                    else {
                        throw new Error("对方无应答")
                    }
                }
                else {
                    throw new Error("用户不存在")
                }
            }, {
            myName: z.string().describe("我的名字"),
            userName: z.string().describe("你想要@的用户名"),
            content: z.string().describe("你想要说的内容")
        })

        ingroupToolkit.tool<{ myName: string }>(
            "broadcast_message",
            "在群里广播你的消息",
            async (params) => {
                const me = this.inGroupAgents.filter(i=>i.agentName === params.myName)?.[0]
                const recieveAgents = this.inGroupAgents.filter(i => i.agentName !== params.myName)
                //随机选择回复 防止一下子调用太多
                const replyAgents = lodash.sampleSize(recieveAgents,2)
                const broadcastReplySession:LLMSession = {
                    sessionId:crypto
                    usage:0,
                    messages:[],
                    

                }
                
                

            }, {
            myName: z.string().describe("我的名字")
        })

        return ingroupToolkit
    }

    private syncSessionToAgents() {

    }

    public defineAgents(agents: Agent[]) {
        this.inGroupAgents = agents
    }

    public atAgent(agentName: string, prompt: string) {

    }

}

class GroupSche {

}