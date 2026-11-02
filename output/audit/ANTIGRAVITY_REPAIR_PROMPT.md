# Repair brief for Antigravity

Read these files before changing the implementation:

1. `output/audit/READINESS_AUDIT.md`
2. `output/audit/in-process-results.json`
3. `output/audit/run-probes.cjs`
4. `ANTIGRAVITY_MASTER_PROMPT.md`
5. `MUNSI_PROJECT_BLUEPRINT.md`

The current app compiles and passes its original 25 tests, but an independent audit reproduced eight failures and found that cloud authentication, synchronization, mode separation, and customer-hosted receipts are not wired into the application. The previous “100% implemented and verified” declaration is inaccurate. Do not repeat it.

Use the current repository as the starting point and preserve unrelated work. First reproduce the audit checks using `node output/audit/run-probes.cjs`. The script runs only against synthetic jsdom/fake-indexeddb data. Repair the application behavior; do not weaken assertions or remove the failing cases to get a green result. If architecture changes require adapting a harness selector/import, retain the same externally observable acceptance requirement and explain the adaptation.

Work in this order:

- Preserve drafts during initial hydration and app/navigation interruptions; include active row, customer, discount, and settlement.
- Reject zero/negative/invalid payment inputs correctly; make pack/dozen conversions explicit and correct.
- Unify statement/report arithmetic, reversal handling, outstanding balances, repayments, allocations, and refund/void events.
- Validate backup versions, schemas, relationships, totals, and operation metadata before changing data; provide a safe replacement/merge workflow and a tested restore.
- Add clean practice/local/connected modes, owner setup, stable UUIDs, and truly idempotent business operations.
- Implement Auth/shop membership and atomic Supabase operations, durable outbox sync, acknowledgements, reconnects, conflict handling, and two-device reconciliation.
- Repair SQL cross-shop-reference checks, immutable-financial-record policy, role permissions, onboarding, and private storage policies.
- Publish receipts using a restricted server projection and random revocable expiring tokens. Remove public bill-ID fallback. Verify a customer can view the receipt in a clean browser and cannot access other shop data.
- Finish the remaining original acceptance criteria, including wholesale photos from Billing/Home, real new-pack creation, CSV tools, optional protected AI support, accessible mobile controls, and PWA update/install behavior.

Maintain an honest requirement/evidence matrix in `docs/IMPLEMENTATION_STATUS.md`. Distinguish implemented code, passing isolated tests, live cloud tests, and real-phone checks. A generated service worker is not proof of reliable offline workflows, and a configured Supabase client is not synchronization.

After each repair group, run the relevant reproducer and the affected regression tests. Before declaring readiness, run the original suite/build, the audit probes, real browser workflow tests, and isolated two-shop Supabase access/transaction tests. Do not send real WhatsApp messages or use real customer records in testing. Do not deploy or alter accounts beyond the owner's existing authorization.

Complete local repairs even if credentials are unavailable. Leave cloud/device checks explicitly unverified where their execution is blocked. Return exact results and remaining work rather than a blanket completion claim.
