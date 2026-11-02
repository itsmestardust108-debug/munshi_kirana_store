# Antigravity execution brief — Munsi Kirana Store

Read this entire brief and `MUNSI_PROJECT_BLUEPRINT.md` before implementation. Build the actual application, not just a homepage or a code outline. Execute the phases below, verify the result, and leave a runnable project with honest setup and deployment instructions.

Use `output/munsi-ui-layout.html` as the interactive visual reference for the recommended mobile layout. It contains synthetic data and temporary demonstration interactions, not production persistence or a financial engine. Follow its visual hierarchy and navigation while implementing the complete domain rules, accessibility, and safeguards in this brief. The numerical specification below takes precedence over demonstration code.

## 1. Project intention and final goal

You are the product designer and senior full-stack engineer for a real, single-location, family-run Indian kirana shop. Build **Munsi Kirana Store**, an installable React PWA that helps elderly parents run the counter with less effort and fewer arithmetic or record-keeping mistakes.

The core jobs are:

1. Find an item's current selling rate by Hindi/Hinglish/English voice or text when the other parent is away.
2. Make accurate bills quickly, including loose quantities, occasional discounts, new items, and new packs.
3. Record customer credit and repayments with a clear, auditable balance.
4. Calculate monthly byaj with annual compounding and explain the result transparently.
5. Keep useful records on two phones during weak internet and synchronize safely later.

Use the family's identity and a supplied photograph of Dadaji. Do not fabricate a photograph or claim one was supplied. If it is missing, create an attractive, usable Munsi monogram SVG and raster app icons, plus a shop-profile upload flow. Missing branding must not block the working application.

Optimize for real counter use, trust, and simplicity. Avoid turning this into an ERP or an AI chatbot. Use a Hindi-first interface with English item names and a language switch by default; make this preference configurable. Assume INR, Asia/Kolkata business dates, two Android phones, one shop, existing internet access, and a ₹0 recurring-service budget unless the owner specifies otherwise.

## 2. Working method, authorization, and honesty

- Inspect the current repository and applicable instructions first. Preserve existing work and adapt the architecture to what is already present.
- State key assumptions, create a phase checklist in `docs/IMPLEMENTATION_STATUS.md`, then implement. Do not stop after planning.
- Make routine reversible design and engineering decisions independently. Ask only for information or access that actually blocks the dependent step, while continuing independent work.
- Access only this project, assets explicitly identified for this shop, and services authorized for this project. Existing access to the owner's personal accounts is not permission to inspect unrelated files, import personal contacts, publish photographs, expose credentials, purchase services, or message real people.
- Use synthetic customers and bills for testing. Do not send actual WhatsApp messages, loan reminders, or other external communications while verifying the app.
- Prepare a runnable local app, migrations, private-access rules, deployment configuration, and setup instructions before any final deployment decision. Deployment, account changes, and real-data import must remain within the owner's actual authorization.
- Never commit secrets or print secret values in logs, screenshots, documents, or terminal output. Include `.env.example` with variable names and descriptions, without genuine credentials.
- Use a free provider subdomain. Do not buy a domain, add a payment method, enable automatic paid upgrades, or configure paid AI fallback.
- Verify current provider terms and free limits from official documentation before deploying. Record source URLs and the verification date. If access is unavailable, say so; do not present historical quotas as verified current facts.
- Do not claim “production ready,” multi-device sync, successful deployment, or phone compatibility without evidence from the relevant tests. Mark external setup steps separately from defects and unfinished implementation.

## 3. Stack and project structure

Use current mutually compatible stable versions and commit a lockfile:

- React 18+ with TypeScript and Vite.
- React Router with route-level lazy loading.
- Tailwind CSS and Lucide React; reusable accessible UI primitives.
- Self-hosted Noto Sans Devanagari and a readable Latin/system font, retaining license notices.
- Dexie over IndexedDB for business data, attachments, drafts, and synchronization operations. LocalStorage is for non-sensitive preferences, not the financial database.
- A decimal arithmetic library such as decimal.js; schema validation such as Zod.
- Supabase client, Auth, PostgreSQL, private Storage, and Edge Functions/RPC for trusted operations.
- vite-plugin-pwa and Workbox.
- Vitest for meaningful domain tests and Playwright for critical browser flows; include an isolated cloud integration-test path.

Separate presentation, domain rules, persistence, and integrations. Keep money, interest, unit conversion, ledger allocation, and association logic outside React components.

Recommended structure; adjust names if the existing repository already has a sensible convention:

```text
src/
  app/                 router, providers, app shell, error boundary
  components/          accessible controls, dialogs, amount/date inputs
  features/
    home/ billing/ inventory/ customers/ ledger/ interest/
    receipts/ reports/ settings/ onboarding/
  domain/              pure money, date, bill, ledger, matching, association rules
  data/                repositories, IndexedDB schema/migrations, outbox, sync
  integrations/        supabaseClient, speech, WhatsApp, compression, backup
  i18n/                Hindi and English strings
  styles/
public/                 generated app icons, licensed assets, hosting headers
scripts/                logo generation and development utilities
supabase/
  migrations/           complete schema, functions, grants, RLS, storage policies
  functions/            public-receipt and optional interest-summary endpoints
tests/                  domain, browser, and isolated cloud integration tests
docs/                   architecture, setup, acceptance results, parent guide
```

Provide `package.json`, Vite config, TypeScript config, `.env.example`, a reproducible `setup.sql` or SQL entry point with clear migration order, sample import CSV, README, and hosting configuration. Do not leave TODO comments, dead buttons, fake success messages, or unimplemented handlers. Optional unconfigured services must have working local alternatives and truthful setup states.

Frontend environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or the currently documented Supabase publishable key equivalent
- `VITE_APP_ORIGIN`, if deployment cannot derive the canonical origin safely

Server-only secrets:

- Supabase server credentials where actually needed, kept in the function environment
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`, configurable and restricted to an explicitly selected currently free model

Never use `VITE_OPENROUTER_API_KEY` or any Vite-prefixed server secret. Vite embeds frontend environment values in downloaded JavaScript.

## 4. Design system and navigation

Use a distinctive family-shop visual identity with familiar PhonePe-like usability. Do not clone PhonePe branding.

- Primary `#5F259F`, deep text `#29163D`, warm background `#F8F7FB`, white surfaces, restrained pale-purple backgrounds.
- Body text normally 18px; field labels 16px or more; titles 22–26px; key totals 32–40px.
- Main interactive controls at least 56px high. Secondary icon targets at least 48×48px. Show icons with labels rather than requiring icon memorization.
- 16px page gutters and card corners, an 8px spacing scale, clear borders, restrained shadows.
- Verify WCAG AA contrast for the actual color pairs. Do not encode payment state or errors with color alone.
- Support 200% text enlargement, keyboard use, visible focus, screen readers, reduced motion, and Devanagari without clipping.
- Primary phone target 360–430px. Work at 320px without horizontal page overflow. On tablets/desktops, use a sensible wider layout with the same control order; do not lock every viewport into a tiny phone column.
- Respect safe areas, dynamic viewport height, and the mobile keyboard. A sticky footer must not hide fields, messages, or the last row. Pad content for bottom navigation and sticky actions.
- Use card rows on phones; reserve dense tables for larger screens or print.
- Choose one primary action per workflow state. Use small inline help, not long explanatory banners.

Bottom navigation: **Home / Bill / Khata / More**. The Home page also contains the required four large tiles: New bill, Add/update items, Byaj, Credit ledger.

Routes:

```text
/                       dashboard and rate lookup
/billing                create bill; segmented link to inventory
/inventory              inventory and wholesale attachments
/interest               byaj calculator
/ledger                 customer balances
/ledger/:customerId     account statement, charge, repayment, reminder
/bills                  bill history
/bills/:id              authenticated saved-bill detail
/r/:shareToken          deliberately limited public customer receipt
/reports                daily overview
/settings               preferences, profile, backup, sync, integrations
/setup                  first-run local/demo/cloud setup
```

An old-style `/bill/:id` route may redirect only when it has a legitimate share token or authenticated ownership. Do not turn a database bill ID into an unrestricted public lookup.

## 5. Operational modes and family access

Implement three explicitly distinguished states:

1. **Demo/practice:** synthetic data in its own namespace, labelled clearly, reset independently.
2. **Local shop:** real records on this browser/device, fully usable without cloud keys, with export reminders. No cross-device-sync or hosted-link claims.
3. **Connected shop:** authenticated shop members, local-first storage, cloud synchronization, private images, and public receipt sharing when online.

Switching modes must never silently mix sample and real data. Cloud connection requires a dry-run import/merge preview with counts, stable IDs, duplicate handling, and rollback/export guidance. Do not silently abandon local records when keys are configured.

Use Supabase Auth with owner-approved shop membership. Provide persistent sessions on the parents' phones and a clear reconnection flow. Do not require paid SMS OTP for normal operation. Document current email/recovery requirements and free-provider limitations.

Suggested roles: owner manages family access and integrations; family operator manages shop tasks. Both require valid shop membership. Public customers have no access to the shop application. Treat the info button and optional local privacy lock as accidental-disclosure protection, not cryptographic access control.

The first cloud login requires internet. An expired session or permission failure must preserve local work, mark cloud sync blocked, and request sign-in; it must not silently downgrade into an unrelated local database. Signing out or switching accounts must not expose the previous account's cached records or discard pending changes. Give the owner a safe sync/export resolution path.

## 6. Home and bilingual rate lookup

Layout order: compact purple Dadaji/store banner → language control → truthful save/sync status → prominent voice/text search → four large action tiles → compact daily overview → resume draft if any → recent bills.

Search should match display name, Hindi name, stable variant label, and manually editable aliases. Support case folding, whitespace normalization, Latin diacritics, Devanagari and Latin digits, prefixes, and conservative fuzzy fallback. Prioritize exact and prefix matches over fuzzy matches. Do not collapse distinct brands or packs into one result.

Include clearly labelled sample records in demo mode:

- Sugar / चीनी: aliases `chini`, `cheeni`, `shakkar`, `sugar`; selling unit kg; ₹60/kg.
- Groundnut oil / मूंगफली का तेल: aliases `mungfali ka tel`, `moongfali oil`, `groundnut oil`, `मूंगफली का तेल`.
- Vim ₹30 pack and Vim ₹60 pack as distinct explicit variants.
- A few normal grocery items and a small synthetic purchase history for demonstrating suggestions.

Recognize `SU` as a prefix for Sugar. Recognize both spoken Devanagari and typed Hinglish groundnut-oil phrases through aliases. Do not promise arbitrary translation or perfect phonetic recognition.

Use `SpeechRecognition`/`webkitSpeechRecognition` when supported, with Hindi `hi-IN` and a clearly available English `en-IN` retry. Show listening, processing, result, no-match, permission-denied, unsupported, offline, and error states. Keep the transcript editable and ask for item selection when ambiguous. Stop recognition on route change/unmount, avoid duplicate listeners, and never auto-add an uncertain spoken result to a bill. Pulse the mic only while recording.

Speech may use browser/vendor network services. Provide a short first-use explanation and always-working typing fallback. Do not advertise offline speech recognition unless tested and supported on that device.

Search result card: item name, pack/unit, large selling rate, and a small drawn `(i)` within a large accessible tap target. The info dialog reveals the nullable purchase cost and private wholesale image only after an intentional tap. Close with Back, Escape, or a visible close control; restore focus.

## 7. Smart billing and inventory learning

The billing screen has Create bill / Add-update items navigation. Persist the in-progress bill after meaningful changes, including customer and payment fields; recover it after reload or interruption. Use a local transactional snapshot and schema migration, not fragile component state alone.

Order the form for counter speed:

1. Optional customer selector with quick create.
2. Search/speak item with suggestions.
3. Selected name/variant, editable rate, decimal quantity, compatible unit selector, live line total.
4. Add item action and basket.
5. Honest related-item suggestions.
6. Cash / UPI / Udhaar / Split settlement.
7. Sticky grand total and Save bill.

Rules:

- Selecting inventory fills its selling rate and billing unit. Editing ₹60 to ₹59 or ₹59.50 applies to this bill only. Show that scope clearly.
- A selected-item discount must neither change the catalog's default nor create a new variant.
- A genuinely unseen item can be entered with name, explicit unit, rate, and optional variant. Learn it only when the bill is saved successfully.
- An existing brand with a new pack uses an explicit “New item / pack” path and a distinct variant label; suggest a label such as “₹30 pack” for piece goods, but allow correction. Price alone is not a product identity.
- Normalize product and variant identity consistently. Protect concurrent learning with a database uniqueness constraint and server-returned canonical IDs; preserve the original bill line snapshot if catalog deduplication occurs.
- Show an “Added to items” acknowledgement only when the local save has succeeded. If cloud learning remains pending, say so.
- Changing the quantity or rate recalculates immediately. Validate quantity greater than zero, legal unit conversion, nonnegative rate, finite bounded numbers, and item name.
- Support kg↔g and litre↔ml for compatible products. At ₹60/kg, 250g costs ₹15; at ₹59.50/kg, 2.5kg costs ₹148.75. Piece quantities are integers unless a product explicitly allows fractional pieces.
- Keep line snapshots of the name, variant, billing unit, rate, quantity, conversion, discount, tax treatment if any, and total. Later catalog changes cannot alter old bills.
- Use decimal arithmetic. Round each final line amount to paise using a documented half-up rule, then sum rounded lines. Use the same rule in local and server validation.
- Implement bill-level discount as a separate optional control if needed; never apply an already overridden rate reduction twice. Validate discount ≤ subtotal, and allocate it consistently if ledger or line reporting requires allocation.
- Allow row editing/removal before save. If the active editor has an unadded row, require Add or Discard before finalizing.
- Disable repeated submission while saving, use a stable operation/bill ID, and enforce server idempotency. A timeout after a server commit must not create another bill on retry.
- Save locally first and show exactly whether it is local-only, pending sync, synced, or needs attention. Do not show a successful save after a failed IndexedDB transaction or storage-quota error.

Payments:

- Cash and UPI are recorded payment methods, not payment processing integrations.
- Cash tendered above the bill amount produces change; the recorded payment is the bill amount, not the full tender.
- In Split, valid received portions plus credit remainder must equal the final total. A named customer is required whenever a positive credit remainder exists.
- A phone is not required to create a cash bill or a customer account; validate it when used for WhatsApp.
- Record a UPI receipt only after the operator confirms receiving it; do not infer success from opening another app or display a fake verification badge.
- Creating the bill, its initial payments, and its credit charge must form one idempotent domain operation locally and one database transaction remotely.

After save, display a receipt with receipt number, business date/time, line items, totals, payment methods, paid amount, and this bill's credit remainder. Keep the customer's older account balance off the public sale receipt. Offer WhatsApp, Print/Save PDF, and New bill. Never auto-open WhatsApp while the bill is still saving.

Bill history includes search, customer/date filters, and re-share/print. Completed financial records are immutable; support full void with reason and linked reversing entries, plus a documented correction-and-reissue flow. Voiding a paid bill does not magically refund money: record an explicit refund, retained customer credit, or unresolved refund obligation. If a linked credit charge has already been repaid, correct allocations atomically and preserve that receipt of money. Exclude voided/reversed effects from net reports without deleting history. Item-level returns may be deferred only if the implemented full-correction flow is clear and usable.

## 8. Related-item suggestions without AI dependency

Use completed, non-voided baskets to count item presence and pairs once per basket; quantity is not a second occurrence. Include explicit variant/product aggregation rules and version them.

Implement and document actual size-two association rules: support, confidence, and lift from frequent itemsets. For source A and candidate B, derive these from distinct completed baskets, not just a visually labelled random frequency list. This is a bounded, lightweight subset of Apriori-style association mining; do not claim a full arbitrary-length Apriori engine unless implemented.

Use minimum evidence, for example at least five qualifying baskets overall and at least three A+B baskets before calling a pair “Often bought together.” Rank eligible results by a documented confidence/lift/support score, exclude items already in the basket and inactive items, and show up to three chips. A chip adds the correct current variant and default rate via the normal billing path. With too little history, label alternatives “Recent items” or “Popular items.” No fabricated statistics or purchase recommendations.

Use authoritative synchronized bill data with deterministic local recomputation or a safe server aggregate. Do not update shared JSON counters using read-modify-write from two phones. Voids and restores must not double-count baskets.

## 9. Inventory, private costs, and wholesale photographs

Inventory form: display name, optional Hindi name, aliases, explicit pack/variant, selling unit, default selling price, nullable purchase cost with its unit basis, and optional notes. Cost above selling price is allowed with an informational warning, not silently rejected.

Search, add, edit, archive, and CSV import must work. Archive items referenced by bills instead of deleting history. CSV import includes a downloadable example, header mapping where useful, validation preview, duplicate resolution, and a clear committed-row count. No silent partial import labelled success.

Wholesale attachments:

- Select one or many inventory items and attach one photographed wholesale bill to all selected items using a join table, not duplicated uploads.
- Accept decoded image formats such as JPEG/PNG/WebP; validate file type, dimensions, and input size. Do not accept executable or SVG content as a receipt photograph.
- Correct orientation, resize, and re-encode via canvas to remove unnecessary metadata. Aim near 100 KB when legible; allow a documented larger cap, such as 500 KB, rather than destroying text readability. Show output size and a zoomable preview. If unreadable, allow recrop or a higher-quality setting within the configured limit.
- Store the processed Blob locally for offline viewing/pending upload. Catch quota failures and preserve the item edit or provide a safe export/retry path.
- In cloud mode use a private bucket with shop-prefixed paths and membership-based policies. Obtain short-lived authorized URLs when displaying; never store a permanent public wholesale URL on inventory or expose it in public receipt JSON.
- Upload the file, then attach metadata transactionally. Handle failed metadata commits and orphaned objects without breaking previously attached items. Retry with stable attachment IDs.
- Bulk linking should succeed as one explicit operation. Unlinking an item must not delete an image still attached elsewhere. Any irreversible cleanup requires an explicit owner action and reference checks.

An info dialog shows missing cost or image honestly, with an Edit item route for an authorized operator. Blurring or hiding a frontend value alone is not an authorization mechanism.

## 10. Customer khata, charges, and repayments

Separate customers from financial entries. Do not model the whole account as one mutable `amount_due` field.

Customer fields: name, optional normalized phone, optional distinguishing note, and active/archive status. Allow same-name people and shared family phone numbers; show enough context to avoid selecting the wrong customer. Never merge customers automatically because their names or phones match.

Account operations:

- Add manual credit charge with amount, transaction date, reason, optional due date, and optional linked bill.
- Record a received payment with amount, date, cash/UPI method, optional note, and idempotent operation ID.
- Allocate repayments to outstanding charges with a documented default such as oldest first; support a specific selected charge. Allocation rules must be deterministic, atomic, and safe during concurrent phone sync.
- By default block repayments exceeding the currently known outstanding amount unless an explicit customer-advance feature is implemented. If concurrent offline repayments create an excess after synchronization, preserve both actual payments, show the resulting customer credit and reconciliation state, and never discard money received or silently clamp the balance to zero.
- Show a chronological running statement and current balance derived from charges, repayments, adjustments, and reversals. Keep cached balances reconcilable; the ledger is the authority.
- Correct mistakes with linked reversal entries and reasons. Prevent reversing the same entry twice and preserve allocations consistently.
- Archive a customer only without losing account history. No hard-delete of financial history through ordinary UI.
- A bill credit remainder creates one charge only; bill retry or sync retry cannot create a second charge.
- Show overdue status only where a due date was entered and the remaining allocated amount is positive.

Ledger home: total outstanding, customer search, Add udhaar, Payment received, and customer cards with balance, last activity, and real overdue state. Do not count a negative customer balance as debt owed to the shop.

Customer detail: running statement, linked private bills, Add credit, Record payment, Reminder, Share statement. Require a valid destination number before WhatsApp; preview the selected customer's amount and message. Do not silently send to a phone scraped from personal contacts.

Use courteous editable bilingual reminder text with store name and current outstanding amount. WhatsApp compose is user-triggered; never mark a reminder delivered or read based only on opening its URL. Do not automatically expose a complete customer statement through a public URL.

## 11. Byaj calculator — authoritative arithmetic specification

This module is an independent calculation tool. It must not automatically create an enforceable loan record, add charges to shopping khata, or classify debtors. The owner decides how to use the calculation.

Inputs per entry:

- Optional local label, principal P ≥ 0, monthly percentage R ≥ 0.
- Typed Start date in DD-MM-YYYY, with inputMode numeric, sensible caret behavior, paste support, and auto-inserted hyphens. Do not use a native calendar picker as the required entry method.
- End date defaults to today's Asia/Kolkata calendar date, calculated at submission. A compact Today/Custom toggle reveals another typed date input.
- Add and remove multiple entries. Validate each independently and link errors to the relevant row. Editing inputs invalidates/stales the previous result visibly.

Validation and dates:

- Parse day, month, and year explicitly; validate real calendar dates. Never rely on locale-ambiguous `new Date('DD-MM-YYYY')` parsing.
- Reject end before start and unreasonable/non-finite inputs using documented domain limits. Allow a zero rate and a same-day calculation.
- Use calendar date values, not local-midnight millisecond arithmetic vulnerable to daylight saving or timezone conversion.
- Define full years as the largest completed anniversary count from the original start date not after the end. Clamp a leap-day anniversary to the last valid day of February.
- Set a year anchor at that anniversary. Define full remaining months as the largest count 0–11 whose date, calculated by adding months to that fixed year anchor with end-of-month clamping, is not after the end. Do not repeatedly add one month and accumulate day-of-month drift.
- Remaining days are actual calendar days between that month anchor and the end date. Keep this exact calendar duration in the duration badge; do not convert every year to 360 days.
- For interest only, remaining days represent D/30 of a month. Label this as the shop's **30-day residual-interest convention**, not an assertion that all calendar months are 30 days.

Calculation:

```text
balance = principal
for each full completed year:
    interest = roundPaise(balance × monthlyRate × 12 / 100)
    closing = balance + interest
    record opening balance, annual interest, closing balance, period dates
    balance = closing
if remaining months or days exist:
    interest = roundPaise(balance × monthlyRate / 100 × (M + D/30))
    closing = balance + interest
    record this residual period separately
    balance = closing
finalAmount = balance
totalInterest = finalAmount - originalPrincipal
grandTotal = sum of entry finalAmounts
```

Use decimal arithmetic with adequate precision and ROUND_HALF_UP to two decimal places at each posted yearly/residual interest step. The displayed rows must add exactly to the displayed totals. This is monthly simple rate with annual capitalization, not monthly compounding and not an APR/APY label.

Output:

- Method label: “Monthly rate; interest added yearly.”
- Calendar duration X years, Y months, Z days.
- Annual equivalent R×12% with wording that explains it is used for each completed year.
- Per-entry original principal, total interest, final payable amount.
- Expandable period cards on mobile with opening amount, interest, closing amount, dates; a clean table in print/desktop.
- Combined principal, combined interest, and prominent grand total across entries.
- A deterministic short explanation in Hindi and English that is always available offline.
- Print/share calculation as a calculation statement, distinct from a sale receipt.

Required arithmetic fixtures:

| Principal | Monthly rate | Start | End | Expected |
|---|---:|---|---|---|
| ₹10,000 | 2% | 01-01-2024 | 01-01-2025 | 1 year; interest ₹2,400; final ₹12,400 |
| ₹10,000 | 2% | 01-01-2024 | 01-01-2026 | 2 years; yearly interest ₹2,400 then ₹2,976; final ₹15,376 |
| ₹10,000 | 2% | 01-01-2024 | 16-03-2026 | 2 years, 2 months, 15 days; residual interest ₹768.80; final ₹16,144.80 |
| ₹10,000 | 2% | 31-01-2025 | 28-02-2025 | 1 calendar month under the stated clamping rule; final ₹10,200 |
| ₹10,000 | 2% | 29-02-2024 | 28-02-2025 | 1 completed clamped anniversary; final ₹12,400 |
| ₹10,000 | 2% | 01-01-2025 | 02-01-2025 | 1 day; interest ₹6.67; final ₹10,006.67 |
| ₹5,000 | 3% | 01-01-2024 | 01-01-2025 | final ₹6,800; combined with the ₹15,376 fixture, grand total ₹22,176 |

Also test invalid 31-02-2025, valid leap day, zero rate, same day, reverse dates, month ends, timezone independence, decimal rates, rounding boundaries, multiple entries, and overflow/limit handling. Document this convention so the family can compare it with their established byaj practice before using it for real settlements.

## 12. Optional AI explanation

The mathematical engine and deterministic bilingual explanation are the defaults. Implement an optional authenticated server-side summary endpoint, disabled until configured. AI availability must never block Calculate or change the authoritative result.

- Use a currently available explicitly free OpenRouter model selected through server configuration; do not hardcode a historically free Mistral model and assume it still exists.
- Restrict provider/model fallback to free choices only, or disable fallback entirely. Fail closed rather than incurring charges.
- Send only the minimum anonymous computed principals, rates, durations, and result rows. Do not send customer names, phones, notes, photographs, ledger history, or store credentials.
- Give the model precomputed facts and require a short structured English/Hindi explanation without adding terms, inventing amounts, or recalculating.
- Validate structured output and its echoed authoritative amounts; reject inconsistent or unparseable output and show the deterministic explanation. Do not inject raw model HTML.
- Require shop authorization, enforce bounded input/output, per-user request limits, and a timeout. Avoid an anonymous expensive proxy.
- Show honest offline, unconfigured, rate-limited, timed-out, and unavailable states unobtrusively. These are not financial calculation failures.

## 13. Public receipt and WhatsApp sharing

Saving and sharing are separate actions. A local-only or unsynchronized bill can be shown, printed, and shared as text, but does not have a working hosted receipt link yet.

For synchronized bills, an authorized share operation generates a cryptographically random bearer token with at least 128 bits of entropy, stores its hash, and returns the link. Prefer 32 random bytes encoded safely for URLs. A newly generated link can be copied/shared; generate another link when necessary rather than pretending a stored hash can reproduce the token. Support revocation and a documented expiry policy.

Use `/r/:shareToken` with a public receipt function that:

- Looks up a valid non-revoked, non-expired token and its one bill.
- Returns an explicit allowlist of receipt fields: store display name/logo intended for public use, optional public shop contact/address, receipt number, bill date/time, item snapshots, quantity, unit, rate, discounts, total, paid amount/method, this bill's due, and current void/correction status where relevant.
- Omits customer phone, internal notes, purchase costs, wholesale images, other debts, authentication details, and all other customers. Customer name should be omitted by default or use an explicitly chosen display label; never expose a customer's full account statement.
- Never grants anonymous SELECT to bills, customers, ledger, or inventory. The function returns only the allowlisted public projection.
- Does not accept an arbitrary bill UUID as an alternative anonymous lookup.
- Rejects malformed/unknown/expired/revoked tokens with a generic unavailable view.
- Uses no-store responses, no third-party analytics, no-referrer policy, and noindex headers/meta where supported. Exclude receipt payloads and token endpoints from service-worker data caching; revocation must take effect when fetched again.

Treat the link as possession-based access: anyone receiving or forwarding it can view that receipt until it expires or is revoked. Explain this briefly in the share settings. There is no login-free way to promise recipient identity.

Public route layout: shop header, date/receipt number, itemized mobile-friendly table, grand total, paid/due breakdown, thank-you line, print action. No app navigation, admin controls, costs, or surprise install prompt. Avoid loading authenticated shop data while rendering this route.

Normalize Indian numbers to E.164; accept common forms with +91, spaces, or a plain ten-digit number, then validate. Use `https://wa.me/91XXXXXXXXXX?text=...` with properly URL-encoded text. Build a normal user-activated link to avoid popup blockers after asynchronous saves. Offer Web Share where supported and a copy-message fallback.

Online message: concise store/receipt/amount text plus the valid public URL. Offline/local-only message: concise itemized receipt text, paid/due, and no invalid URL. Avoid overly long URL query strings; provide printable/shareable file or copy fallback for long bills. Handle missing WhatsApp gracefully. Never claim a message was sent, delivered, or read because the compose view opened.

## 14. Data model, transactions, and access policies

The original three-table schema is insufficient for repayments, secure multi-phone access, immutable bill details, and bulk photo attachment. Implement normalized tables, constraints, indexes, and migrations covering:

- `shops`: identity, locale, timezone, public profile fields, settings.
- `shop_members`: user/shop relationship and role, controlled enrollment.
- `inventory`: stable product/variant identity, names, aliases, selling unit, selling price, nullable cost/unit basis, active state, version, timestamps, shop ID.
- `attachments` and `inventory_attachments`: private storage metadata and many-to-many links.
- `customers`: shop ID, name, optional phone/note, active status, version.
- `bills`: stable ID, shop ID, human-readable receipt number, customer reference if any, totals, business date, server received time, status, operation ID, creator/device, version.
- `bill_items`: immutable sale snapshots, canonical product reference if applicable, quantities/conversions, rates, discounts, line totals; private cost snapshots if used for margin reports must be excluded from public projection.
- `payments`: actual money received/refunded, cash/UPI method, amount, time, customer/bill reference, operation ID, reversal linkage.
- `ledger_entries`: credit charges, payment effects, advances if supported, corrections, and reversals with explicit signed semantics and links.
- `payment_allocations`: payment-to-charge allocation with invariant checks; avoid counting payment amounts twice in the customer balance.
- `receipt_shares`: bill reference, token hash, expiry, revocation, creator.
- `sync_operations` or equivalent: server idempotency keys, committed results, change cursors, and concurrency metadata.

Use UUIDs or similarly strong stable local-generated IDs. Create globally unique receipt references without promising gapless sequential numbering offline; a readable date/device suffix is acceptable with a server-enforced uniqueness constraint. Use timestamptz for instants and an explicit business date for date-based reports. Do not trust device clocks for conflict order or server cursors.

Use numeric/fixed precision or integer paise consistently for money; no floating-point storage for authoritative amounts. Define scaled quantity precision and numeric upper bounds on both client and server. Server transactions recalculate totals and validate unit/rate/payment invariants instead of trusting the submitted grand total.

Enable RLS on every private table and restrict all operations by actual shop membership and role. Secure both SELECT and mutation policies. Prevent operators changing shop IDs or granting themselves roles. Scope joins and RPCs to the authenticated shop. Set secure function search paths and grants, and test any SECURITY DEFINER function for authorization bypass. Service-role keys must never reach the browser.

Use complete private Storage policies. Do not leave an “allow all while developing” policy in the deliverable. Public receipt access is through the limited function only. Test an anonymous user, an authorized user, and a user from a different shop.

Financial operations must be atomic and idempotent: bill save/learn/settle, charge creation, repayment and allocation, void/correction, reversal, and restore import. Do not assemble one business transaction from unrelated client inserts that can half-complete. Return canonical committed results for safe retry.

## 15. Offline behavior, conflicts, and PWA lifecycle

Cache the application shell and static assets. Do not indiscriminately runtime-cache authenticated API responses, wholesale signed URLs, AI responses, or public receipt data through Workbox.

Use IndexedDB records and a durable outbox written in one local transaction. Each operation has a stable ID, shop/device scope, version, dependencies, pending/in-flight/confirmed/error state, and retry metadata. Serialize conflicting dependent operations. Use stable attachment and entity references during retries.

- Retry on launch, reconnect, and visible-app activity with bounded exponential backoff. Manual Sync now is available. Do not depend on Background Sync being supported or on a closed phone app executing JavaScript.
- Handle timeout-after-commit, duplicate acknowledgements, partial attachment uploads, expired auth, permission changes, schema changes, quota exhaustion, and interrupted imports.
- Pull changes using a server-owned monotonic cursor or equivalent robust sequence, including archives and reversals. Avoid device-time last-write-wins for money.
- Two phones making independent financial entries retain both. Two edits to the same catalog record use optimistic version checks and an explicit conflict resolution UI; never silently overwrite a changed price or lose an entry.
- Do not call a bill synced until all its required financial effects are acknowledged. Explain separate pending photo uploads where appropriate.
- Display status in plain language: Saved on this phone, Waiting for internet, Synced, Sign in to sync, Needs attention. Include pending count and last successful sync time in settings.
- Request persistent browser storage where supported; show device storage usage and safe backup guidance. Clearing browser data can still remove local-only records. Never promise the service worker is a backup.

PWA manifest: Munsi Kirana Store, a suitable short name, display standalone, theme color #5F259F, background color, scope/start URL, usable 192px and 512px icons, and a separate maskable icon with safe artwork margins. Provide an Apple touch icon. No missing image references.

Use vite-plugin-pwa with `registerType: 'autoUpdate'` only with a tested update strategy that persists drafts/outbox before any reload. Do not force a reload during an active save or sale. If the plugin's current auto-update behavior cannot guarantee this, use a visible idle-safe update prompt and document the reason. Test version migration while a draft exists.

Provide contextual install guidance for Android Chrome and iOS Safari, using install events only where supported. Do not promise identical install/background capabilities across browsers. Offline app startup requires a completed first load/install; make this limitation clear in help.

## 16. Backup, restore, and reports

Implement a versioned backup export containing shop data, necessary metadata, operation IDs, relationships, and available attachment files. Clearly list cloud-only attachments not included if they cannot be downloaded. Export from a consistent local snapshot; do not label a metadata-only export a complete image backup.

Use a user-controlled passphrase and standard Web Crypto authenticated encryption for sensitive full backups, with a documented KDF, random salt/nonce, and no embedded decryption key. Explain that the app cannot recover a forgotten backup passphrase. Keep ordinary inventory CSV export separate and explicit about included private cost fields. Never export authentication tokens or integration secrets.

Restore must validate file format/version, integrity, relationships, duplicate IDs, totals, and encryption before altering the database. Offer a dry-run summary, preserve a pre-restore backup, and commit transactionally. Test restore into a clean profile and a safe merge into existing data. Do not replay restored pending operations against the wrong shop or duplicate already committed financial operations. Migration and cloud-import decisions require explicit mode/shop mapping.

Daily overview uses Asia/Kolkata business dates and clearly defined measures:

- Net sales: completed sale totals after supported corrections/voids for the selected sale period.
- Cash/UPI received: actual payments received in the selected payment period, separating sale receipts from old-credit repayments; show refunds separately or clearly net them with labels.
- New credit issued: credit charges arising in that period.
- Credit recovered: payments allocated to outstanding credit, with allocation-period semantics documented.
- Outstanding now: remaining customer charges minus applicable repayments/credits, independent of the selected sales period unless explicitly labelled historical.

Prevent double-counting a single payment across sale settlement and ledger postings. Reports must reconcile to the source events. Mark the report incomplete if relevant local operations or other devices may not yet be synchronized.

Show estimated gross margin only from known cost snapshots and valid quantity conversions; state coverage where costs are missing. Do not equate revenue with profit. Provide CSV exports and printable customer statements with appropriate privacy choices.

## 17. Extras and scope discipline

Complete every core capability above before optional expansion. A small, reliable implementation is preferable to many decorative unfinished modules.

Optional after core acceptance: opt-in stock movements, low-stock list, basic reorder list, explicitly configurable customer advances, barcode scanning where the target devices support it, supplier records, and smarter purchase analysis. Mark such features as absent until actually implemented; do not show dead navigation items.

Do not require OCR, GST automation, paid APIs, automatic WhatsApp delivery, UPI payment verification, complex forecasting, a native Android package, or a chat interface for this release. A regular receipt must not claim to be a compliant GST tax invoice without the relevant legal/business fields and rules.

## 18. Execution phases and required evidence

Complete phases sequentially so later polish cannot hide missing financial foundations. Continue automatically after local checks pass. If a credential or external account is missing, complete the local implementation and document the precise unverified integration step.

### Phase 1 — foundations and usable design

Repository review, compatible scaffold, route shell, reusable components, Hindi/English strings, visual tokens, complete schema design, demo/local mode, actual icon assets, and all primary screen layouts. Set up the test harness. Verify navigation, keyboard access, and phone-width layouts. No fake dashboard metrics.

### Phase 2 — correct offline shop core

Implement inventory, aliases, rate lookup, saved drafts, billing, unit conversions, explicit new-pack learning, payment splits, customer ledger with repayments, byaj, and local receipts. Add domain tests around money, date boundaries, balances, and idempotency. All core flows work without cloud or AI keys.

### Phase 3 — safe connected mode

Implement Auth, shop membership, migrations, RLS, atomic RPCs, outbox synchronization, concurrent-device handling, private attachments, and restricted public receipt endpoints. Run isolated integration tests and simulate lost acknowledgements/retries. Provide cloud setup scripts/instructions even if credentials are unavailable.

### Phase 4 — operational completeness

Add WhatsApp compose flows, print views, bill history/corrections, customer statements, import/export, encrypted backup/restore, reports, association suggestions, and the optional protected AI endpoint with deterministic fallback. Verify the full parent workflows.

### Phase 5 — installation, resilience, and deployment preparation

Build the production PWA, verify service-worker behavior, offline reload, updates with saved drafts, install assets, route rewrites, responsive layouts, and accessibility. Confirm currently eligible free hosting and service limits. Prepare deployment and handover documentation; deploy only within the owner's authorization. Run a short real-device acceptance session before claiming family-ready operation.

## 19. Acceptance scenarios — all must be addressed

1. Fresh checkout: documented install/dev commands succeed with no secret keys; practise mode is clearly marked and local real-shop mode starts clean.
2. Search `SU`, `chini`, `चीनी`, `mungfali ka tel`, and `मूंगफली का तेल`: correct demo products are discoverable. Unavailable mic access leaves typing usable.
3. Sugar ₹60/kg overridden to ₹59.50 for 2.5kg totals ₹148.75, while its catalog rate remains ₹60. Selling 250g at ₹60/kg totals ₹15.
4. Save a new Swami Manjan piece at ₹50, reload, and find it. Create explicit Vim ₹30 and ₹60 packs without turning ordinary discounts into duplicate variants.
5. A double-tap Save, retry after a server commit/timeout, or reconnect creates one bill, one set of payments, and one credit charge only.
6. A ₹750 bill paid ₹250 cash, ₹200 UPI, and ₹300 credit reconciles exactly. Cash ₹200 tendered for a ₹148.75 cash bill produces ₹51.25 change and records ₹148.75 received.
7. A ₹750 customer charge followed by a ₹200 repayment leaves ₹550. A retry does not record another repayment. Reversal restores the correct balance and history.
8. Two offline phones collecting payments reconcile without lost money; an overcollection is represented and flagged, not discarded. Two concurrent price edits do not silently overwrite each other.
9. All interest fixtures in section 11 pass; monthly rate is compounded annually and residual days use the explicitly stated convention. No AI/network required.
10. Select four products, attach one readable processed image, and confirm one stored object with four links. Other-shop and public users cannot retrieve the object or cost data.
11. Public receipt shows intended sale fields only. Unknown, expired, and revoked tokens fail. Direct anonymous table reads and cross-shop queries fail. No private fields appear in receipt network responses.
12. Save offline, reload, and recover the bill/draft; reconnect and synchronize exactly once. Offline sharing contains no broken hosted receipt URL.
13. A WhatsApp action opens the correct normalized destination and encoded message; no test actually sends the message and the UI does not claim delivery.
14. A catalogue price/name change leaves an old receipt unchanged. Full void/correction and paid/part-paid reversals reconcile money, allocations, and reports without erasing history.
15. Export an encrypted backup and restore into a clean profile; counts, money totals, references, and included photos agree. Wrong passphrases, malformed backups, and duplicate merge attempts fail safely.
16. Production build installs where supported, starts offline after first load, and survives a service-worker update with a saved draft. No authenticated payloads are indiscriminately cached.
17. At 320px, 360px, 390px, 430px, tablet, and desktop sizes, no unwanted horizontal overflow or clipped primary actions; test 200% text size and keyboard/dialog focus. Inspect rendered screenshots rather than relying only on CSS assertions.
18. Verify lint, type checks, domain tests, critical browser flows, and production build. Report external-device/cloud checks as pending when they could not actually run.
19. Daily sales, cash, UPI, new credit, old-credit collection, refunds, and outstanding reconcile to the test transactions without double counting.
20. The deployed browser bundle contains no service-role or OpenRouter secrets. Optional AI failure and rate limits leave calculations and billing fully usable.

Automate financial and access-boundary tests; use targeted manual visual and real-phone checks for usability, installation, microphone behavior, print, and WhatsApp handoff. Do not substitute a screenshot for a financial test or a unit test for phone usability.

## 20. Deliverables and handover

Provide a complete working repository and a concise final report that includes:

- The final file tree and architecture explanation.
- Exact install, local development, testing, production build, and preview commands.
- Separate instructions for practise mode, real local-only use, and cloud-connected use.
- Complete reproducible database/storage/auth setup, migrations, policies, seed data, and isolated integration-test instructions.
- Cloudflare Pages deployment configuration by default if current terms permit; compatible rewrites for SPA routes and functions. Vercel is an alternative only on a plan that permits this commercial shop use.
- A clear secret-placement guide and the exact external setup still required. No credentials embedded in examples.
- Screenshot evidence of Home, Bill, Inventory, Khata, Byaj, Receipt, and narrow-phone states; real pass/fail results for acceptance checks.
- Backup/restore and sync-recovery instructions, including a lost-phone/browser-data scenario.
- A short Hindi-friendly parent guide covering install, search, sale, udhaar, repayment, and backup.
- A Dadaji-photo replacement script/workflow that generates the correct banner and raster app icons without an external image-generation dependency.
- `docs/IMPLEMENTATION_STATUS.md` marking implemented, verified, and externally unverified capabilities separately.
- `docs/FREE_SERVICES.md` with official sources, verification date, free limits, commercial-use eligibility, and failure/fallback behavior.

Start implementing now. Keep the family-shop purpose central, make the calculations and records dependable first, and finish the interface to the point that every visible control has a clear working outcome.
