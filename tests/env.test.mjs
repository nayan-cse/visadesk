import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadLocalEnv} from '../scripts/env.mjs';
import {handle} from '../src/handler.js';
import {randomBytes} from 'node:crypto';
const dir=mkdtempSync(join(tmpdir(),'visadesk-env-'));
try{
 const path=join(dir,'.env.local');writeFileSync(path,'\ufeffOCR_SPACE_API_KEY=mock-local-key\r\nOCR_PROVIDER=ocr-space\r\n');
 const {env,exists}=loadLocalEnv(path,{OCR_SPACE_API_KEY:'',OTHER:'keep'});
 assert(exists);assert.equal(env.OCR_SPACE_API_KEY,'mock-local-key');assert.equal(env.OTHER,'keep');
 assert(!loadLocalEnv(join(dir,'missing'),{}).exists);
 const settings={...env,SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
 let r=await handle(new Request('https://demo.test/api/config'),settings);assert.equal(r.status,200);let data=await r.json();assert(data.configured);assert(!JSON.stringify(data).includes('mock-local-key'));
 r=await handle(new Request('https://demo.test/api/config'),{...settings,OCR_SPACE_API_KEY:'  '});assert.equal((await r.json()).configured,false);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS: project env loading, BOM/Windows lines, inherited blank override and configuration status without key disclosure.');
