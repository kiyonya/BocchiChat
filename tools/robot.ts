import robotjs from "robotjs";
import { createTool } from "../core/entry.ts";
import fs from 'fs'
import { PNG } from 'pngjs'
import path from "path";

export default class ToolRobot {
    
    public static readonly typeString = createTool<{ str: string }, {}>('tool_robot_typeString', async (typeParams) => {
        robotjs.typeString(typeParams.str)
        return {}
    }, {
        parameters: [
            {
                name: 'str',
                description: "你想要模拟输入的文本内容",
                type: 'string',
                required: true
            }
        ],
        description: "你可以使用这个工具模拟键盘输入一些文本内容"
    })

    public static readonly screenshot = createTool<{ saveTo: string }, { targetFile: string }>('tool_robot_screenshot', async (params) => {

        const dpr = 1;
        const size = robotjs.getScreenSize();

        const screenshot = robotjs.screen.capture(0, 0, size.width, size.height);

        const png = new PNG({
            width: size.width * dpr,
            height: size.height * dpr,
        });

        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                let idx = (png.width * y + x) * 4;
                let r = screenshot.image[idx];
                let g = screenshot.image[idx + 1];
                let b = screenshot.image[idx + 2];
                let a = screenshot.image[idx + 3];
                png.data[idx] = b;
                png.data[idx + 1] = g;
                png.data[idx + 2] = r;
                png.data[idx + 3] = a;
            }
        }

        const dirname = path.dirname(params.saveTo)
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true })
        }

        png.pack().pipe(fs.createWriteStream(params.saveTo));

        return {
            targetFile: params.saveTo
        }

    }, {
        parameters: [
            {
                name: 'saveTo',
                description: "你希望截图保存到的位置，具体到文件名和扩展名，例如 D:/screenshot.png",
                type: 'string',
                required: true
            }
        ],
        description: "截取当前屏幕的截图并保存为PNG格式文件,返回保存后的文件"
    })

    public static readonly dragMouse = createTool<{
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        duration?: number
    }, {
        success: boolean,
        message: string
    }>('tool_robot_dragMouse_simple', async (params) => {
        robotjs.moveMouse(params.startX, params.startY);
        robotjs.mouseToggle('down', 'left');
        await new Promise(resolve => setTimeout(resolve, 50));
        robotjs.moveMouse(params.endX, params.endY);
        if (params.duration && params.duration > 0) {
            await new Promise(resolve => setTimeout(resolve, params.duration));
        }
        robotjs.mouseToggle('up', 'left');
        return {
            success: true,
            message: `鼠标已从 (${params.startX}, ${params.startY}) 拖拽到 (${params.endX}, ${params.endY})`
        };
    }, {
        parameters: [
            {
                name: 'startX',
                description: "拖拽起始点的X坐标",
                type: 'number',
                required: true
            },
            {
                name: 'startY',
                description: "拖拽起始点的Y坐标",
                type: 'number',
                required: true
            },
            {
                name: 'endX',
                description: "拖拽结束点的X坐标",
                type: 'number',
                required: true
            },
            {
                name: 'endY',
                description: "拖拽结束点的Y坐标",
                type: 'number',
                required: true
            },
            {
                name: 'duration',
                description: "拖拽持续时间（毫秒），默认为0",
                type: 'number',
                required: false
            }
        ],
        description: "模拟鼠标左键拖拽操作"
    });

    public static readonly moveMouseSmooth = createTool<{
        x: number;
        y: number;
        speed?: number
    }, {}>('tool_robot_moveMouseSmooth', async (moveParams) => {
        if (moveParams.speed !== undefined) {
            robotjs.moveMouseSmooth(moveParams.x, moveParams.y, moveParams.speed);
        } else {
            robotjs.moveMouseSmooth(moveParams.x, moveParams.y);
        }
        return {}
    }, {
        parameters: [
            {
                name: 'x',
                description: "目标位置的 X 坐标（水平方向）",
                type: 'number',
                required: true
            },
            {
                name: 'y',
                description: "目标位置的 Y 坐标（垂直方向）",
                type: 'number',
                required: true
            },
            {
                name: 'speed',
                description: "移动速度（可选，数值越大移动越快，默认值取决于系统）",
                type: 'number',
                required: false
            }
        ],
        description: "平滑地将鼠标移动到屏幕的指定坐标位置。提供更自然的鼠标移动效果，避免突兀的跳转。"
    })
}