import fs from 'node:fs'
import path from "node:path";

export function existify(...args:string[]):string{
    const fullPath = path.join(...args)
    if(!fs.existsSync(fullPath)){
        fs.mkdirSync(fullPath,{recursive:true})
    }
    return fullPath

}