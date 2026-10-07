import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const dir=mkdtempSync(join(tmpdir(),'visadesk-deploy-'));
function run(code,cwd=dir){
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd,encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr||result.error?.message);
}
try{
 // Simulate Vercel moving JS modules away from the explicitly included HTML.
 mkdirSync(join(dir,'bundle'));mkdirSync(join(dir,'src'));
 writeFileSync(join(dir,'package.json'),JSON.stringify({type:'module'}));
 for(const name of ['worker.js','handler.js','vision.js','ocr-space.js','gemini.js','ocr-config.js','cookies.js'])copyFileSync(new URL('src/'+name,root),join(dir,'bundle',name));
 copyFileSync(new URL('src/index.html',root),join(dir,'src','index.html'));
 run(`
  import assert from 'node:assert/strict';
  import worker from './bundle/worker.js';
  import {handle} from './bundle/handler.js';
  const config=await worker.fetch(new Request('https://test.invalid/api/config'),{});
  assert.equal(config.status,200);assert.equal((await config.json()).version,'1.1.7');
  const page=await handle(new Request('https://test.invalid/'),{});
  assert.equal(page.status,200);assert((await page.text()).includes('delivery-step-cards'));
  assert(page.headers.get('set-cookie').includes('HttpOnly'));
 `);
 // An absent asset must not fail module import or unrelated API cold starts.
 rmSync(join(dir,'src','index.html'));
 run(`
  import assert from 'node:assert/strict';
  import worker from './bundle/worker.js';
  import {handle} from './bundle/handler.js';
  assert.equal((await worker.fetch(new Request('https://test.invalid/api/config'),{})).status,200);
  assert.equal((await worker.fetch(new Request('https://test.invalid/api/prepare'),{})).status,405);
  assert.equal((await handle(new Request('https://test.invalid/'),{})).status,500);
 `);
 // Local launches from another directory still resolve the module-relative HTML.
 run(`
  import assert from 'node:assert/strict';
  const {default:worker}=await import(${JSON.stringify(new URL('src/worker.js',root).href)});
  const page=await worker.fetch(new Request('http://localhost/'),{});
  assert.equal(page.status,200);assert((await page.text()).includes('delivery-step-cards'));
 `);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS: relocated server modules, included HTML path, API cold starts without HTML, and local path fallback.');
