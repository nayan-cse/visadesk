import {randomBytes} from 'node:crypto';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {envPath} from './env.mjs';
const defaults={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),APP_USERNAME:'',APP_PASSWORD:'',PORT:'3000',OPENAI_API_KEY:'',OPENAI_VISION_MODEL:'gpt-4.1-mini',GEMINI_API_KEY:'',GEMINI_MODEL:'gemini-3.5-flash-lite',OCR_PROVIDER:'auto',OCR_SPACE_API_KEY:'',OCR_SPACE_ENGINE:'2'};
const exists=existsSync(envPath);let text=exists?readFileSync(envPath,'utf8'):'';
for(const [name,value]of Object.entries(defaults)){
 if(!new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=','m').test(text))text+=(text&&!text.endsWith('\n')?'\n':'')+name+'='+value+'\n';
}
writeFileSync(envPath,text,{mode:0o600});
console.log(exists?'Kept existing settings; added any missing setup fields.':'Created .env.local with a fresh session key.');
console.log('Choose npm run configure-gemini for Gemini, or npm run configure-ocr for OCR.space.');
