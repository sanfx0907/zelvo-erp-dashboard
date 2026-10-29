import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCashFlowRows, buildCreditInvoiceRows, summarizeCashFlowRows, summarizeCreditAging } from './business-cashflow.js';

test('a grouped receipt is counted once and a void posts a dated cash-out reversal', () => {
  const receipts = [{ id: 'r1', receipt_no: 'RC-1', customer_id: 'c1', payment_date: '2026-10-01', method: 'bank', total: 900, status: 'voided', voided_at: '2026-10-03T08:00:00Z', allocations: [{ amount: 500 }, { amount: 400 }] }];
  const all = buildCashFlowRows({ receipts, customers: [{ id: 'c1', name: 'Hotel One' }] });
  assert.equal(all.length, 2);
  assert.deepEqual(summarizeCashFlowRows(all), { inflow: 900, outflow: 900 });
  const reversalDay = buildCashFlowRows({ receipts, from: '2026-10-03', to: '2026-10-03' });
  assert.equal(reversalDay.length, 1);
  assert.deepEqual(summarizeCashFlowRows(reversalDay), { inflow: 0, outflow: 900 });
});

test('voided expenses show the original outflow and the reversal on its own date', () => {
  const expenses = [{ id: 'e1', title: 'Fuel', category: 'Travel', amount: 250, payment_method: 'cash', expense_date: '2026-10-04', status: 'voided', voided_at: '2026-10-06T05:00:00Z' }];
  const all = buildCashFlowRows({ expenses });
  assert.deepEqual(summarizeCashFlowRows(all), { inflow: 250, outflow: 250 });
});

test('credit management lists only dispatched credit invoices with a positive open balance', () => {
  const orders = [
    { id: 'a', payment_method: 'credit', stage: 'Dispatched', invoice_date: '2026-09-01' },
    { id: 'b', payment_method: 'credit', stage: 'Delivered', invoice_date: '2026-10-01' },
    { id: 'c', payment_method: 'credit', stage: 'Order Received', invoice_date: '2026-10-02' },
    { id: 'd', payment_method: 'cash', stage: 'Dispatched', invoice_date: '2026-10-03' },
  ];
  const due = { a: 1000, b: 0, c: 500, d: 300 };
  const rows = buildCreditInvoiceRows({ orders, openBalance: order => due[order.id], to: '2026-10-01' });
  assert.deepEqual(rows.map(row => row.order.id), ['a']);
  assert.deepEqual(summarizeCreditAging(rows, '2026-11-01'), { total: 1000, current: 0, days31to60: 0, over60: 1000 });
});
