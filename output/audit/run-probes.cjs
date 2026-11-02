const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// In-process TypeScript compiler: no esbuild child process or real browser data.
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(output.outputText, filename.replace(/\.tsx?$/, '.cjs'));
  };
}
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'localStorage']) global[name] = name === 'window' ? dom.window : dom.window[name];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;
require('fake-indexeddb/auto');
const fakeIndexedDB = require('fake-indexeddb');
window.indexedDB = global.indexedDB = fakeIndexedDB.indexedDB;
window.IDBKeyRange = global.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
global.CustomEvent = dom.window.CustomEvent;
window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
const React = require('react');
const { render, screen, cleanup, waitFor, act, configure } = require('@testing-library/react');
const { MemoryRouter, Routes, Route } = require('react-router-dom');
configure({ getElementError: message => new Error(message || 'Element assertion failed') });
const { db, seedDemoDataIfEmpty } = require('../../src/data/db.ts');
const { calculatePaymentSettlement } = require('../../src/domain/billing.ts');
const { calculateLineTotal } = require('../../src/domain/units.ts');
const { allocateRepayment, buildCustomerLedgerSummary } = require('../../src/domain/ledger.ts');
const { formatINR } = require('../../src/domain/money.ts');
const { BillingScreen } = require('../../src/features/billing/BillingScreen.tsx');
const { ReportsScreen } = require('../../src/features/reports/ReportsScreen.tsx');
const { PublicReceiptScreen } = require('../../src/features/receipts/PublicReceiptScreen.tsx');
const { createEncryptedBackup, verifyAndPreviewBackup, executeRestore } = require('../../src/integrations/backup.ts');
const el = React.createElement;
const route = component => el(MemoryRouter, null, component);
const probes = [];
const probe = (name, run) => probes.push({ name, run });
probe('Reject negative split-payment components', () => {
  const result = calculatePaymentSettlement(100, 'split', { cashPortion: 200, upiPortion: 0, creditPortion: -100 });
  assert.equal(result.valid, false, JSON.stringify(result));
});
probe('Reject explicitly zero cash tender for a positive bill', () => {
  const result = calculatePaymentSettlement(100, 'cash', { cashTendered: 0 });
  assert.equal(result.valid, false, JSON.stringify(result));
});
probe('Charge twelve pieces for one dozen at a per-piece rate', () => {
  assert.equal(calculateLineTotal(30, 1, 'dozen', 'pc').toNumber(), 360);
});
probe('Allocate repayments to the oldest charge regardless of input order', () => {
  const common = { shopId: 's', customerId: 'c', amount: 100, isReversed: false };
  const result = allocateRepayment(100, [
    { ...common, id: 'new', transactionDate: '02-11-2026', createdAt: '2026-11-02' },
    { ...common, id: 'old', transactionDate: '01-11-2026', createdAt: '2026-11-01' },
  ]);
  assert.equal(result.allocations[0].chargeId, 'old');
});
probe('Retain the saved draft when reopening Billing', async () => {
  const bill = await db.bills.get('bill-hist-1');
  await db.drafts.put({ key: 'active_bill_draft', data: { items: bill.items }, updatedAt: new Date().toISOString() });
  render(route(el(BillingScreen, { language: 'en' })));
  await screen.findByRole('option', { name: /Ramesh/ });
  await act(async () => { await db.bills.toArray(); });
  assert.ok(await db.drafts.get('active_bill_draft'), 'Saved draft was deleted during screen initialization');
});
probe('Reject an expired receipt token', async () => {
  await db.receipt_shares.add({ id: 'expired-share', billId: 'bill-hist-1', token: 'expired-test-token', tokenHash: 'test-hash', createdAt: '1999-01-01T00:00:00Z', expiresAt: '2000-01-01T00:00:00Z', isRevoked: false });
  render(el(MemoryRouter, { initialEntries: ['/r/expired-test-token'] }, el(Routes, null, el(Route, { path: '/r/:shareToken', element: el(PublicReceiptScreen) }))));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  assert.ok(screen.queryByRole('heading', { name: 'रसीद उपलब्ध नहीं है' }), 'Expired token rendered the private-device receipt instead of being rejected');
});
probe('Report outstanding agrees with the ledger after repayment reversal', async () => {
  await db.ledger_reversals.add({ id: 'reverse-repayment', shopId: 'demo-munsi-kirana-001', targetType: 'repayment', targetId: 'repay-demo-1', reason: 'Synthetic audit correction', createdAt: new Date().toISOString() });
  const customer = await db.customers.get('cust-ramesh');
  const summary = buildCustomerLedgerSummary(customer, await db.credit_charges.toArray(), await db.repayments.toArray(), await db.ledger_reversals.toArray());
  assert.equal(summary.outstandingBalance.toNumber(), 750);
  render(route(el(ReportsScreen, { language: 'en' })));
  const card = screen.getByText('Total Outstanding (Current)').parentElement;
  await waitFor(() => assert.ok(!card.textContent.includes(formatINR(0))));
  assert.ok(card.textContent.includes(formatINR(summary.outstandingBalance)), 'Expected outstanding '+formatINR(750)+'; actual report: '+card.textContent);
});
probe('Reject unsupported backup versions before replacing records', async () => {
  const encrypted = await createEncryptedBackup('audit-only-passphrase');
  const preview = await verifyAndPreviewBackup(encrypted, 'audit-only-passphrase');
  const countBefore = await db.bills.count();
  let rejected = false;
  try { await executeRestore({ ...preview.payload, formatVersion: '999', bills: [] }); } catch { rejected = true; }
  assert.deepEqual({ rejected, billsAfter: await db.bills.count() }, { rejected: true, billsAfter: countBefore });
});
(async () => {
  const results = [];
  for (const item of probes) {
    cleanup();
    await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear(); });
    await seedDemoDataIfEmpty();
    try { await item.run(); results.push({ name: item.name, status: 'PASS' }); }
    catch (error) { results.push({ name: item.name, status: 'FAIL', evidence: error.message, errorType: error.name }); }
    console.log(results.at(-1).status+' | '+item.name);
    if (results.at(-1).evidence) console.log(results.at(-1).evidence);
  }
  cleanup();
  db.close();
  dom.window.close();
  const failed = results.filter(r => r.status === 'FAIL').length;
  fs.writeFileSync(path.join(__dirname, 'in-process-results.json'), JSON.stringify({ total: results.length, passed: results.length-failed, failed, isolation: 'Node + jsdom + fake-indexeddb; no real browser records', results }, null, 2));
  console.log(failed ? 'VERDICT: FAIL -- '+failed+' acceptance probes failed' : 'VERDICT: PASS');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error('HARNESS ERROR',error); process.exitCode=2; });
