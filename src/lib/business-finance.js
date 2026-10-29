const defaultDateKey = (value) => String(value || '').slice(0, 10);
const inside = (date, from, to) => (!from || date >= from) && (!to || date <= to);

export function netSalesForPeriod(orders = [], returns = [], from = '', to = '', dateKey = defaultDateKey) {
  const sales = orders.reduce((sum, order) => {
    if (!['Dispatched', 'Delivered'].includes(order.stage)) return sum;
    const date = dateKey(order.invoice_date || order.created_at);
    return inside(date, from, to) ? sum + Number(order.total || 0) : sum;
  }, 0);
  const credits = returns.reduce((sum, credit) => {
    if (credit.status !== 'posted') return sum;
    const date = dateKey(credit.return_date || credit.created_at);
    return inside(date, from, to) ? sum + Number(credit.total_credit || 0) : sum;
  }, 0);
  return sales - credits;
}

export function costOfGoodsForPeriod(orders = [], returns = [], from = '', to = '', dateKey = defaultDateKey) {
  const ordersById = new Map(orders.map((order) => [order.db_id || order.id, order]));
  const soldCost = orders.reduce((sum, order) => {
    if (!['Dispatched', 'Delivered'].includes(order.stage)) return sum;
    const date = dateKey(order.invoice_date || order.created_at);
    if (!inside(date, from, to)) return sum;
    return sum + (order.items || []).reduce((lineSum, item) => lineSum + Number(item.unit_cost || 0) * Number(item.qty ?? item.quantity ?? 0), 0);
  }, 0);
  const restockedCost = returns.reduce((sum, credit) => {
    if (credit.status !== 'posted') return sum;
    const date = dateKey(credit.return_date || credit.created_at);
    if (!inside(date, from, to)) return sum;
    const order = ordersById.get(credit.order_id);
    if (!order) return sum;
    return sum + (credit.items || []).reduce((lineSum, returned) => {
      if (!returned.restock) return lineSum;
      const original = (order.items || []).find((item) => item.id === returned.order_item_id);
      return lineSum + Number(original?.unit_cost || 0) * Number(returned.quantity || 0);
    }, 0);
  }, 0);
  return soldCost - restockedCost;
}
