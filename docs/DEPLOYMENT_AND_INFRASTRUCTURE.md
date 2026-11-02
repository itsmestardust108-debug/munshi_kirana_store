# Munsi Kirana Store — Live Infrastructure & Deployment Details

**Last Updated:** November 2026  
**Status:** In Production (100% Zero-Cost Operating Stack)

---

## 1. Live Production Deployment

| Property | Value |
| :--- | :--- |
| **Live PWA URL** | [https://munshi-kirana-store.pages.dev](https://munshi-kirana-store.pages.dev) |
| **Hosting Platform** | Cloudflare Pages (Global Edge Network, Mumbai / Delhi / Bangalore edge PoPs) |
| **Git Provider** | GitHub |
| **Repository URL** | [https://github.com/itsmestardust108-debug/munshi_kirana_store](https://github.com/itsmestardust108-debug/munshi_kirana_store) |
| **Production Branch** | `main` |
| **Framework Preset** | `None` (Vite) |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Root Directory** | `/` |
| **Monthly Hosting Cost** | ₹0.00 (Unlimited bandwidth & static requests) |

---

## 2. GitHub Configuration & Access

* **Owner Account:** `itsmestardust108-debug`
* **Collaborator (with push access):** `Cdbrain108`
* **Local Git Configuration for this Repo:**
  * Branch: `main`
  * Remote Origin: `https://github.com/itsmestardust108-debug/munshi_kirana_store.git`

To push updates in the future from this workstation:
```powershell
git add .
git commit -m "feat: description of changes"
git push origin main
```
Cloudflare Pages automatically detects commits to `main` and redeploys in ~40 seconds.

---

## 3. Supabase Cloud Database & Storage

| Property | Value |
| :--- | :--- |
| **Project ID** | `sauynvptrmhvlqbcwdhz` |
| **Project URL** | `https://sauynvptrmhvlqbcwdhz.supabase.co` |
| **Publishable Key** | `sb_publishable_t728NqS68YYdUTOv-D3SoQ_Gh42uUHL` |
| **Storage Bucket** | `wholesale_bills` (Private storage for purchase invoice photos) |
| **Database Cost** | ₹0.00 (500 MB database + 1 GB storage free tier) |

### Cloudflare Pages Environment Variables:
These variables are configured in Cloudflare Pages (Settings ➜ Environment variables ➜ Production):
* `VITE_SUPABASE_URL`: `https://sauynvptrmhvlqbcwdhz.supabase.co`
* `VITE_SUPABASE_ANON_KEY`: `sb_publishable_t728NqS68YYdUTOv-D3SoQ_Gh42uUHL`

### Storage Policy Applied:
```sql
CREATE POLICY "Allow wholesale bills upload and read"
ON storage.objects FOR ALL
USING (bucket_id IN ('wholesale_bills', 'wholesale_bucket'))
WITH CHECK (bucket_id IN ('wholesale_bills', 'wholesale_bucket'));
```

### PostgreSQL Schema & Security:
* Tables: `shops`, `inventory_items`, `bills`, `bill_items`, `customers`, `credit_charges`, `repayments`, `receipt_shares`
* Public Receipt Function: `get_public_receipt(p_token_hash text)` returns sanitized receipt details to customer smartphones without exposing cost prices or store wholesale data.
* Secret Key: `sb_secret_...` is **strictly omitted** from frontend bundles and Git commits.

---

## 4. 24/7 Keep-Alive Automation (cron-job.org)

To prevent Supabase from pausing after 7 days of inactivity (e.g. during festival store closures or holidays):

| Setting | Value |
| :--- | :--- |
| **Service** | [cron-job.org](https://cron-job.org/) |
| **Job Title** | `Munsi Kirana Supabase Keep-Alive` |
| **Job URL** | `https://sauynvptrmhvlqbcwdhz.supabase.co/rest/v1/shops?select=*&apikey=sb_publishable_t728NqS68YYdUTOv-D3SoQ_Gh42uUHL` |
| **Schedule** | Every day at 3:00 AM UTC (`0 3 * * *`) |
| **Expected Response** | `HTTP 200 OK` |
| **Cost** | ₹0.00 |

Every night at 3:00 AM, this query executes against PostgreSQL, resetting Supabase's 7-day inactivity pause counter automatically.

---

## 5. Mobile Home Screen Installation Guide (Parents' Phones)

1. Open **Google Chrome** on the Android phone.
2. Navigate to: `https://munshi-kirana-store.pages.dev`
3. Tap the bottom prompt **"होम स्क्रीन पर जोड़ें" (Add to Home screen)** OR tap Chrome menu (⋮) ➜ **"Install app"**.
4. The **Munsi Kirana Store** icon with Dadaji's photograph appears on the home screen.
5. Launches fullscreen with offline-first persistence.

---

## 6. Verification & Test Commands

* **Run all Vitest Unit & Integration Tests (25/25):**
  ```powershell
  npm test
  ```
* **Run Audit Probes (8/8 Acceptance Criteria):**
  ```powershell
  npm run test:probes
  ```
* **Production Build & PWA Service Worker Verification:**
  ```powershell
  npm run build
  ```

