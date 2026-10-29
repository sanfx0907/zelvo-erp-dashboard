import test from 'node:test';
import assert from 'node:assert/strict';
import { costOfGoodsForPeriod, netSalesForPeriod } from './business-finance.js';

test('cancelled and undispatched orders do not contribute to sales revenue', () => {
  const orders = [
    { id: 'a', stage: 'Dispatched', invoice_date: '2026-10-03', total: 1200 },
    { id: 'b', stage: 'Cancelled', invoice_date: '2026-10-03', total: 400 },
    { id: 'c', stage: 'Processing', invoice_date: '2026-10-03', total: 800 },
  ];
  assert.equal(netSalesForPeriod(orders, [], '2026-10-01', '2026-10-31'), 1200);
});

test('posted returns reduce revenue on return date, while voided returns do not', () => {
  const orders = [{ id: 'a', stage: 'Delivered', invoice_date: '2026-09-30', total: 1200 }];
  const returns = [
    { order_id: 'a', status: 'posted', return_date: '2026-10-04', total_credit: 300 },
    { order_id: 'a', status: 'voided', return_date: '2026-10-05', total_credit: 150 },
  ];
  assert.equal(netSalesForPeriod(orders, returns, '2026-10-01', '2026-10-31'), -300);
});

test('cost of goods falls only for saleable quantities actually restocked', () => {
  const orders = [{ db_id: 'a', id: 'INV-1', stage: 'Dispatched', invoice_date: '2026-10-01', items: [{ id: 'line-1', unit_cost: 50, qty: 4 }] }];
  const returns = [{ order_id: 'a', status: 'posted', return_date: '2026-10-07', items: [
    { order_item_id: 'line-1', quantity: 1, restock: true },
    { order_item_id: 'line-1', quantity: 1, restock: false },
  ] }];
  assert.equal(costOfGoodsForPeriod(orders, returns, '2026-10-01', '2026-10-31'), 150);
  assert.equal(costOfGoodsForPeriod(orders, returns, '2026-10-01', '2026-10-03'), 200);
});
