import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
export const envPath=fileURLToPath(new URL('../.env.local',import.meta.url));
export function loadLocalEnv(path=envPath,base=process.env){
 const exists=existsSync(path);
 // For local runs, explicitly saved project settings override inherited shell values.
 const settings=exists?parseEnv(readFileSync(path,'utf8').replace(/^\uFEFF/,'')):{};
 return {env:{...base,...settings},exists,path};
}
