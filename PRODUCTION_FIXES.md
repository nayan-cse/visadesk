# প্রোডাকশন সংশোধন — v1.1.0

এই সংস্করণে কোডে পাওয়া নির্দিষ্ট ত্রুটি সংশোধন করা হয়েছে। আপনার live deployment-এর URL/logs ছাড়া মাঝেমধ্যে ব্যর্থ হওয়ার একক কারণ নিশ্চিত করা যায়নি। মূল সাইটের downtime, ভুল OCR, upstream session বা server access restriction থাকলে নতুন কোডও সবসময় ফলাফল পাবে না। তখন কারণ অনুযায়ী বার্তা দেখাবে।

## আগের deployment আপডেট করুন

1. ZIP extract করে পুরো `visadesk-vercel` project-এর কোড আপনার repository-তে আপডেট করুন। শুধু UI ফাইল বদলাবেন না; `api`, `src`, `scripts`, `vercel.json`, `package.json` সব দিন।
2. নিজের আগের `.env.local` রাখুন। ZIP-এ আসল API key নেই। Vercel-এর existing environment variables-ও রাখুন।
3. `SESSION_ENCRYPTION_KEY` একই project/environment-এর সব function-এ একই থাকতে হবে। প্রতি deploy-এ নতুন key তৈরি করার দরকার নেই। Key বদলালে পুরোনো CAPTCHA token কাজ করবে না; নতুন ছবি নিন।
4. কোড commit/push করুন এবং নতুন Production deployment Ready হওয়া পর্যন্ত অপেক্ষা করুন। `VERCEL_GUIDE.md`-তে পুরো নির্দেশনা আছে।
5. নিজের production URL-এর `/api/config` খুলুন। `version: "1.1.0"` মানে নতুন backend চলছে। `configured: true` শুধু OCR setting উপস্থিত বোঝায়; OCR নির্ভুলতা বোঝায় না।
6. পুরোনো খোলা পেইজ refresh করুন। তারপর নতুন ছবি প্রস্তুত করুন, বড়/ছোট অক্ষরসহ লেখা মিলিয়ে ফলাফল দেখুন।

ব্রাউজারে first-party cookies চালু থাকতে হবে। ক্যাপচার স্বয়ংক্রিয়ভাবে পড়া লেখা দেখে ঠিক না থাকলে সংশোধন করুন। ব্যর্থতার পরে “আবার চেক করুন” শুধু ব্যর্থ উৎসে নতুন ছবি আনবে; নিশ্চিত করার পরে নতুন status query হবে।

## সমস্যা হলে Vercel logs দেখুন

Vercel project-এর Logs-এ `[VisaDesk]` খুঁজুন। এই সংস্করণ শুধু version, source, route, requestId, error code, upstream HTTP status (থাকলে) ও সময় log করে। ব্যক্তিগত নম্বর ও key log করা হয় না।

| Code | কী বোঝায় / পরবর্তী কাজ |
|---|---|
| CAPTCHA_INVALID | মূল সাইট ক্যাপচা ভুল বলেছে। নতুন ছবি নিয়ে অক্ষর মিলিয়ে নিশ্চিত করুন। |
| SESSION_EXPIRED | স্থানীয় token পুরোনো, বদলেছে বা browser cookie মেলেনি। refresh করে নতুন ছবি নিন। |
| SOURCE_SESSION_EXPIRED | মূল সাইট session-expiry জানিয়েছে বা result POST-এর পরে home/login-এ পাঠিয়েছে। নতুন ছবি নিয়ে আবার নিশ্চিত করুন। |
| SOURCE_RESULT_MISSING | ফলাফলের বদলে input form এসেছে। নতুন ছবি নিয়ে আবার চেক করুন। কেন form এসেছে, এই code একা তা নিশ্চিত করে না। |
| SOURCE_TIMEOUT / SOURCE_NETWORK | মূল সাইট ধীর বা connection ব্যর্থ। কিছুক্ষণ পরে আবার চেষ্টা করুন। |
| SOURCE_UNAVAILABLE | মূল সাইট non-success HTTP response দিয়েছে। পাশে upstreamStatus দেখুন। |
| SOURCE_ACCESS_BLOCKED | source 401/403 বা access challenge ফেরত দিয়েছে। এটি OCR ভুলের প্রমাণ নয়। |
| SOURCE_FORM_UNAVAILABLE | status form পাওয়া যায়নি বা home page এসেছে। Source access/form বদলেছে কি না যাচাই করুন। |
| RESULT_UNRECOGNIZED | source response এসেছে, কিন্তু নিশ্চিত পরিচিত status মেলেনি। parser/source response আরও যাচাই দরকার। |
| NO_RECORD | মূল সাইট no-record জানিয়েছে। আবেদন ও পাসপোর্ট নম্বর মিলিয়ে দেখুন। |

পরেও ব্যর্থ হলে production URL, ঘটনার সময় এবং ওই সময়ের `[VisaDesk]` code/requestId দিলে নির্দিষ্ট সমস্যা পরীক্ষা করা যাবে। কোনো API key, পাসপোর্ট নম্বর, source cookie বা token পাঠানোর দরকার নেই।

## পরীক্ষার সীমা

`npm test`-এ সফল/ব্যর্থ source responses, static CAPTCHA instructions, expired/bound sessions, parallel preparations, GET retry, POST replay না হওয়া, total timeout, redirect cookies, provider/image binding, retry flow, PNG ও suggestions পরীক্ষা করা হয়। পরীক্ষায় upstream responses mock করা হয়েছে। Live production query-এর বিকল্প নয়।

২০২৬-১০-০৬ তারিখে এই workspace থেকে দুই মূল উৎসে live prepare request চালিয়ে CAPTCHA ছবি সফলভাবে পাওয়া গেছে। ওই পরীক্ষায় BGD/passport পাঠানো হয়নি। এটি আপনার Vercel server-এর network বা আসল result query যাচাই করে না।

`vercel.json`-এ function duration ৬০ সেকেন্ড। কোডে upstream-এর shared budget ৪৫ সেকেন্ড; client response timeout ৫৫ সেকেন্ড। Hosting platform-generated non-JSON 504 response-ও CAPTCHA ভুল হিসেবে দেখানো হয় না।

Reference: https://vercel.com/docs/functions/configuring-functions/duration
