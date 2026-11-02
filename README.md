# मुंशी किराना स्टोर (Munsi Kirana Store) — Progressive Web App (PWA)

A production-grade, zero-cost Progressive Web App (PWA) designed specifically for an Indian family kirana shop. Built with React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, Dexie (IndexedDB), and Supabase.

---

## 🌟 Key Features

1. **Family Branding & PhonePe-Style Usability:**
   - Deep purple `#5F259F` header, high-contrast white cards, large 56px minimum touch targets, and Dadaji monogram branding.
   - Dual-language support: Hindi (हिन्दी) first with instant English toggle.

2. **Precision Bilingual Voice & Text Search:**
   - Browser Web Speech API (`hi-IN` & `en-IN`) for speaking Hindi product names (e.g., *"mungfali ka tel"* or *"chini"*).
   - Instant prefix auto-suggest (e.g. typing `"SU"` suggests Sugar at ₹60/kg).
   - Secret `(i)` button to privately inspect purchase cost price and attached wholesale bill photo.

3. **Smart Billing & Self-Learning Inventory:**
   - Real-time line-level rate overrides (e.g., selling Sugar at ₹59.50/kg for a regular customer applies to that bill only without modifying catalog defaults).
   - Support for loose units: kg ↔ g, litre ↔ ml, piece units (e.g., 250g @ ₹60/kg = ₹15.00).
   - Auto-learning unseen items and new pack variants upon bill submission.
   - Market basket analysis (Apriori pair association engine) suggesting frequently paired items (e.g., Sugar + Tea).
   - Payment splitting: Cash (with exact tendered & change calculation), owner-confirmed UPI, and Udhaar credit remainder.
   - In-progress draft auto-save across phone reboots or interruptions.

4. **Authoritative Indian Kirana Byaj Calculator (Compound Interest):**
   - Exact calendar duration calculation (Years, Months, Days) with leap-year clamping and 30-day residual month convention ($M + D/30$).
   - Annual capitalization for completed anniversaries.
   - Multi-entry loan calculations with grand total summing.
   - 100% deterministic bilingual explanation available offline.

5. **Customer Credit Ledger (Udhaar Khata):**
   - Running chronological statements of debits, repayments, and audit reversals.
   - Repayment allocations (oldest-first or specific charge).
   - One-tap polite WhatsApp payment reminders.

6. **Restricted Public Receipts:**
   - Dedicated customer invoice view (`/r/:shareToken`) exposing only allowlisted public receipt fields while strictly protecting store margins, wholesale images, and internal notes.

7. **Encrypted Full Backup & Restore:**
   - Web Crypto PBKDF2 (100,000 iterations, SHA-256) and AES-GCM (256-bit) client-side authenticated encryption.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Brand Assets & PWA Icons
```bash
npm run generate-assets
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
```

---

## 📁 Project Architecture

```text
src/
  app/                 router, providers, app layout
  components/          Header, BottomNav, InfoModal, DateInput
  domain/              Pure financial & domain logic
    money.ts           Paise rounding, INR formatting, validation
    units.ts           kg/g, l/ml conversions, line total calculations
    interest.ts        Byaj arithmetic engine, calendar duration, fixtures
    matching.ts        Bilingual voice & text prefix search
    billing.ts         Bill snapshots, settlements, payment splits
    ledger.ts          Khata statements, repayments, reversals
    associations.ts    Market basket Apriori pair suggestions
  data/                IndexedDB Dexie database schema & demo seed
  features/
    home/              Dashboard & voice search
    billing/           Create bill & basket management
    inventory/         Inventory list & bulk wholesale photo attachment
    interest/          Compound interest calculator
    ledger/            Khata list & running statements
    receipts/          Public receipt & bill history
    reports/           Daily overview & encrypted backup/restore
  integrations/        Speech API, WhatsApp deep linking, image compression, backup
  i18n/                Comprehensive Hindi & English translations
public/                PWA icons, manifest, _redirects, _headers
supabase/              setup.sql schema, RLS policies & security definer functions
docs/                  Architecture, free services, parent guide
```

---

## 📄 License
MIT. Made with care for family kirana shops.
