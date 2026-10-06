# Vercel-এ VisaDesk ডেপ্লয়

আগের production আপডেট করছেন? এই ZIP-এর **পুরো project**, বিশেষ করে নতুন `api/track.js`, দিন। Existing environment variables রাখুন এবং নতুন Production deployment করুন। চাইলে `/api/config`-এ `version: "1.1.3"` দেখে নতুন backend যাচাই করুন; ট্র্যাকার চালাতে এই চেক লাগে না। বিস্তারিত `PRODUCTION_FIXES.md`-তে আছে।

## ১. ফোল্ডার প্রস্তুত

ZIP extract করুন। `visadesk-vercel` ফোল্ডারের মধ্যে `package.json`, `vercel.json`, `api`, `src`, `scripts` থাকবে। আগের `.env.local` রাখুন। নতুন ফোল্ডারে settings না থাকলে terminal-এ:

```sh
npm install
npm run configure-ocr
npm run doctor
```

Key চাইলে আপনার OCR key দিন। `.env.local` GitHub-এ দেবেন না।

## ২. GitHub-এ কোড দিন

GitHub-এ একটি নতুন private repository তৈরি করুন। এই project ফোল্ডারে terminal খুলে নিচের কমান্ড চালান; URL-এ নিজের repository-এর ঠিকানা দিন:

```sh
git init
git add .
git commit -m "Prepare VisaDesk for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

এই ফোল্ডারের `.gitignore` `.env.local` বাদ দেয়। আগে থেকেই Git repository থাকলে remote পুনরায় যোগ করার প্রয়োজন নেই; পরিবর্তন commit ও push করুন। GitHub-এ `package.json` সরাসরি root-এ থাকা সবচেয়ে সহজ।

## ৩. Vercel-এ import

https://vercel.com খুলুন → Add New → Project → GitHub repository → Import।

| Setting | এই project-এর জন্য মান |
|---|---|
| Framework Preset | Other |
| Root Directory | `package.json` যেখানে আছে। সরাসরি repo root-এ থাকলে `.`; nested হলে `visadesk-vercel` |
| Build Command | Override চালু রেখে ঘর খালি রাখুন; build step নেই |
| Output Directory | Override বন্ধ রাখুন |
| Install Command | Default রাখুন |
| Node.js | 24.x; কোডে Node 22+ সমর্থিত |

`npm run dev` Build Command-এ দেবেন না।

## ৪. Environment Variables

Import পেইজের Environment Variables অংশে অথবা Project Settings → Environment Variables-এ নিচের চারটি variable দিন। Production এবং Preview নির্বাচন করুন।

| Name | Value |
|---|---|
| SESSION_ENCRYPTION_KEY | আপনার local `.env.local`-এ এই নামের `=`-এর পরের পুরো মান |
| OCR_PROVIDER | ocr-space |
| OCR_SPACE_API_KEY | ইমেইলে পাওয়া নিজের OCR key |
| OCR_SPACE_ENGINE | 2 |

Value-তে variable-এর নাম বা `=` দেবেন না। Key-এর চারপাশে quotation mark দেবেন না। SESSION_ENCRYPTION_KEY নিজে ছোট password বানিয়ে দেবেন না; setup-এ তৈরি মান ব্যবহার করুন। PORT এবং OPENAI_API_KEY প্রয়োজন নেই। Optional login চাইলে APP_USERNAME ও APP_PASSWORD দুটোই সেট করুন।

## ৫. Deploy ও পরীক্ষা

Deploy চাপুন। Ready হলে পাওয়া URL খুলে Ctrl+Shift+R দিয়ে refresh করুন। BGD/passport দিন → নতুন CAPTCHA ছবি ও লেখা মিলিয়ে নিশ্চিত করুন → দুই ফলাফল দেখুন → ছবি সেভ করুন। আগের খোলা পেইজের CAPTCHA ব্যবহার করবেন না।

Settings যাচাই করতে নিজের URL-এর শেষে `/api/config` খুলুন। `provider: "ocr-space"`, `configured: true` মানে চলমান deployment setting পেয়েছে; এটি key-এর বৈধতা বা OCR accuracy নিশ্চিত করে না।

Variable পরে যোগ বা পরিবর্তন করলে Deployments → সাম্প্রতিক deployment-এর ⋯ → Redeploy করুন।

## সমস্যা হলে

- 404: Root Directory-তে `package.json` ও `api` আছে কি না দেখুন।
- Session setup error: SESSION_ENCRYPTION_KEY-এর সম্পূর্ণ local মান দিন এবং Redeploy করুন।
- OCR setting কাজ করছে না: Production environment নির্বাচন ও Redeploy হয়েছে কি না দেখুন।
- Function চালু হয় না: Vercel-এর deployment-এর Build Logs ও runtime error-এর লেখা দেখুন। এই সংস্করণ custom server logs লেখে না। পুরো project আপডেট, সঠিক Root Directory এবং `vercel.json`-এর `includeFiles` আছে কি না যাচাই করুন।
- সাইট খুলছে কিন্তু source তথ্য আসে না: পেইজের বাংলা বার্তা অনুযায়ী নতুন ছবি নিন বা পরে retry করুন। সঠিক নম্বর ও CAPTCHA দেওয়ার পরেও ব্যর্থ হলে deployment URL ও error-এর লেখা দিয়ে যাচাই করতে হবে।

OCR-এর 503 থাকলে Network → `track?action=read-captcha` → Response-এর `code` দেখুন। `PRODUCTION_FIXES.md`-তে code-এর অর্থ দেওয়া আছে। পুরোনো WebAssembly CSP error নতুন কোডে সংশোধিত হয়েছে; deploy-এর পরে Ctrl+Shift+R দিয়ে refresh করুন।

`/api/track`-এ 404 হলে নতুন `api/track.js` repository-তে আছে কি না এবং সঠিক commit deploy হয়েছে কি না দেখুন। সঠিক CAPTCHA দিয়েও Visa ব্যর্থ হলে `track?action=check-status` response-এর `code` সংগ্রহ করুন। Token, cookie বা API key শেয়ার করবেন না।

এই package আপনার Vercel account-এ live deploy করে পরীক্ষা করা হয়নি।

Official references:
https://vercel.com/docs/git
https://vercel.com/docs/builds/configure-a-build
https://vercel.com/docs/environment-variables
https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
