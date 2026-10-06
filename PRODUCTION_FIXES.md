# Vercel আপডেট — v1.1.1

আগের সরাসরি CAPTCHA প্রস্তুত → লেখা যাচাই → ফলাফল দেখার ফ্লো ফিরিয়ে দেওয়া হয়েছে। নতুন custom server logging ও request ID সরানো হয়েছে। ফ্রন্টএন্ডের বাধ্যতামূলক `/api/config` চেক এবং প্রথম POST-এ `SESSION_REQUIRED` বাধাও বাদ দেওয়া হয়েছে। পেইজ খোলার সময় আগের মতো HttpOnly cookie তৈরি হয়; সরাসরি প্রথম CAPTCHA প্রস্তুতের অনুরোধও cookie পায়। Token এখনও সেই browser session-এর সঙ্গে বাঁধা থাকে।

Vercel-এ server modules অন্য জায়গায় bundle হলেও `src/index.html` project root থেকে লোড হবে। HTML শুধু home page চাইলে পড়া হয়; module import বা API cold start-এ পড়া হয় না। `vercel.json`-এ HTML-এর `includeFiles` ও আগের API routes আছে।

নতুন ডিজাইন, loading progress, বাংলা ব্যাখ্যা, চারটি ধাপের কার্ড, source-confirmed শতাংশ, night mode, suggestions ও PNG save রাখা হয়েছে। সঠিক status parsing, OCR-এ অক্ষরের case, timeout, friendly errors ও একটি উৎসের ফলাফল রেখে অন্যটি retry করার সংশোধনও রয়েছে।

## আগের deployment আপডেট করুন

1. ZIP extract করে **পুরো project-এর কোড** আপনার repository-তে দিন। শুধু `src/index.html` বদলাবেন না। `api`, `src`, `scripts`, `tests`, `vercel.json`, `package.json` ও `package-lock.json` সব আপডেট করুন। পুরোনো `src/errors.js` আর প্রয়োজন নেই।
2. আগের `.env.local` এবং Vercel-এর Environment Variables রাখুন। ZIP-এ আসল API key নেই। `SESSION_ENCRYPTION_KEY` পরিবর্তনের প্রয়োজন নেই।
3. Vercel-এ Root Directory হবে `package.json` যে ফোল্ডারে আছে। Framework হবে Other, Build Command override খালি এবং Output Directory override বন্ধ। Build Command-এ `npm run dev` দেবেন না।
4. Commit/push করে নতুন Production deployment করুন। Ready হলে পেইজ refresh করে নতুন CAPTCHA নিন।
5. চাইলে নিজে `/api/config` খুলে `version: "1.1.1"` দেখুন। ট্র্যাকার এই endpoint-এর ওপর নির্ভর করে না। `configured: true` শুধু OCR setting উপস্থিত বোঝায়।

পুরোনো খোলা পেইজে নতুন deployment-এর আগে তৈরি CAPTCHA token ব্যবহার করবেন না। ব্রাউজারের first-party cookies চালু থাকতে হবে। স্বয়ংক্রিয়ভাবে বসানো লেখাটি ছবির সঙ্গে মিলিয়ে নিশ্চিত করুন।

## পরীক্ষা ও সীমা

`npm test`-এ সরাসরি প্রথম preparation, parallel source sessions, OCR/image binding, parsing, timeout, retry, চার ধাপের UI, PNG save ও suggestions পরীক্ষা করা হয়। Server modules সরিয়ে রেখে included HTML লোড হওয়া এবং HTML অনুপস্থিত হলেও API cold start কাজ করা আলাদা পরীক্ষায় যাচাই করা হয়েছে। Source responses পরীক্ষায় mock করা হয়।

আপনার আসল Vercel deployment-এর error না দেখে ব্যর্থতার কারণ logging ছিল বলে নিশ্চিত করা যায় না। এই package আপনার account-এ live deploy করে পরীক্ষা করা হয়নি। এখনও সমস্যা হলে deployment URL এবং Vercel-এর build/runtime error-এর লেখা দিয়ে নির্দিষ্ট কারণ পরীক্ষা করা যাবে। API key পাঠানোর প্রয়োজন নেই।

কোডে source requests-এর shared budget ৪৫ সেকেন্ড, client response timeout ৫৫ সেকেন্ড এবং Vercel function duration ৬০ সেকেন্ড রাখা হয়েছে। CAPTCHA জমা দেওয়ার POST নিজে থেকে replay হয় না।
