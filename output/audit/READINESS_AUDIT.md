# Munsi Kirana Store — independent readiness audit

Date: 2 November 2026.

**Readiness verdict: FAIL. The application is not fully implemented or ready to be relied on for real shop records.** It has a working build, useful screens, local persistence, and passing arithmetic fixtures. The claim that all five phases and all twenty acceptance scenarios are verified is contradicted by the current implementation and fresh executable checks.

This was an audit, not a repair. Application source and the pre-existing working-tree changes were preserved. New artifacts are limited to this audit directory; the production build was regenerated. No real browser database, customer records, WhatsApp messages, or cloud deployment was touched.

## Evidence observed in this session

| Check | Observed outcome | What it establishes |
|---|---|---|
| `npm test` | PASS: 2 files, 25 tests, 0 failures | Existing domain and local database fixtures pass. |
| `npm run build` | PASS: TypeScript, Vite 5.4.21, 1,609 transformed modules, generated service worker with 16 precache entries | The project compiles and produces PWA assets. |
| `node output/audit/run-probes.cjs` | FAIL: 8 independent probes, 8 assertion failures | Concrete defects outside the original test coverage. |
| Source wiring and schema inspection | Cloud/auth/sync/receipt paths are missing or disconnected; additional concerns listed below | Several claimed capabilities are not implemented end to end. |
| Real phones, real browser layout/installation, live Supabase/RLS/storage, deployment | Not verified in this audit | No claim of readiness for those environments. |

The seven tests named “End-to-End System Integration Tests” in `tests/integration.test.ts` do not render the React screens, contact Supabase, test two devices, exercise service-worker updates, or verify a customer's receipt on a separate phone. The backup test encrypts and previews a backup and rejects a wrong passphrase; it imports `executeRestore` but does not call it. These are useful local tests, but their names do not turn them into full system evidence.

The additional probes use the actual source modules and React components, TypeScript's in-process transpiler, jsdom, and fake-indexeddb. They contain synthetic data only. They are not visual screenshot tests or deployed browser tests. A separate Vitest launch encountered Windows `spawn EPERM`; an in-process harness completed the checks without esbuild subprocesses. `probe-run.log` records the unsuccessful launch, while `in-process-results.json` records the completed checks.

## Reproduced failures

### A1 — P1: reopening Billing deletes the saved draft

**Expected:** A previously stored basket remains available after opening the billing page.

**Observed:** The probe stored a draft, mounted `BillingScreen`, waited for initialization, and found the draft deleted.

**Cause:** The component starts with an empty basket. Its draft-saving effect immediately executes the empty-basket deletion branch while the asynchronous initialization is still loading inventory, customers, bills, and the draft. The draft is gone before restoration completes.

**Locations:** `src/features/billing/BillingScreen.tsx:99`, `:130`, `:143`.

**Repair:** Gate autosave/deletion behind completed hydration. Preserve all draft fields, including active row, discounts, customer, and settlement. Distinguish a deliberately cleared bill from an uninitialized one. Test reload, navigation away/back, and React StrictMode.

### A2 — P1: zero cash tender is accepted as full payment

**Input:** Bill total ₹100, method cash, explicitly entered cash tender ₹0.

**Expected:** Validation error; no paid sale recorded.

**Observed:** `valid: true`, `cashTendered: 100`, `cashReceived: 100`.

**Cause:** A truthiness check treats zero as an omitted amount and substitutes the bill total.

**Location:** `src/domain/billing.ts:124`.

**Repair:** Distinguish missing values from zero and validate finite, bounded, nonnegative amounts. Test through the actual billing form as well as the domain function.

### A3 — P1: negative split-payment portions are accepted

**Input:** ₹100 total, ₹200 cash, ₹0 UPI, minus ₹100 credit.

**Expected:** Reject the negative component.

**Observed:** The operation is marked valid because the portions sum to ₹100. It records cash ₹200 and credit due minus ₹100.

**Location:** `src/domain/billing.ts:178`.

**Repair:** Validate each component before validating the sum. Apply the same rules to UI, persistence, and future server operations.

### A4 — P1: dozen-to-piece billing undercharges

**Input:** One dozen at ₹30 per piece.

**Expected:** ₹360.

**Observed:** ₹30.

**Cause:** `dozen` is compatible with pieces but has multiplier 1. Packs and pieces are also treated as freely interchangeable without a product-specific pack size.

**Locations:** `src/domain/units.ts:22`, `:28`, `:58`.

**Repair:** Use a correct dozen conversion or remove the unsupported option. Require a declared pack size for pack conversions and reject incompatible units instead of silently returning the quantity unchanged.

### A5 — P1: the report and customer ledger disagree after a reversal

**Setup:** ₹750 credit charge; ₹200 repayment; add a reversal of that repayment through the ledger's reversal model.

**Expected:** Both views show ₹750 outstanding.

**Observed:** The domain ledger shows ₹750. The rendered Reports screen shows ₹550.

**Cause:** The statement consults `ledger_reversals`; Reports filters only each charge/repayment's `isReversed` flag. The reversal UI creates a reversal row without changing those flags. Reports also net all customers together, allowing one customer's advance to offset another customer's debt.

**Locations:** `src/features/reports/ReportsScreen.tsx:88`, `:100`, `:105`; `src/features/ledger/CustomerStatementScreen.tsx:129`.

**Repair:** Derive reports and statements from a shared authoritative event model. Calculate customer debt per customer before aggregation and show advances separately. Reconcile cash/UPI receipts and reversal/refund events as well.

### A6 — P1 before public sharing: expired receipt tokens are accepted locally

**Setup:** A receipt share with an expiry in 2000, pointing to a synthetic saved bill.

**Expected:** Unavailable/expired receipt.

**Observed:** The React receipt screen renders the bill.

**Cause:** The component checks `isRevoked` but never checks `expiresAt`; it also falls back to looking up a bill directly by ID.

**Location:** `src/features/receipts/PublicReceiptScreen.tsx:23`.

**Repair:** Use the restricted server receipt projection with expiry/revocation enforcement, remove ID fallback, and keep the public view separate from local owner-only bill detail. The SQL function's expiry check is not used by the current UI.

### A7 — P1: restore accepts an unsupported version and replaces records

**Setup:** Create/decrypt a legitimate backup, set payload version to `999`, and submit an empty bills array to the restore engine.

**Expected:** Reject the unsupported version before changing data.

**Observed:** Restore resolves successfully; the synthetic database's five bills become zero.

**Cause:** Restore trusts its argument and clears tables before bulk-inserting it. Preview decrypts the data but does not validate the payload version, relationships, financial invariants, or record schemas.

**Locations:** `src/integrations/backup.ts:184`, `:202`, `:218`.

**Repair:** Validate both at preview and immediately before mutation; use a consistent export snapshot, pre-restore backup, duplicate/relationship validation, and an explicit replacement/merge policy. Include or clearly account for drafts, pending sync operations, and receipt shares, which the current export omits.

### A8 — P2: FIFO allocation uses input order instead of dates

**Input:** Two ₹100 charges supplied newest first; repay ₹100.

**Expected:** Allocate against the older charge.

**Observed:** Allocation targets the newer charge.

**Location:** `src/domain/ledger.ts:244`.

**Repair:** Sort by transaction date and a stable tie-breaker; allocate only the unpaid remainder after previous allocations. Wire the function into repayment persistence. The current repayment screen inserts a repayment but does not write allocation records. Overdue logic also needs unpaid per-charge balances.

## Missing or disconnected functionality found by source inspection

### P1 — Connected mode is not implemented

`src/integrations/supabaseClient.ts` constructs a client but no application module imports it. No sign-in, authorized shop membership, push/pull synchronization, conflict resolution, or network-retry worker exists. `sync_outbox` is a schema declaration only: no application code enqueues or processes operations.

The header's sync status defaults to `local`; `App.tsx:36` never supplies a live status. Configuring environment variables alone will not enable cloud synchronization.

### P1 — Customer web bill links do not work across phones

`PublicReceiptScreen.tsx:21` reads `db.bills`, which is the current browser's private IndexedDB. Another phone has a different database. The UI does not call `get_public_receipt`, create receipt-share tokens, or publish bills. WhatsApp handlers do not supply a public URL to the message builder. Text sharing exists; hosted customer receipts do not.

### P1 — Real-shop and practice data are not separated

Screens seed demonstration data automatically and writes use the literal shop ID `demo-munsi-kirana-001`. There is no genuine onboarding/mode switch, clean real-shop workspace, shop-membership selector, or cloud import/merge path. `/settings` renders Reports. IDs such as `bill-${Date.now()}` are incompatible with the SQL UUID columns without a migration/mapping layer.

### P1 — Retry-safe financial operations are not implemented

Billing creates its operation ID inside each submission from `Date.now()` (`BillingScreen.tsx:334`). Repayment creates a fresh timestamp-based ID per attempt (`CustomerStatementScreen.tsx:112`). IndexedDB operation-ID indexes are not unique, and there is no server transaction/retry implementation. An operation-ID field alone does not establish idempotency. Claims of verified concurrent-phone reconciliation are unsupported.

### P1 before enabling cloud — Schema/access model needs more work

The delivered SQL contains private-table RLS declarations, but no `storage.buckets` creation or `storage.objects` policies, despite the completion report claiming private storage policies exist. Owner/member setup is also absent.

Several tables allow `FOR ALL` to any shop member, including mutations/deletions of completed financial records. Cross-shop references are not constrained with matching shop IDs. In particular, `receipt_shares.shop_id` and `receipt_shares.bill_id` are independent foreign keys, and the security-definer receipt function loads the bill by ID without checking it belongs to the share's shop (`supabase/setup.sql:172`, `:278`). This is a concrete authorization-boundary concern requiring schema repair and live two-shop negative tests before cloud exposure. No live exploit or Supabase policy execution was attempted here.

### P2 — Several required workflows are incomplete

- The Home/Billing cost-info handlers do not load attached wholesale photographs; only the Inventory handler does.
- Wholesale upload links are inserted separately, not in one transaction; a failure can leave a partial bulk attachment.
- New-pack detection is set on ordinary rate overrides, but the save path ignores `isNewVariant`. There is no complete explicit new-pack workflow; freshly learned inventory is not refreshed in the active billing session.
- A completed bill can be voided without a refund/retained-credit event or repayment-allocation correction.
- CSV import/export, family access, Dadaji-photo replacement settings, a protected optional AI endpoint, and a complete phone-sync recovery interface are absent.
- `public/_headers` is missing despite being listed as delivered. Fonts are loaded from Google rather than self-hosted, and many important labels are 11–14px despite the large-text requirement.
- PWA assets are generated, but no tested draft-safe update UI, persistent-storage request, physical-device installation evidence, or browser screenshot evidence was found.

## What can reasonably be credited today

- A compiling React/Vite app with its main screen components and generated PWA assets.
- Passing specified annual-compounding and residual-day fixtures.
- Passing basic kg/g billing, known-rate overrides, search aliases, ordinary payment-split and change examples.
- Local IndexedDB persistence and transaction use for the basic bill/credit creation path.
- Local wholesale image handling, basic statements, WhatsApp message construction, encrypted export, and backup decryption.

Those are useful foundations. They do not establish reliable recovery, safe financial corrections, complete cloud operation, or production readiness.

## Repair sequence

1. Fix A1–A5 and A7 so local work and money records are dependable. Correct allocation and overdue semantics (A8), validation, draft completeness, and refund/void behavior.
2. Add clean real-shop onboarding, stable IDs, idempotent operations, and proper practice-mode separation.
3. Implement authenticated Supabase repositories, atomic server operations, durable outbox/retries, two-phone pull/push, and conflicts. Repair SQL ownership/reference invariants and private storage policies before enabling cloud access.
4. Implement genuine revocable/expiring public receipts and verified online/offline sharing. Fix A6; test from a browser with no shop data.
5. Finish attachment access, new-pack learning, import/export, optional integrations, UI/accessibility, and installation/update flows.
6. Replace the existing “100% verified” checklist with evidence for each criterion. Keep external configuration and real-device tests explicitly pending until actually performed.

Run `node output/audit/run-probes.cjs` to reproduce the eight checks. Its zero-pass result reflects eight deliberately targeted suspected defects, not a numerical percentage of the whole application's completion. Keep `npm test` and `npm run build` as regression checks, then add actual browser and Supabase integration coverage.

VERDICT: FAIL -- 8 independent acceptance probes failed, and connected-mode requirements are not implemented end to end.
