import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
const dir=mkdtempSync(join(tmpdir(),'visadesk-gemini-setup-'));
const root=new URL('../',import.meta.url);
const key='mock.gemini-key-for-hidden-input';
try{
 mkdirSync(join(dir,'scripts'));
 mkdirSync(join(dir,'src'));
 copyFileSync(new URL('src/ocr-config.js',root),join(dir,'src','ocr-config.js'));
 for(const filename of ['env.mjs','setup.mjs','configure-gemini.mjs','configure-ocr.mjs','doctor.mjs'])copyFileSync(new URL('scripts/'+filename,root),join(dir,'scripts',filename));
 const path=join(dir,'.env.local');
 writeFileSync(path,'export SESSION_ENCRYPTION_KEY=existing-session-key\nOCR_PROVIDER=ocr-space\nOCR_SPACE_API_KEY=existing-ocr-private-key\nOCR_SPACE_ENGINE=3\nAPP_PASSWORD=existing-private-password\n');
 let result=spawnSync(process.execPath,['scripts/configure-gemini.mjs'],{cwd:dir,input:key+'\n',encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 let settings=parseEnv(readFileSync(path,'utf8'));
 assert.equal(settings.OCR_PROVIDER,'auto');assert.equal(settings.GEMINI_API_KEY,key);assert.equal(settings.GEMINI_MODEL,'gemini-3.5-flash-lite');
 assert.equal(settings.SESSION_ENCRYPTION_KEY,'existing-session-key');assert.equal(settings.OCR_SPACE_API_KEY,'existing-ocr-private-key');assert.equal(settings.OCR_SPACE_ENGINE,'3');assert.equal(settings.APP_PASSWORD,'existing-private-password');
 assert(!result.stdout.includes(key));assert(!result.stderr.includes(key));
 const before=readFileSync(path,'utf8');
 result=spawnSync(process.execPath,['scripts/configure-gemini.mjs'],{cwd:dir,input:'paste a whole email\n',encoding:'utf8',timeout:10000});
 assert.equal(result.status,1);assert.equal(readFileSync(path,'utf8'),before);
 result=spawnSync(process.execPath,['scripts/configure-ocr.mjs'],{cwd:dir,input:'mock-ocr-new-private-key\n',encoding:'utf8',timeout:10000});assert.equal(result.status,0);
 settings=parseEnv(readFileSync(path,'utf8'));assert.equal(settings.OCR_PROVIDER,'auto');assert.equal(settings.GEMINI_API_KEY,key);assert.equal(settings.OCR_SPACE_API_KEY,'mock-ocr-new-private-key');assert.equal(settings.SESSION_ENCRYPTION_KEY,'existing-session-key');assert(!result.stdout.includes('mock-ocr-new-private-key'));
 result=spawnSync(process.execPath,['scripts/doctor.mjs'],{cwd:dir,encoding:'utf8',timeout:10000});assert.equal(result.status,0);assert(result.stdout.includes('GEMINI_API_KEY: SET'));assert(result.stdout.includes('OCR provider: gemini'));assert(!result.stdout.includes('selected provider requires'));
 for(const secret of [key,'existing-ocr-private-key','existing-private-password','existing-session-key'])assert(!result.stdout.includes(secret));
 assert(result.stdout.includes('OCR.space backup: SET'));assert(!result.stdout.includes('mock-ocr-new-private-key'));
 // Even an old provider value displays the effective Gemini-first selection.
 writeFileSync(path,readFileSync(path,'utf8').replace('OCR_PROVIDER=auto','OCR_PROVIDER=ocr-space'));
 result=spawnSync(process.execPath,['scripts/doctor.mjs'],{cwd:dir,encoding:'utf8',timeout:10000});assert.equal(result.status,0);assert(result.stdout.includes('OCR provider: gemini'));
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS: hidden Gemini setup, preserved existing secrets/settings, rejected invalid input and private configuration diagnostics.');
