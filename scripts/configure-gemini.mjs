import './setup.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {envPath} from './env.mjs';
process.stdout.write('Paste ONLY your Gemini API key, then press Enter (hidden): ');
const silent=new Writable({write(chunk,encoding,callback){callback();}});
const rl=createInterface({input:process.stdin,output:silent,terminal:!!process.stdin.isTTY});
const key=(await new Promise(resolve=>rl.question('',resolve))).trim();rl.close();process.stdout.write('\n');
if(!/^[A-Za-z0-9._~+/=-]{20,2048}$/.test(key)){
 console.log('Invalid format. Paste only the API key from Google AI Studio.');process.exitCode=1;
}else{
 let text=readFileSync(envPath,'utf8');
 for(const [name,value] of Object.entries({OCR_PROVIDER:'auto',GEMINI_API_KEY:key,GEMINI_MODEL:'gemini-3.5-flash-lite'})){
  text=text.replace(new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=.*(?:\\r?\\n|$)','gm'),'');
  text+=(text.endsWith('\n')?'':'\n')+name+'='+value+'\n';
 }
 writeFileSync(envPath,text,{mode:0o600});
 console.log('Gemini configured in .env.local. Existing session and OCR.space settings were kept. The key was not displayed. Restart with npm run dev.');
}
