import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
globalThis.crypto ??= webcrypto;
const {default:worker,interpret,parseForm}=await import('../src/worker.js');
const originalFetch=globalThis.fetch;
const ivacForm='<form action="#"><input type="text"></form><form name="frm_dhaka" method="post" action="" id="search_data"><input name="appref1" type="text"><input name="captcha" id="captcha-form" type="text"><img src="captcha.php" id="captcha"><input name="submit" type="submit" value="Submit"></form>';
const actualVisaForm='<form method="post" action="StatusEnquiry"><input name="filerfno" id="application_id"><input name="passport_number" id="passport_no"><input name="captcha" id="captcha"><img src="captcha" id="capt"><input type="hidden" name="token" value="preserved"></form>';
const ivacParsed=parseForm(ivacForm,'https://www.passtrack.net/regular_passport.php','ivac');assert.equal(ivacParsed.app,'appref1');assert.equal(ivacParsed.action,'https://www.passtrack.net/regular_passport.php');assert.equal(ivacParsed.fields.submit,'Submit');
const visaParsed=parseForm(actualVisaForm,'https://indianvisaonline.gov.in/visa/StatusEnquiry','visa');assert.equal(visaParsed.app,'filerfno');assert.equal(visaParsed.passport,'passport_number');assert.equal(visaParsed.fields.token,'preserved');

// Actual source wording from the two supplied screenshots.
assert.equal(interpret('<div>Your visa is processed is <b>Granted but Not-Printed</b>. Once visa is printed, please contact the respective office.</div>','visa').stage,'granted_not_printed');
assert.equal(interpret('<div>Your visa is Processed and Printed. If not collected earlier, please contact the respective office.</div>','visa').stage,'granted_printed');
assert.equal(interpret('<div class="status">Granted and Printed</div>','visa').stage,'granted_printed');
assert.equal(interpret('<div class="status">Granted but not printed. Once printed contact the office.</div>','visa').stage,'granted_not_printed');
assert.throws(()=>interpret('<p>Once your visa is printed, contact the office.</p>','visa'),/ফলাফল/);

const env={SESSION_ENCRYPTION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')};
const form='<form method="post" action="/visa/StatusEnquiry"><input type="hidden" name="csrf" value="source-token"><input name="application_id"><input name="passport_no"><input name="captcha"><img src="/visa/captcha.png"></form>';
let submitted;
globalThis.fetch=async (url,opts)=>{
 if(url.endsWith('StatusEnquiry')&&opts.method!=='POST')assert.equal(opts.headers.get('Referer'),'https://indianvisaonline.gov.in/visa/index.html');
 if(url.endsWith('captcha.png'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
 if(opts.method==='POST'){submitted=opts;return new Response('<div id="status-result">Visa application is Under Processing.</div>');}
 return new Response(form,{headers:{'Set-Cookie':'JSESSIONID=source-session; Path=/; Secure; HttpOnly'}});
};
const call=(path,body,origin='https://tracker.test')=>worker.fetch(new Request('https://tracker.test'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-visadesk-session':'owner'},body:JSON.stringify(body)}),env);
assert.throws(()=>interpret('<p>Passports will be ready for delivery after processing.</p>','ivac'),/ফলাফল/);
assert.equal(interpret('<div id="search-result">Ready For Delivery</div>','ivac').stage,'ready');
const workflow='<table><tr><th>Step</th><th>Process</th><th>Status</th></tr><tr><td>1</td><td>Received At Center</td><td>Done</td></tr><tr><td>2</td><td>Process Initiated</td><td>Done</td></tr><tr><td>3</td><td>Ready For Delivery</td><td>-</td></tr><tr><td>4</td><td>Delivered From Center</td><td>-</td></tr></table>';
assert.equal(interpret(workflow,'ivac').stage,'processing');assert.deepEqual(interpret(workflow,'ivac').deliverySteps.map(s=>s.done),[true,true,false,false]);
assert.equal(interpret(workflow.replace('<td>Process Initiated</td><td>Done</td>','<td>Process Initiated</td><td>-</td>'),'ivac').stage,'received');
assert.equal(interpret('<div class="status">Visa has been granted</div>','visa').stage,'success');
assert.throws(()=>interpret('<div class="alert">Invalid captcha</div>','visa'),/ক্যাপচা/);
assert.throws(()=>interpret('<div>Status: * Plase enter correct code</div>','ivac'),/ক্যাপচা/);
assert.throws(()=>interpret('<p>No record found</p>','ivac'),/রেকর্ড/);
assert.equal(interpret('<div>Your visa application is Under Processing.</div>','visa').stage,'processing');
let res=await call('/api/prepare',{source:'visa'});assert.equal(res.status,200);const session=await res.json();assert(session.captcha.startsWith('data:image/png;base64,'));assert(!session.token.includes('source-session'));assert(!session.token.includes('source-token'));
res=await call('/api/check-status',{source:'visa',token:session.token,applicationId:'BGDABCDEFGHI1',passportNo:'A12345678',captcha:'abc12'});assert.equal(res.status,200);assert.equal((await res.json()).result.stage,'processing');assert.equal(new URLSearchParams(submitted.body).get('csrf'),'source-token');assert(submitted.headers.get('Cookie').includes('JSESSIONID=source-session'));
res=await call('/api/check-status',{source:'ivac',token:session.token,applicationId:'BGDABCDEFGHI1',passportNo:'A12345678',captcha:'abc12'});assert.equal(res.status,422);
res=await call('/api/check-status',{source:'visa',token:'tampered',applicationId:'BGDABCDEFGHI1',passportNo:'A12345678',captcha:'abc12'});assert.equal(res.status,422);
res=await call('/api/prepare',{source:'visa'},'https://attacker.test');assert.equal(res.status,403);
res=await call('/api/prepare',{source:'other'});assert.equal(res.status,400);
const pageResponse=await worker.fetch(new Request('https://tracker.test/'),env);assert(pageResponse.headers.get('Content-Security-Policy').includes("'wasm-unsafe-eval'"));const page=await pageResponse.text();const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);assert(page.includes('VisaDesk'));assert(!page.includes('Sites Worker ESM starter'));
globalThis.fetch=originalFetch;
console.log('PASS: source status parsing, encrypted CAPTCHA session, cookie continuity, form submission, tamper/source rejection, origin validation, client JavaScript syntax.');
