# Free Services Documentation & Operational Limits

**Verified Date:** 2 November 2026  
**Project:** Munsi Kirana Store  
**Target:** 100% Zero-Cost Operation within Free Tiers

---

## 1. Hosting — Cloudflare Pages (Recommended)
- **Official Documentation:** https://pages.cloudflare.com/ & https://developers.cloudflare.com/pages/platform/limits/
- **Free Tier Allowances:**
  - Unlimited static requests & bandwidth
  - 500 builds per month
  - 100 custom domains (or free `*.pages.dev` subdomain)
  - Commercial use permitted under standard Pages terms
- **Why Preferred over Vercel:**
  - Vercel Hobby terms historically limit deployments to non-commercial personal projects. Cloudflare Pages permits small commercial storefront PWAs on the free tier.
- **Failover / Fallback:**
  - SPA client routes work offline once installed via Service Worker.
  - In case of hosting disruption, PWA cached assets continue running locally on parents' phones.

---

## 2. Database, Authentication & Storage — Supabase
- **Official Documentation:** https://supabase.com/pricing & https://supabase.com/docs/guides/database/postgres/row-level-security
- **Free Tier Allowances:**
  - 500 MB PostgreSQL database storage (ample for 50,000+ bills and 10,000 customers)
  - 1 GB private file storage (for compressed wholesale bill photos)
  - 50,000 monthly active users (MAU)
  - 500,000 Edge Function invocations / month
- **Commercial Eligibility:**
  - Commercial use permitted on Supabase Free Plan.
- **Limits & Safeguards:**
  - Inactivity pause: Free projects pause after 7 days of inactivity. Antigravity local-first IndexedDB architecture ensures shop continues working 100% even if cloud is paused or offline.
  - Image optimization: Client-side HTML5 canvas compression compresses receipts to ~100 KB, allowing ~10,000 wholesale bills within 1 GB limit.
- **Failover / Fallback:**
  - Local Dexie IndexedDB cache and transactional outbox. Reconnection automatically syncs when network is restored.

---

## 3. Voice Recognition — Web Speech API
- **Official Documentation:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **Cost:** Free, native browser capability (Chrome for Android `webkitSpeechRecognition`).
- **Languages:** `hi-IN` (Hindi India) primary, fallback to `en-IN` (English India).
- **Fallback:**
  - If microphone permission is denied, offline, or unsupported, keyboard text search is always available with instant Hindi/Hinglish prefix matching.

---

## 4. Messaging & Bill Sharing — WhatsApp Click-to-Chat
- **Official Documentation:** https://faq.whatsapp.com/5913398998672934
- **Cost:** ₹0. Uses standard `https://wa.me/91XXXXXXXXXX?text=...` deep linking.
- **Behavior:**
  - Opens the parent's native WhatsApp app with pre-filled message text and public bill URL.
  - Requires the parent to tap "Send" in WhatsApp. No WhatsApp Business API fees or third-party gateways required.
- **Fallback:**
  - If WhatsApp is not installed, clipboard copy and direct on-screen receipt view / printable PDF are provided.

---

## 5. AI Explanations — OpenRouter Free Models (Optional)
- **Official Documentation:** https://openrouter.ai/models
- **Cost:** Free models (e.g. `mistralai/mistral-7b-instruct:free`).
- **Safeguard:**
  - Strictly optional. Authoritative byaj calculations and bilingual explanations are computed deterministically 100% offline.
  - If OpenRouter API key is missing or rate-limited, the deterministic explanation is displayed without error.
