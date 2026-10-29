const defaultDateKey = (value) => String(value || '').slice(0, 10);

export function buildCashFlowRows({ receipts = [], expenses = [], customers = [], from = '', to = '', dateKey = defaultDateKey }) {
  const customerName = (id) => customers.find((customer) => customer.id === id)?.name || 'Customer';
  const rows = [];

  // One receipt header is one cash event, even when it has several allocations.
  for (const receipt of receipts) {
    const amount = Number(receipt.total || 0);
    const customer = customerName(receipt.customer_id);
    const reference = receipt.receipt_no || 'Receipt';
    rows.push({
      key: `receipt-${receipt.id}`,
      date: dateKey(receipt.payment_date),
      sort: receipt.recorded_at || receipt.payment_date,
      kind: 'Receipt',
      description: `${reference} · ${customer}`,
      method: (receipt.method || 'cash').toUpperCase(),
      inflow: amount,
      outflow: 0,
      status: receipt.status === 'voided' ? 'Reversed' : 'Posted',
      receipt,
      reason: receipt.void_reason,
    });
    if (receipt.status === 'voided' && receipt.voided_at) {
      rows.push({
        key: `receipt-reversal-${receipt.id}`,
        date: dateKey(receipt.voided_at),
        sort: receipt.voided_at,
        kind: 'Receipt reversal',
        description: `Reversal · ${reference} · ${customer}`,
        method: (receipt.method || 'cash').toUpperCase(),
        inflow: 0,
        outflow: amount,
        status: 'Reversal',
        reason: receipt.void_reason,
      });
    }
  }

  for (const expense of expenses) {
    const amount = Number(expense.amount || 0);
    rows.push({
      key: `expense-${expense.id}`,
      date: dateKey(expense.expense_date),
      sort: expense.created_at || expense.expense_date,
      kind: 'Expense',
      description: `${expense.title} · ${expense.category}`,
      method: (expense.payment_method || 'upi').toUpperCase(),
      inflow: 0,
      outflow: amount,
      status: expense.status === 'voided' ? 'Reversed' : 'Posted',
      expense,
      reason: expense.void_reason,
    });
    if (expense.status === 'voided' && expense.voided_at) {
      rows.push({
        key: `expense-reversal-${expense.id}`,
        date: dateKey(expense.voided_at),
        sort: expense.voided_at,
        kind: 'Expense reversal',
        description: `Reversal · ${expense.title}`,
        method: (expense.payment_method || 'upi').toUpperCase(),
        inflow: amount,
        outflow: 0,
        status: 'Reversal',
        reason: expense.void_reason,
      });
    }
  }

  return rows
    .filter((row) => (!from || row.date >= from) && (!to || row.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.sort).localeCompare(String(a.sort)));
}

export function summarizeCashFlowRows(rows) {
  return rows.reduce((summary, row) => ({
    inflow: summary.inflow + Number(row.inflow || 0),
    outflow: summary.outflow + Number(row.outflow || 0),
  }), { inflow: 0, outflow: 0 });
}

export function buildCreditInvoiceRows({ orders = [], openBalance, from = '', to = '', dateKey = defaultDateKey }) {
  return orders
    .filter((order) => order.payment_method === 'credit' && ['Dispatched', 'Delivered'].includes(order.stage))
    .map((order) => ({ order, balance: Number(openBalance(order) || 0), date: dateKey(order.invoice_date || order.created_at) }))
    .filter((row) => row.balance > 0 && (!from || row.date >= from) && (!to || row.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function invoiceAgeDays(invoiceDate, asOfDate) {
  const invoiceMs = Date.parse(`${invoiceDate}T00:00:00Z`);
  const asOfMs = Date.parse(`${asOfDate}T00:00:00Z`);
  if (!Number.isFinite(invoiceMs) || !Number.isFinite(asOfMs)) return 0;
  return Math.max(0, Math.floor((asOfMs - invoiceMs) / 86400000));
}

export function summarizeCreditAging(rows, asOfDate) {
  return rows.reduce((summary, row) => {
    const age = invoiceAgeDays(row.date, asOfDate);
    const bucket = age <= 30 ? 'current' : age <= 60 ? 'days31to60' : 'over60';
    summary[bucket] += Number(row.balance || 0);
    summary.total += Number(row.balance || 0);
    return summary;
  }, { total: 0, current: 0, days31to60: 0, over60: 0 });
}
