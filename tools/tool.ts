import ToolFile from "./file.ts";
import ToolMedia from "./media.ts";
import ToolNetwork from "./network.ts";
import ToolOS from "./os.ts";
import ToolRobot from "./robot.ts";
import ToolShell from "./shell.ts";

export default abstract class AITool {
    public static readonly Network = ToolNetwork
    public static readonly File = ToolFile
    public static readonly OS = ToolOS
    public static readonly Shell = ToolShell
    public static readonly Media = ToolMedia
    public static readonly Robot = ToolRobot
}

