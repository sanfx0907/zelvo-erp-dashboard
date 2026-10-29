import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
// Import individual icon modules so Vite doesn't scan the entire icon barrel.
// Some published Lucide icon source-map files are empty; scanning the barrel can
// make Vite report a source-map parse error for an icon this app never uses.
import Activity from 'lucide-react/dist/esm/icons/activity.js';
import CalculatorIcon from 'lucide-react/dist/esm/icons/calculator.js';
import ArchiveRestore from 'lucide-react/dist/esm/icons/archive-restore.js';
import ArrowDownLeft from 'lucide-react/dist/esm/icons/arrow-down-left.js';
import ArrowDownRight from 'lucide-react/dist/esm/icons/arrow-down-right.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.js';
import Banknote from 'lucide-react/dist/esm/icons/banknote.js';
import Bell from 'lucide-react/dist/esm/icons/bell.js';
import Boxes from 'lucide-react/dist/esm/icons/boxes.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import BriefcaseBusiness from 'lucide-react/dist/esm/icons/briefcase-business.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import CircleHelp from 'lucide-react/dist/esm/icons/circle-help.js';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Ellipsis from 'lucide-react/dist/esm/icons/ellipsis.js';
import FileBarChart2 from 'lucide-react/dist/esm/icons/file-bar-chart-2.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard.js';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal.js';
import NotebookPen from 'lucide-react/dist/esm/icons/notebook-pen.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import Pencil from 'lucide-react/dist/esm/icons/pencil.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag.js';
import SlidersHorizontal from 'lucide-react/dist/esm/icons/sliders-horizontal.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down.js';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import Wallet from 'lucide-react/dist/esm/icons/wallet.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import { evaluateCalculatorExpression } from './lib/calculator.js';
import { buildCashFlowRows, buildCreditInvoiceRows, invoiceAgeDays, summarizeCashFlowRows, summarizeCreditAging } from './lib/business-cashflow.js';
import { costOfGoodsForPeriod, netSalesForPeriod } from './lib/business-finance.js';

const env = import.meta.env;
const orgId = env.VITE_ZELVO_ORG_ID;
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null;
const fetchAllRows = async (makeQuery) => {
  const pageSize = 500;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
};
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateLabel = (date) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = localDateKey(new Date());
const businessDate = (value) => !value ? today : /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : localDateKey(new Date(value));
const currentMonthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
const DEFAULT_BILL_SETTINGS = {
  business_name: 'Zelvo Cleaning Solutions',
  business_address: 'Deoghar, Jharkhand',
  business_phone: '',
  business_email: '',
  tax_id: '',
  upi_id: '',
  accent_color: '#168bd2',
  footer_note: 'Thank you for your business.',
  terms: 'Please make payment by the due date. Contact us if you have any questions about this bill.',
  show_logo: true,
};
const emptyData = () => ({ customers: [], products: [], orders: [], expenses: [], movements: [], receipts: [], payments: [], notes: [], settings: { ...DEFAULT_BILL_SETTINGS } });
const PREVIEW_DATA_KEY = 'zelvo-preview-v2';
const PREVIEW_RESET_MARKER = 'zelvo-preview-reset-20261022';
// Remove the old built-in demo workspace once on this browser. This key is local-only;
// shared Supabase data is never touched by this reset.
try {
  if (localStorage.getItem(PREVIEW_RESET_MARKER) !== 'done') {
    localStorage.removeItem('zelvo-preview-v1');
    localStorage.setItem(PREVIEW_RESET_MARKER, 'done');
  }
} catch { /* Storage may be unavailable in private or restricted browser contexts. */ }
const readDemo = () => {
  try {
    const saved = localStorage.getItem(PREVIEW_DATA_KEY);
    return saved ? { ...emptyData(), ...JSON.parse(saved) } : emptyData();
  } catch { return emptyData(); }
};
const saveDemo = (data) => {
  try { localStorage.setItem(PREVIEW_DATA_KEY, JSON.stringify(data)); } catch { /* Keep the app usable if local storage is full. */ }
};

const nav = [
  { section: 'WORKSPACE', items: [
    ['overview', 'Overview', LayoutDashboard], ['sales', 'Sales & orders', ShoppingBag],
    ['customers', 'Customers', Users], ['inventory', 'Products & stock', Boxes], ['ledger', 'Customer ledger', BookOpen],
  ] },
  { section: 'MANAGE', items: [
    ['bills', 'Bill generator', FileText], ['cashflow', 'Cash flow', Banknote], ['expenses', 'Expenses', Wallet], ['backup', 'Backup & reset', ArchiveRestore], ['notes', 'Business notes', NotebookPen],
    ['calculator', 'Calculator', CalculatorIcon], ['reports', 'Reports', FileBarChart2],
  ] },
];
const initials = (name = 'Zelvo') => name.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const money = (n) => INR.format(Number(n || 0));
const makeId = () => crypto.randomUUID();

function App() {
  const [page, setPage] = useState('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState(() => supabase ? emptyData() : readDemo());
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [workspaceAccessError, setWorkspaceAccessError] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const canManage = !supabase || ['owner','manager'].includes(memberRole);
  const [notesSetupMissing, setNotesSetupMissing] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showNew, setShowNew] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity:'', reason:'' });
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [showArchivedCustomers, setShowArchivedCustomers] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [collectionOrder, setCollectionOrder] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState('cash');
  const [collectionDate, setCollectionDate] = useState(today);
  const [returnOrder, setReturnOrder] = useState(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState('');
  const [sale, setSale] = useState({ customer_id: '', payment_method: 'cash', items: [] });
  const [form, setForm] = useState({});
  const [filter, setFilter] = useState('All orders');
  const [selectedBillId, setSelectedBillId] = useState('');

  const message = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 3200); };
  const openRecord = (type, row = null, defaults = {}) => {
    setEditingRecord(row);
    setForm(row ? { ...row } : defaults);
    setShowNew(type);
  };
  const closeRecord = () => { setShowNew(''); setEditingRecord(null); setForm({}); };
  const refresh = useCallback(async (notify = true) => {
    if (!supabase || !orgId || !session) return false;
    setBusy(true);
    try {
      const [customers, products, orders, expenses, movements, receipts, returns, notes, settings] = await Promise.all([
        fetchAllRows(() => supabase.from('customers').select('*').eq('org_id', orgId).order('name')),
        fetchAllRows(() => supabase.from('products').select('*').eq('org_id', orgId).order('name')),
        fetchAllRows(() => supabase.from('sales_orders').select('*, items:sales_order_items(*)').eq('org_id', orgId).order('created_at', { ascending: false }).order('id')),
        fetchAllRows(() => supabase.from('expenses').select('*').eq('org_id', orgId).order('expense_date', { ascending: false }).order('id')),
        fetchAllRows(() => supabase.from('inventory_movements').select('*').eq('org_id', orgId).order('movement_date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
        fetchAllRows(() => supabase.from('receipts').select('*, allocations:receipt_allocations(*)').eq('org_id', orgId).order('payment_date', { ascending: false })),
        fetchAllRows(() => supabase.from('order_returns').select('*, items:order_return_items(*)').eq('org_id', orgId).eq('status','posted').order('return_date', { ascending: false })),
        fetchAllRows(() => supabase.from('business_notes').select('*').eq('org_id', orgId).eq('is_deleted',false).order('note_date', { ascending: false }).order('created_at', { ascending: false })),
        supabase.from('organization_settings').select('*').eq('org_id', orgId).maybeSingle(),
      ]);
      const membership = await supabase.from('business_members').select('role').eq('org_id', orgId).eq('user_id', session.user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) {
        setWorkspaceAccessError('This account signed in but is not yet added to the Zelvo workspace. Ask the workspace owner to add your Supabase user to business_members.');
        setOnline(false);
        return false;
      }
      setWorkspaceAccessError('');
      setMemberRole(membership.data.role);
      const notesTableMissing = notes.error && ['42P01','PGRST205'].includes(notes.error.code);
      setNotesSetupMissing(Boolean(notesTableMissing));
      const error = [customers, products, orders, expenses, movements, receipts, returns, settings, ...(notesTableMissing?[]:[notes])].find(x => x.error)?.error;
      if (error) throw error;
      const paymentsData = (receipts.data || []).flatMap(receipt => (receipt.allocations || [])
        .map(allocation => ({ id:receipt.id, order_id:allocation.order_id, amount:allocation.amount, method:receipt.method, payment_date:receipt.payment_date, paid_at:receipt.recorded_at, voided_at:receipt.voided_at, void_reason:receipt.void_reason, receipt_no:receipt.receipt_no, status:receipt.status==='voided'||allocation.status==='voided'?'voided':'posted' })));
      setData({ customers: customers.data, products: products.data, orders: orders.data.map(o => ({ ...o, db_id:o.id, id:o.order_no, items:(o.items||[]).map(i=>({...i,qty:i.quantity})) })), expenses: expenses.data, movements: movements.data, receipts:receipts.data||[], payments:paymentsData, returns:returns.data||[], notes:notes.data||[], settings:settings.data||DEFAULT_BILL_SETTINGS });
      setOnline(true);
      return true;
    } catch (error) {
      setOnline(false);
      if (notify) message(error.message || 'Could not load shared workspace data.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) { setOnline(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (active) { setSession(s); setAuthReady(true); } }).catch(error => { if (active) { setAuthError(error.message || 'Could not check your sign-in session.'); setAuthReady(true); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!supabase || !session) { setOnline(false); return; }
    refresh();
    const interval = window.setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [session, refresh]);
  useEffect(() => { if (!supabase || !session) saveDemo(data); }, [data]);

  const customers = (data.customers || []).filter(c => c.active !== false);
  const ledgerCustomers = data.customers || [];
  const products = (data.products || []).filter(p => p.active !== false);
  const orders = data.orders || [];
  const expenses = data.expenses || [];
  const payments = data.payments || [];
  const returns = data.returns || [];
  const openBalanceForOrder = (order) => {
    if (['Order Received','Cancelled'].includes(order.stage)) return order.stage==='Cancelled'?0:Number(order.total||0);
    const ref=order.db_id||order.id;
    const credited=returns.filter(r=>r.order_id===ref&&r.status==='posted').reduce((sum,r)=>sum+Number(r.total_credit||0),0);
    const received=payments.filter(p=>p.order_id===ref&&p.status==='posted').reduce((sum,p)=>sum+Number(p.amount||0),0);
    return Math.max(0,Number(order.total||0)-credited-received);
  };
  // Include un-dispatched credit orders as commitments, matching the credit-limit check in Postgres.
  const outstandingFor = (customerId) => orders.filter(o => o.customer_id === customerId && o.payment_method === 'credit' && !['Order Received','Processing','Cancelled'].includes(o.stage)).reduce((sum,o)=>sum+openBalanceForOrder(o),0);
  const creditExposureFor = (customerId) => outstandingFor(customerId) + orders.filter(o => o.customer_id === customerId && o.payment_method === 'credit' && ['Order Received','Processing'].includes(o.stage)).reduce((s,o) => s + Number(o.total), 0);
  const totalOutstanding = orders.filter(o => !['Order Received','Processing','Cancelled'].includes(o.stage)).reduce((sum,o)=>sum+openBalanceForOrder(o),0);
  const stockValue = products.reduce((s,p) => s + Number(p.stock || 0) * Number(p.unit_cost || 0), 0);
  const lowStock = products.filter(p => Number(p.stock) <= Number(p.low_stock_at));
  const todaySales = netSalesForPeriod(orders, returns, today, today, businessDate);
  const deliveredCount = orders.filter(o => o.stage === 'Delivered').length;
  const monthStart = `${today.slice(0,7)}-01`;
  const monthRevenue = netSalesForPeriod(orders, returns, monthStart, today, businessDate);
  const monthCogs = costOfGoodsForPeriod(orders, returns, monthStart, today, businessDate);
  const monthExpenses = expenses.filter(e => e.status!=='voided' && String(e.expense_date).slice(0,7) === today.slice(0,7)).reduce((s,e) => s + Number(e.amount), 0);
  const searchedOrders = orders.filter(o => `${o.id} ${o.customer_name} ${o.stage}`.toLowerCase().includes(query.toLowerCase())).filter(o => filter === 'All orders' || (filter === 'Unpaid' ? o.payment_status !== 'paid' && !['Order Received','Cancelled'].includes(o.stage) : o.stage === filter));
  const filteredCustomers = (showArchivedCustomers?ledgerCustomers.filter(c=>c.active===false):customers).filter(c => `${c.name} ${c.phone} ${c.area}`.toLowerCase().includes(query.toLowerCase()));
  const filteredProducts = products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()));
  const archivedProducts = (data.products || []).filter(p => p.active === false && `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()));

  const commit = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      const refreshed = !supabase || !session || await refresh(false);
      message(refreshed ? success : `${success}, but the shared data could not refresh. Check your connection.`);
      return true;
    }
    catch (e) { message(e.message || 'Could not save changes'); return false; }
    finally { setBusy(false); }
  };
  const login = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthStatus(''); setAuthBusy(true);
    try {
      if (!orgId) throw new Error('Workspace configuration is missing. Rebuild the app with VITE_ZELVO_ORG_ID set.');
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
      if (error) throw error;
      setLoginPassword('');
    } catch (error) {
      const raw = error?.message || '';
      const detail = /invalid login credentials/i.test(raw) ? 'Email or password is incorrect. Confirm the user exists under Supabase → Authentication → Users, then reset the password if needed.'
        : /email not confirmed/i.test(raw) ? 'Confirm this account from its Supabase invitation/confirmation email, then sign in again.'
        : /failed to fetch|network/i.test(raw) ? 'Could not reach Supabase. Check your internet connection and confirm the deployed app was built with the correct project URL and publishable key.'
        : raw || 'Sign-in failed. Check the email and password and try again.';
      setAuthError(detail);
    } finally { setAuthBusy(false); }
  };
  const requestPasswordReset = async () => {
    setAuthError(''); setAuthStatus('');
    if (!loginEmail.trim()) return setAuthError('Enter your account email first.');
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), { redirectTo: `${window.location.origin}/` });
      if (error) throw error;
      setAuthStatus('If this account exists, Supabase will email a password reset link.');
    } catch (error) { setAuthError(error.message || 'Could not send the reset email. Check Supabase email settings.'); }
    finally { setAuthBusy(false); }
  };
  const updateRecoveredPassword = async (newPassword) => {
    setAuthError(''); setAuthStatus(''); setAuthBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordRecovery(false); setAuthStatus('Password updated. You are signed in.');
    } catch (error) { setAuthError(error.message || 'Could not update the password. Request a new reset link.'); }
    finally { setAuthBusy(false); }
  };
  const saveNote = async (draft, existing = null) => {
    const title = String(draft.title || '').trim();
    const content = String(draft.content || '').trim();
    if (!title || !draft.note_date) { message('Add a title and date for this note.'); return false; }
    if (supabase && notesSetupMissing) { message('Apply the dated business notes migration in Supabase before saving shared notes.'); return false; }
    const fields = { title, content, note_date:draft.note_date };
    if (supabase && session) {
      return commit(async () => {
        const { data:saved, error } = await supabase.rpc('save_business_note', { p_org_id:orgId, p_note_id:existing?.id||null, p_fields:fields });
        if (error) throw error;
        if (!saved) throw new Error('The note was not saved. Check your workspace membership.');
      }, existing?'Note updated':'Note saved');
    }
    const now=new Date().toISOString();
    const row=existing?{...existing,...fields}:{id:makeId(),...fields,created_at:now};
    setData(current=>({...current,notes:existing?(current.notes||[]).map(n=>n.id===existing.id?row:n):[row,...(current.notes||[])]}));
    message(existing?'Note updated in preview':'Note saved in preview');
    return true;
  };
  const deleteNote = async (note) => {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return false;
    if (supabase && notesSetupMissing) { message('Apply the dated business notes migration in Supabase before editing shared notes.'); return false; }
    if (supabase && session) {
      return commit(async () => {
        const { error } = await supabase.rpc('soft_delete_note', { p_org_id:orgId, p_note_id:note.id });
        if (error) throw error;
      },'Note deleted');
    }
    setData(current=>({...current,notes:(current.notes||[]).filter(n=>n.id!==note.id)}));
    message('Note deleted from preview');
    return true;
  };
  const logout = async () => { await supabase?.auth.signOut(); setSession(null); };
  const createSale = async () => {
    if (!sale.customer_id || !sale.items.length) return message('Choose a customer and add at least one product.');
    const customer = customers.find(c => c.id === sale.customer_id);
    if (!customer) return message('Choose an active customer.');
    if (sale.items.some(i => !products.some(p => p.id === i.product_id) || !Number.isInteger(Number(i.qty)) || Number(i.qty) <= 0)) return message('Each sale line needs a product and a whole-number quantity above zero.');
    const saleTotal = sale.items.reduce((sum,i) => sum + Number(products.find(p=>p.id===i.product_id).price) * Number(i.qty), 0);
    if (!Number.isFinite(saleTotal) || saleTotal <= 0) return message('The invoice total must be greater than zero.');
    if (sale.payment_method === 'credit' && creditExposureFor(customer.id) + saleTotal > Number(customer.credit_limit || 0)) return message('This sale exceeds the customer credit limit.');
    const payload = { p_org_id: orgId, p_customer_id: sale.customer_id, p_payment_method: sale.payment_method, p_items: sale.items.map(i => ({ product_id: i.product_id, quantity: Number(i.qty) })) };
    if (supabase && session) {
      const saved = await commit(async () => { const { error } = await supabase.rpc('create_sales_order', payload); if (error) throw error; }, 'Order created');
      if (!saved) return;
    }
    else {
      const customer = customers.find(c => c.id === sale.customer_id);
      const items = sale.items.map(i => { const p = products.find(x => x.id === i.product_id); return { product_id:p.id, product_name:p.name, qty:Number(i.qty), unit_price:Number(p.price), unit_cost:Number(p.unit_cost) }; });
      const row = { id:`ZLV-${String(2600 + orders.length + 1)}`, org_id:orgId, customer_id:customer.id, customer_name:customer.name, invoice_date:today, created_at:new Date().toISOString(), total:items.reduce((s,i)=>s+i.qty*i.unit_price,0), payment_method:sale.payment_method, stage:'Order Received', payment_status:'pending', items };
      setData({ ...data, orders:[row,...orders] }); message('Order created in preview');
    }
    setShowSale(false); setSale({ customer_id:'', payment_method:'cash', items:[] });
  };
  const dispatchOrder = async (order) => {
    if (supabase && session) return commit(async () => { const { error } = await supabase.rpc('dispatch_order', { p_org_id:orgId, p_order_id:order.db_id||order.id }); if (error) throw error; }, 'Order dispatched and stock updated');
    for (const product of products) {
      const qty = (order.items || []).filter(i=>i.product_id===product.id).reduce((s,i)=>s+Number(i.qty),0);
      if (qty && Number(product.stock)<qty) return message(`Not enough stock for ${product.name}. Adjust finished stock before dispatch.`);
    }
    const nextProducts = products.map(p => { const qty = (order.items || []).filter(i=>i.product_id===p.id).reduce((s,i)=>s+Number(i.qty),0); return qty ? { ...p, stock:Number(p.stock)-qty } : p; });
    const happenedAt=new Date().toISOString();
    const nextOrder = { ...order, stage:'Dispatched', invoice_date:today, dispatched_at:happenedAt, payment_status:order.payment_method==='cash'?'paid':'unpaid' };
    const payment = order.payment_method==='cash' ? { id:makeId(), order_id:order.id, amount:Number(order.total), method:'cash', payment_date:today, paid_at:happenedAt } : null;
    const stockEntries=products.map(p=>({product:p,quantity:(order.items||[]).filter(i=>i.product_id===p.id).reduce((s,i)=>s+Number(i.qty),0)})).filter(x=>x.quantity>0).map(({product,quantity})=>({id:makeId(),product_id:product.id,product_name:product.name,quantity:-quantity,reason:'Sale dispatch',movement_date:today,order_id:order.id,created_at:happenedAt}));
    setData({ ...data, products:nextProducts, orders:orders.map(o=>o.id===order.id?nextOrder:o), payments:payment?[payment,...(data.payments||[])]:data.payments||[], movements:[...stockEntries,...(data.movements||[])] }); message('Order dispatched; stock updated');
  };
  const collect = (order) => { setCollectionMethod('cash'); setCollectionDate(today); setCollectionOrder([order]); };
  const collectInvoices = (invoiceOrders) => { if (!invoiceOrders.length) return; setCollectionMethod('cash'); setCollectionDate(today); setCollectionOrder(invoiceOrders); };
  const recordCollection = async () => {
    if (!collectionOrder) return;
    const invoiceOrders = Array.isArray(collectionOrder)?collectionOrder:[collectionOrder];
    const invoiceDate=invoiceOrders.map(o=>businessDate(o.invoice_date||o.created_at)).sort().at(-1);
    if (!collectionDate||collectionDate<invoiceDate||collectionDate>today) return message('Payment date must be between the invoice date and today.');
    if (supabase && session) {
      const saved = await commit(async () => { const { error } = await supabase.rpc('post_grouped_receipt', { p_org_id:orgId, p_customer_id:invoiceOrders[0].customer_id, p_order_ids:invoiceOrders.map(o=>o.db_id||o.id), p_method:collectionMethod, p_payment_date:collectionDate, p_reference:'' }); if (error) throw error; }, invoiceOrders.length>1?'Grouped full receipt recorded':'Full payment recorded');
      if (!saved) return;
    } else {
      const receiptId=makeId(),paidAt=new Date().toISOString();
      const payments=invoiceOrders.map(order=>({id:receiptId,order_id:order.id,amount:Number(order.total),method:collectionMethod,payment_date:collectionDate,paid_at:paidAt}));
      setData({ ...data, orders:orders.map(o=>invoiceOrders.some(i=>i.id===o.id)?{...o,payment_status:'paid'}:o), payments:[...payments,...(data.payments||[])] });
      message(invoiceOrders.length>1?'Grouped full receipt recorded in preview':`Full payment recorded by ${collectionMethod.toUpperCase()} in preview`);
    }
    setCollectionOrder(null);
  };
  const updateStage = async (order, stage) => {
    if (supabase && session && stage === 'Processing' && order.stage === 'Order Received') return commit(async () => { const { error } = await supabase.rpc('set_order_processing', { p_org_id:orgId, p_order_id:order.db_id||order.id }); if(error) throw error; }, 'Order moved to processing');
    if (supabase && session && stage === 'Dispatched' && order.stage === 'Processing') return dispatchOrder(order);
    if (supabase && session && stage === 'Delivered' && order.stage === 'Dispatched') return commit(async () => { const { error } = await supabase.rpc('set_order_delivered', { p_org_id:orgId, p_order_id:order.db_id||order.id }); if(error) throw error; }, 'Order marked delivered');
    setData({ ...data, orders:orders.map(o=>o.id===order.id?{...o,stage}:o) });
  };
  const deleteOrder = async (order) => {
    const deletable=['Order Received','Processing'].includes(order.stage)&&order.payment_status==='pending'||order.stage==='Cancelled';
    if (!deletable) return message('Only never-invoiced orders with no payment or stock history can be permanently deleted.');
    const reason = window.prompt(`Permanently delete ${order.id} for ${order.customer_name}? Enter a reason for the audit record:`);
    if (!reason || !reason.trim()) return;
    if (!window.confirm(`Delete ${order.id} permanently? This only works if it has never been invoiced, paid, or changed stock. The order and its lines are removed; an audit snapshot is kept.`)) return;
    if (supabase && session) return commit(async () => { const { error } = await supabase.rpc('delete_unposted_order', { p_org_id:orgId, p_order_id:order.db_id||order.id, p_reason:reason.trim() }); if(error) throw error; }, 'Order deleted; audit snapshot retained');
    setData(current=>({...current,orders:(current.orders||[]).filter(x=>x.id!==order.id)}));
    message('Order deleted from preview');
  };
  const cancelOrder = async (order) => {
    if (!['Order Received','Processing'].includes(order.stage)) return message('Dispatched orders must be corrected with a return and credit note.');
    const reason = window.prompt(`Cancel ${order.id} for ${order.customer_name}? Enter a reason:`);
    if (!reason || !reason.trim()) return;
    if (supabase && session) return commit(async () => { const { error } = await supabase.rpc('cancel_order', { p_org_id:orgId, p_order_id:order.db_id||order.id, p_reason:reason.trim() }); if(error) throw error; }, 'Order cancelled');
    setData(current=>({...current,orders:(current.orders||[]).map(x=>x.id===order.id?{...x,stage:'Cancelled',cancellation_reason:reason.trim()}:x)}));
    message('Order cancelled in preview');
  };
  const recordReturn = async (draft) => {
    if (!returnOrder) return;
    const invoiceDate=businessDate(returnOrder.invoice_date||returnOrder.created_at);
    if (!draft.return_date || draft.return_date<invoiceDate || draft.return_date>today || !String(draft.reason||'').trim()) return message('Choose a return date between the invoice date and today, and enter a reason.');
    const items=draft.items.filter(item=>Number(item.quantity)>0).map(item=>({order_item_id:item.order_item_id,quantity:Number(item.quantity),restock:Boolean(item.restock)}));
    if (!items.length) return message('Enter at least one returned quantity.');
    for (const item of items) {
      const line=(returnOrder.items||[]).find(row=>row.id===item.order_item_id);
      const previouslyReturned=(data.returns||[]).filter(row=>row.order_id===(returnOrder.db_id||returnOrder.id)&&row.status==='posted').flatMap(row=>row.items||[]).filter(row=>row.order_item_id===item.order_item_id).reduce((sum,row)=>sum+Number(row.quantity),0);
      if (!Number.isInteger(item.quantity)||item.quantity>(Number(line?.qty||0)-previouslyReturned)) return message(`Returned quantity exceeds what was sold for ${line?.product_name||'this item'}.`);
    }
    if (supabase&&session) {
      const saved=await commit(async()=>{const {error}=await supabase.rpc('post_order_return',{p_org_id:orgId,p_order_id:returnOrder.db_id||returnOrder.id,p_return_date:draft.return_date,p_reason:draft.reason.trim(),p_items:items});if(error)throw error;},'Return and credit note recorded');
      if (!saved) return;
    } else {
      const returnRows=items.map(item=>{const line=(returnOrder.items||[]).find(row=>row.id===item.order_item_id);return {...item,product_id:line?.product_id,product_name:line?.product_name,credit_amount:Number(line?.unit_price||0)*item.quantity};});
      const credit=returnRows.reduce((sum,row)=>sum+row.credit_amount,0);
      setData(current=>({...current,orders:(current.orders||[]).map(o=>o.id===returnOrder.id?{...o,payment_status:credit>=Number(o.total)?'credited':o.payment_status}:o),returns:[{id:makeId(),order_id:returnOrder.db_id||returnOrder.id,customer_id:returnOrder.customer_id,credit_note_no:`CN-${Date.now()}`,return_date:draft.return_date,reason:draft.reason.trim(),total_credit:credit,status:'posted',items:returnRows},...(current.returns||[])],products:(current.products||[]).map(p=>({...p,stock:Number(p.stock||0)+returnRows.filter(r=>r.product_id===p.id&&r.restock).reduce((sum,r)=>sum+r.quantity,0)}))}));
      message('Return and credit note recorded in preview');
    }
    setReturnOrder(null);
  };
  const saveBillSettings = async (settings) => {
    if (supabase && session) {
      await commit(async () => {
        const { error } = await supabase.rpc('save_bill_settings', { p_org_id:orgId, p_fields:settings });
        if (error) throw error;
      }, 'Bill settings saved for your workspace');
    } else {
      setData({ ...data, settings });
      message('Bill settings saved in this browser preview');
    }
  };
  const saveRecord = async (type) => {
    const fields = { ...form };
    for (const key of ['name','sku','unit','title','category','contact_person','phone','area']) if (typeof fields[key] === 'string') fields[key] = fields[key].trim();
    if (type === 'customer') {
      const limit = fields.credit_limit === '' || fields.credit_limit == null ? 0 : Number(fields.credit_limit);
      if (!fields.name) return message('Customer name is required');
      if (!Number.isFinite(limit) || limit < 0) return message('Credit limit must be zero or more.');
      fields.credit_limit = limit;
    }
    if (type === 'product') {
      if (!fields.name || !fields.sku) return message('Product name and SKU are required');
      fields.unit = fields.unit || '5L can';
      for (const key of ['price','unit_cost']) {
        const value = Number(fields[key]);
        if (!Number.isFinite(value) || value < 0) return message(`${key === 'price' ? 'Selling price' : 'Unit cost'} must be zero or more.`);
        fields[key] = value;
      }
      for (const key of (editingRecord ? ['low_stock_at'] : ['stock','low_stock_at'])) {
        const value = fields[key] === '' || fields[key] == null ? 0 : Number(fields[key]);
        if (!Number.isInteger(value) || value < 0) return message(`${key === 'stock' ? 'Opening stock' : 'Low stock alert'} must be a whole number of zero or more.`);
        fields[key] = value;
      }
      if (!editingRecord && Number(fields.stock)>0 && !fields.stock_date) return message('Choose the opening stock date.');
    }
    if (type === 'expense') {
      const amount = Number(fields.amount);
      if (!fields.title || !fields.category || !Number.isFinite(amount) || amount <= 0) return message('Add a description, category, and positive amount.');
      fields.amount = amount;
    }
    if (type === 'expense') fields.expense_date = fields.expense_date || today;
    const rpcFields = { ...fields };
    for (const key of ['id','db_id','org_id','created_at','updated_at','stock_date']) delete rpcFields[key];
    if (editingRecord && type === 'product') delete rpcFields.stock;
    const rpcName = type==='customer'?'save_customer':type==='product'?'save_product':'save_expense';
    const rpcArgs = { p_org_id:orgId, p_fields:rpcFields };
    rpcArgs[type==='customer'?'p_customer_id':type==='product'?'p_product_id':'p_expense_id'] = editingRecord?.id || null;
    if (type==='product') rpcArgs.p_stock_date = fields.stock_date || (Number(fields.stock)>0?today:null);
    if (editingRecord) {
      const changes = { ...fields };
      for (const key of ['id','db_id','org_id','created_at']) delete changes[key];
      if (type === 'product') { delete changes.stock; delete changes.stock_date; }
      if (supabase && session) {
        const saved = await commit(async () => {
          const { data: updated, error } = await supabase.rpc(rpcName, rpcArgs);
          if (error) throw error;
          if (!updated) throw new Error('Record was not updated. Check your workspace access and try again.');
        }, `${type[0].toUpperCase()+type.slice(1)} updated`);
        if (!saved) return;
      } else {
        const key = type === 'customer' ? 'customers' : type==='product'?'products':'expenses';
        setData({ ...data, [key]:(data[key]||[]).map(row=>row.id===editingRecord.id?{...row,...changes}:row) });
        message(`${type[0].toUpperCase()+type.slice(1)} updated in preview`);
      }
    } else if (supabase && session) {
      const saved = await commit(async () => { const { error } = await supabase.rpc(rpcName, rpcArgs); if(error) throw error; }, `${type[0].toUpperCase()+type.slice(1)} saved`);
      if (!saved) return;
    } else {
      const row = { id:makeId(), ...rpcFields };
      if(type==='customer') row.credit_limit=Number(row.credit_limit||0);
      if(type==='product') { row.price=Number(row.price); row.unit_cost=Number(row.unit_cost); row.stock=Number(row.stock); row.low_stock_at=Number(row.low_stock_at||0); }
      if(type==='expense') row.amount=Number(row.amount);
      const key=type==='customer'?'customers':type==='product'?'products':'expenses';
      setData({ ...data, [key]:[row,...(data[key]||[])], ...(type==='product'&&row.stock>0?{movements:[{id:makeId(),product_id:row.id,product_name:row.name,quantity:row.stock,reason:'Opening balance',movement_date:fields.stock_date||today,created_at:new Date().toISOString()},...(data.movements||[])]}:{}) });
      message('Saved in preview');
    }
    closeRecord();
  };
  const adjustStock = (product) => { setStockProduct(product); setStockForm({ quantity:'', movement_date:today, reason:'' }); };
  const saveStockAdjustment = async () => {
    if (!stockProduct) return;
    const quantity = Number(stockForm.quantity);
    const reason = stockForm.reason.trim();
    if (!stockForm.movement_date) return message('Choose the stock change date.');
    if (!Number.isInteger(quantity) || quantity === 0) return message('Enter a non-zero whole number of units.');
    if (Number(stockProduct.stock) + quantity < 0) return message(`Stock cannot go below zero. Current stock is ${stockProduct.stock}.`);
    if (supabase && session) {
      const saved = await commit(async () => {
        const { error } = await supabase.rpc('adjust_finished_stock', { p_org_id:orgId, p_product_id:stockProduct.id, p_quantity:quantity, p_movement_date:stockForm.movement_date, p_reason:reason||null });
        if (error) throw error;
      }, 'Stock adjustment recorded');
      if (!saved) return;
    } else {
      setData({ ...data, products:(data.products||[]).map(p=>p.id===stockProduct.id?{...p,stock:Number(p.stock)+quantity}:p), movements:[{id:makeId(),product_id:stockProduct.id,product_name:stockProduct.name,quantity,reason:reason||null,movement_date:stockForm.movement_date,created_at:new Date().toISOString()},...(data.movements||[])] });
      message('Stock adjustment recorded in preview');
    }
    setStockProduct(null);
  };
  const archiveProduct = async (product) => {
    const reason = window.prompt(`Remove ${product.name} from active inventory? Add an optional reason for the audit history:`, '');
    if (reason === null) return;
    if (supabase && session) {
      const saved = await commit(async () => {
        const { error } = await supabase.rpc('remove_product', { p_org_id:orgId, p_product_id:product.id, p_reason:reason.trim() });
        if (error) throw error;
      }, 'Product removed from active inventory');
      if (!saved) return;
    } else {
      setData({ ...data, products:(data.products||[]).map(p=>p.id===product.id?{...p,active:false}:p) });
      message('Product removed from active inventory');
    }
    setArchiveTarget(null);
  };
  const restoreProduct = async (product) => {
    if (supabase && session) {
      const saved = await commit(async () => {
        const { error } = await supabase.rpc('restore_product', { p_org_id:orgId, p_product_id:product.id });
        if (error) throw error;
      }, 'Product restored to active inventory');
      if (!saved) return;
    } else {
      setData({ ...data, products:(data.products||[]).map(p=>p.id===product.id?{...p,active:true}:p) });
      message('Product restored to active inventory');
    }
    setShowArchived(false);
  };
  const archiveCustomer = async (customer) => {
    const reason=window.prompt(`Remove ${customer.name} from the active customer list? Add an optional audit reason:`, '');
    if(reason===null)return;
    if(supabase&&session){const saved=await commit(async()=>{const {error}=await supabase.rpc('remove_customer',{p_org_id:orgId,p_customer_id:customer.id,p_reason:reason.trim()});if(error)throw error;},'Customer removed or archived');if(!saved)return;}
    else {setData(current=>({...current,customers:(current.customers||[]).map(c=>c.id===customer.id?{...c,active:false}:c)}));message('Customer removed from active list');}
  };
  const restoreCustomer = async (customer) => {
    if(supabase&&session){const saved=await commit(async()=>{const {error}=await supabase.rpc('restore_customer',{p_org_id:orgId,p_customer_id:customer.id});if(error)throw error;},'Customer restored');if(!saved)return;}
    else {setData(current=>({...current,customers:(current.customers||[]).map(c=>c.id===customer.id?{...c,active:true}:c)}));message('Customer restored in preview');}
    setShowArchivedCustomers(false);
  };
  const voidExpense = async (expense) => {
    if (expense.status==='voided') return;
    const reason=window.prompt(`Void expense “${expense.title}” for ${money(expense.amount)}? Enter a reason for the audit record:`);
    if (!reason||!reason.trim()) return;
    if (!window.confirm('This expense will remain in history but be excluded from financial totals. Continue?')) return;
    if (supabase&&session) return commit(async()=>{const {error}=await supabase.rpc('void_expense',{p_org_id:orgId,p_expense_id:expense.id,p_reason:reason.trim()});if(error)throw error;},'Expense voided');
    setData(current=>({...current,expenses:(current.expenses||[]).map(row=>row.id===expense.id?{...row,status:'voided',void_reason:reason.trim()}:row)}));
    message('Expense voided in preview');
  };
  const deleteExpense = async (expense) => {
    const reason=window.prompt(`Delete expense “${expense.title}” for ${money(expense.amount)}? Enter a reason. It will be removed from expenses and cash-flow totals; an audit snapshot will be kept:`);
    if(!reason||!reason.trim())return;
    if(!window.confirm('Permanently remove this expense from the active records? The database will keep an audit snapshot of the deleted entry.'))return;
    if(supabase&&session)return commit(async()=>{const {error}=await supabase.rpc('delete_expense',{p_org_id:orgId,p_expense_id:expense.id,p_reason:reason.trim()});if(error)throw error;},'Expense deleted from active records; audit snapshot retained');
    setData(current=>({...current,expenses:(current.expenses||[]).filter(row=>row.id!==expense.id)}));
    message('Expense deleted in preview');
  };
  const voidReceipt = async (payment) => {
    if(payment.status!=='posted')return;
    const reason=window.prompt(`Void receipt ${payment.receipt_no||''}? This reverses all invoice allocations in that receipt. Enter a reason:`);
    if(!reason||!reason.trim())return;
    if(!window.confirm('Void the entire receipt? All invoices allocated to it will become unpaid again.'))return;
    if(supabase&&session)return commit(async()=>{const {error}=await supabase.rpc('void_receipt',{p_org_id:orgId,p_receipt_id:payment.id,p_reason:reason.trim()});if(error)throw error;},'Receipt voided; invoice balances restored');
    setData(current=>({...current,payments:(current.payments||[]).map(p=>p.id===payment.id?{...p,status:'voided',void_reason:reason.trim()}:p)}));
    message('Receipt voided in preview');
  };
  const resetBusinessData = async (backupAuditId) => {
    if (!supabase || !session || memberRole !== 'owner') { message('Only the connected workspace owner can reset live business data.'); return false; }
    return commit(async () => {
      const { error } = await supabase.rpc('reset_business_data', { p_org_id:orgId, p_confirmation:'RESET ZELVO DATA', p_backup_audit_id:backupAuditId });
      if (error) throw error;
    }, 'Business records reset. Workspace settings, users, and reset audit record were preserved.');
  };

  if (supabase && !authReady) return <div className="login-screen"><div className="login-card"><div className="eyebrow">ZELVO WORKSPACE</div><h1>Checking your session…</h1><p>Please wait while we securely connect.</p></div></div>;
  if (supabase && (!session || passwordRecovery)) return <Login email={loginEmail} setEmail={setLoginEmail} password={loginPassword} setPassword={setLoginPassword} onSubmit={passwordRecovery?e=>{e.preventDefault();updateRecoveredPassword(loginPassword);}:login} error={authError||(!orgId?'Workspace configuration is missing. Rebuild the app with VITE_ZELVO_ORG_ID set.':'')} status={authStatus} busy={authBusy} recovery={passwordRecovery} onReset={requestPasswordReset} onCancelRecovery={()=>{setPasswordRecovery(false);setAuthError('');setAuthStatus('');}} />;
  const title = { overview:'Overview', sales:'Sales & orders', customers:'Customers', inventory:'Products & stock', ledger:'Customer ledger', bills:'Bill generator', cashflow:'Cash flow', expenses:'Expenses', backup:'Backup & reset', notes:'Business notes', calculator:'Calculator', reports:'Reports' }[page];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><img className="brand-logo" src="/zelvo-wordmark.jpg" alt="Zelvo Cleaning Solutions"/><button type="button" className="icon-btn sidebar-close" aria-label="Close navigation menu" onClick={()=>setMobileNav(false)}><X size={17}/></button></div>
      <div className="workspace-switch" aria-label="Zelvo Cleaning business workspace"><div className="workspace-icon"><img src="/zelvo-mark.jpg" alt=""/></div><span><b>Zelvo Cleaning</b><small>Business workspace</small></span><ChevronDown size={15}/></div>
      <div className="side-scroll">{nav.map(group=>{const items=group.items.filter(([id])=>id!=='backup'||['owner','manager'].includes(memberRole));return <div className="nav-group" key={group.section}><div className="nav-label">{group.section}</div>{items.map(([id,label,Icon])=><button key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>{setPage(id);setMobileNav(false)}}><Icon size={17}/><span>{label}</span>{id==='inventory'&&lowStock.length>0&&<i className="nav-count">{lowStock.length}</i>}</button>)}</div>})}
        <div className="sidebar-callout"><div className="callout-icon"><Zap size={15}/></div><b>Keep stock in sync</b><p>Every dispatch updates finished goods automatically.</p><button onClick={()=>setPage('inventory')}>View inventory <ArrowRight size={13}/></button></div>
      </div>
      <div className="side-bottom"><button className="nav-link" onClick={()=>setPage('reports')}><CircleHelp size={17}/><span>Help & reports</span></button><div className="user-card"><div className="avatar">{initials(session?.user?.email||'Zelvo')}</div><div className="user-info"><b>{session?.user?.email?.split('@')[0]||'Zelvo team'}</b><small>{supabase?'Shared workspace':'Preview mode'}</small></div><button type="button" className="icon-btn" onClick={()=>supabase?logout():message('Connect Supabase to enable shared sign-in')} title="Account" aria-label="Sign out"><Ellipsis size={18}/></button></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button type="button" className="icon-btn mobile-menu" aria-label="Open navigation menu" onClick={()=>setMobileNav(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><b>{title}</b></div></div><div className="topbar-actions"><label className="global-search"><Search size={16}/><input placeholder="Search anything..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><div className={`connection-pill ${online?'connected':''}`}><span/>{online?'Synced':supabase?'Offline':'Preview'}</div><button type="button" className="icon-btn notification" aria-label="Show stock alerts" onClick={()=>message(lowStock.length?`${lowStock.length} products are at or below low-stock level`:'You are all caught up')}><Bell size={17}/><i/></button><div className="avatar top-avatar">{initials(session?.user?.email||'Zelvo')}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/>BUSINESS OVERVIEW</div><h1>{title}</h1><p>{page==='overview'?'A clear view of how your business is doing today.':'Manage your business records in one place.'}</p></div>{page!=='backup'&&<div className="heading-actions"><button className="button button-secondary" onClick={()=>{const csv=toCsv(orders);download(csv,'zelvo-orders.csv')}}><Download size={15}/>Export</button><button className="button button-primary" onClick={()=>{setShowSale(true);setSale({customer_id:customers[0]?.id||'',payment_method:'cash',items:[]})}}><Plus size={16}/>New sale</button></div>}</div>
        {workspaceAccessError&&<div className="workspace-error"><ShieldCheck size={17}/><span><b>Workspace access needs setup</b>{workspaceAccessError}</span></div>}
        {page==='overview'&&<Overview data={data} todaySales={todaySales} outstanding={totalOutstanding} stockValue={stockValue} lowStock={lowStock} monthRevenue={monthRevenue} monthCogs={monthCogs} monthExpenses={monthExpenses} onPage={setPage} onSale={()=>setShowSale(true)} onDispatch={dispatchOrder} onDelete={deleteOrder} onCancel={cancelOrder} onReturn={setReturnOrder} canManage={canManage} />}
        {page==='sales'&&<Sales orders={searchedOrders} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onNew={()=>setShowSale(true)} onDispatch={dispatchOrder} onCollect={collect} onStage={updateStage} onDelete={deleteOrder} onCancel={cancelOrder} onReturn={setReturnOrder} canManage={canManage} busy={busy}/>}
        {page==='customers'&&<Customers customers={filteredCustomers} showArchived={showArchivedCustomers} onToggleArchived={()=>setShowArchivedCustomers(v=>!v)} balance={outstandingFor} onAdd={()=>openRecord('customer')} onEdit={row=>openRecord('customer',row)} onArchive={archiveCustomer} onRestore={restoreCustomer} onLedger={row=>{setLedgerCustomerId(row.id);setPage('ledger')}} onCollect={collect} orders={orders} canManage={canManage}/>}
        {page==='ledger'&&<CustomerLedger customers={ledgerCustomers} orders={orders} payments={data.payments||[]} returns={data.returns||[]} onCollect={collect} onCollectInvoices={collectInvoices} onDelete={deleteOrder} onCancel={cancelOrder} onReturn={setReturnOrder} onVoidReceipt={voidReceipt} canManage={canManage} customerId={ledgerCustomerId||customers[0]?.id||''} onCustomerChange={setLedgerCustomerId} />}
        {page==='cashflow'&&<CashFlow receipts={data.receipts||[]} expenses={data.expenses||[]} customers={ledgerCustomers} orders={orders} openBalance={openBalanceForOrder} onCollect={collect} onOpenLedger={id=>{setLedgerCustomerId(id);setPage('ledger')}} onVoidReceipt={voidReceipt} onVoidExpense={voidExpense} onDeleteExpense={deleteExpense} canManage={canManage}/>}
        {page==='backup'&&<BackupReset data={data} isOwner={memberRole==='owner'} connected={online} busy={busy} onReset={resetBusinessData}/>}
        {page==='inventory'&&<Inventory products={filteredProducts} archivedProducts={archivedProducts} showArchived={showArchived} onToggleArchived={()=>setShowArchived(v=>!v)} lowStock={lowStock} stockValue={stockValue} onAdd={()=>openRecord('product')} onEdit={row=>openRecord('product',row)} onAdjust={adjustStock} onArchive={setArchiveTarget} onRestore={restoreProduct} movements={data.movements||[]} canManage={canManage}/>}
        {page==='bills'&&<BillStudio orders={orders} customers={customers} settings={{...DEFAULT_BILL_SETTINGS,...(data.settings||{})}} selectedId={selectedBillId} setSelectedId={setSelectedBillId} onSave={saveBillSettings} onReturn={setReturnOrder} canManage={canManage}/>}
        {page==='expenses'&&<Expenses expenses={expenses.filter(e=>`${e.title} ${e.category}`.toLowerCase().includes(query.toLowerCase()))} total={expenses.filter(e=>e.status!=='voided').reduce((s,e)=>s+Number(e.amount),0)} onAdd={()=>openRecord('expense',null,{expense_date:today,payment_method:'upi'})} onVoid={voidExpense} onDelete={deleteExpense} canManage={canManage}/>}
        {page==='notes'&&<NotesBoard notes={data.notes||[]} search={query} onSave={saveNote} onDelete={deleteNote} setupMissing={notesSetupMissing} />}
        {page==='calculator'&&<BusinessCalculator/>}
        {page==='reports'&&<Reports orders={orders} expenses={expenses} products={products} outstanding={totalOutstanding} revenue={monthRevenue} cogs={monthCogs} expenseTotal={monthExpenses} onPage={setPage}/>}
        <footer className="footer"><span>© {new Date().getFullYear()} Zelvo Cleaning Solutions</span><span><ShieldCheck size={13}/> {online?'Your workspace is synced':supabase?'Waiting for connection':'Local preview'} <span className="footer-sep">·</span> Built for daily business</span></footer>
      </div>
    </main>
    {showSale&&<SaleModal customers={customers} products={products} sale={sale} setSale={setSale} onClose={()=>setShowSale(false)} onSubmit={createSale} busy={busy} balance={creditExposureFor}/>}
    {showNew&&<RecordModal type={showNew} form={form} setForm={setForm} editing={!!editingRecord} onClose={closeRecord} onSave={()=>saveRecord(showNew)} busy={busy}/>}
    {stockProduct&&<StockAdjustmentModal product={stockProduct} form={stockForm} setForm={setStockForm} onClose={()=>setStockProduct(null)} onSave={saveStockAdjustment} busy={busy}/>}
    {archiveTarget&&<ArchiveProductModal product={archiveTarget} onClose={()=>setArchiveTarget(null)} onConfirm={()=>archiveProduct(archiveTarget)} busy={busy}/>}
    {returnOrder&&<ReturnModal key={returnOrder.db_id||returnOrder.id} order={returnOrder} returns={data.returns||[]} onClose={()=>setReturnOrder(null)} onSave={recordReturn} busy={busy}/>}
    {collectionOrder&&<PaymentModal orders={Array.isArray(collectionOrder)?collectionOrder:[collectionOrder]} dueAmounts={(Array.isArray(collectionOrder)?collectionOrder:[collectionOrder]).map(openBalanceForOrder)} method={collectionMethod} setMethod={setCollectionMethod} paymentDate={collectionDate} setPaymentDate={setCollectionDate} onClose={()=>setCollectionOrder(null)} onConfirm={recordCollection} busy={busy}/>}
    {notice&&<div className="toast" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  </div>;
}

function Login({email,setEmail,password,setPassword,onSubmit,error,status,busy,recovery,onReset,onCancelRecovery}) {
  return <div className="login-screen"><div className="login-card">
    <img className="login-logo" src="/zelvo-mark.jpg" alt="Zelvo logo"/><div className="eyebrow">ZELVO WORKSPACE</div>
    <h1>{recovery?'Choose a new password':'Welcome back'}</h1><p>{recovery?'Enter a new password for your Zelvo account.':'Sign in to access your shared business data.'}</p>
    {error&&<div className="form-error" role="alert">{error}</div>}{status&&<div className="form-success" role="status">{status}</div>}
    <form onSubmit={onSubmit}>
      {!recovery&&<label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label>}
      {recovery&&<label>New password<input type="password" autoComplete="new-password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>}
      {!recovery&&<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>}
      <button className="button button-primary full-button" disabled={busy}>{busy?'Please wait…':recovery?'Update password':'Sign in'} {!busy&&<ArrowRight size={16}/>}</button>
    </form>
    {recovery?<button className="login-link" type="button" onClick={onCancelRecovery}>Back to sign in</button>:<button className="login-link" type="button" disabled={busy} onClick={onReset}>Forgot password?</button>}
    <small>Accounts are created by your workspace administrator. Ask them to invite your email if you don’t have an account.</small>
  </div><div className="login-foot">Zelvo Cleaning Solutions <span>·</span> Secure shared workspace</div></div>;
}

function NotesBoard({notes,search,onSave,onDelete,setupMissing}) {
  const [editing,setEditing]=useState(null);
  const [draft,setDraft]=useState({title:'',content:'',note_date:today});
  const [saving,setSaving]=useState(false);
  const visible=notes.filter(note=>`${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()));
  const reset=()=>{setEditing(null);setDraft({title:'',content:'',note_date:today});};
  const edit=(note)=>{setEditing(note);setDraft({title:note.title||'',content:note.content||'',note_date:businessDate(note.note_date)});};
  const submit=async(event)=>{event.preventDefault();setSaving(true);try{if(await onSave(draft,editing))reset();}finally{setSaving(false);}};
  return <>{setupMissing&&<div className="note-migration-banner"><NotebookPen size={16}/><span><b>Enable shared notes</b>Run <code>20261022_business_notes.sql</code> in your Supabase SQL Editor. Other workspace features continue to work until then.</span></div>}<div className="notes-layout">
    <form className="panel note-editor" onSubmit={submit}>
      <div className="panel-toolbar"><div><h2>{editing?'Edit note':'Add a note'}</h2><p>Keep dated reminders and business details in one shared place.</p></div><NotebookPen size={18}/></div>
      <div className="note-editor-body"><label className="field-label">Title<input autoFocus value={draft.title} maxLength="120" required onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="For example, hotel follow-up"/></label>
        <label className="field-label">Date<input type="date" required value={draft.note_date} onChange={e=>setDraft({...draft,note_date:e.target.value})}/></label>
        <label className="field-label">Note<textarea rows="7" value={draft.content} maxLength="5000" onChange={e=>setDraft({...draft,content:e.target.value})} placeholder="Write a reminder, call summary, delivery detail, or other business note."/></label>
        <div className="note-form-actions">{editing&&<button className="button button-secondary" type="button" onClick={reset}>Cancel</button>}<button className="button button-primary" disabled={saving||!draft.title.trim()||!draft.note_date}><Check size={15}/>{saving?'Saving…':editing?'Save changes':'Save note'}</button></div>
      </div>
    </form>
    <section className="panel notes-list-panel"><div className="panel-toolbar"><div><h2>Business notes</h2><p>{visible.length} {visible.length===1?'note':'notes'}{search?' matching your search':''}</p></div><NotebookPen size={18}/></div>
      {visible.length?<div className="notes-list">{visible.map(note=><article className="note-card" key={note.id}><div className="note-card-head"><div><time dateTime={note.note_date}>{dateLabel(note.note_date)}</time><h3>{note.title}</h3></div><div className="note-card-actions"><button className="tiny-action" onClick={()=>edit(note)} aria-label={`Edit ${note.title}`}><Pencil size={13}/>Edit</button><button className="tiny-action danger-action" onClick={()=>onDelete(note)} aria-label={`Delete ${note.title}`}><Trash2 size={13}/>Delete</button></div></div><p>{note.content||'No extra details.'}</p></article>)}</div>:<div className="empty-state notes-empty"><NotebookPen size={23}/><b>{search?'No notes match your search.':'No business notes yet.'}</b><span>Add a dated note. It will be shared across your signed-in devices.</span></div>}
    </section>
  </div></>;
}

function BusinessCalculator() {
  const [expression,setExpression]=useState('');
  const [result,setResult]=useState('');
  const [error,setError]=useState('');
  const append=(value)=>{setExpression(current=>current+value);setResult('');setError('');};
  const clear=()=>{setExpression('');setResult('');setError('');};
  const backspace=()=>{setExpression(value=>value.slice(0,-1));setResult('');setError('');};
  const calculate=()=>{try{setResult(new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(evaluateCalculatorExpression(expression)));setError('');}catch(err){setResult('');setError(err.message);}};
  const keys=[['AC','clear'],['(', '('],[')', ')'],['÷','/'],['7','7'],['8','8'],['9','9'],['×','*'],['4','4'],['5','5'],['6','6'],['−','-'],['1','1'],['2','2'],['3','3'],['+','+'],['%','%'],['0','0'],['.','.'],['=','equals']];
  return <div className="calculator-wrap"><section className="panel calculator-panel"><div className="panel-toolbar"><div><h2>Business calculator</h2><p>Quick calculations for quantities, prices, and totals. Nothing is posted to your books.</p></div><CalculatorIcon size={18}/></div><div className="calculator-body">
    <label className="calculator-screen-label" htmlFor="calculator-expression">Calculation</label><input id="calculator-expression" className="calculator-screen" inputMode="decimal" autoComplete="off" value={expression} onChange={e=>{setExpression(e.target.value);setResult('');setError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();calculate();}}} placeholder="0" aria-label="Calculation expression"/>
    <div className={`calculator-result ${error?'calculator-error':''}`} aria-live="polite">{error|| (result?`Result: ${result}`:'Use brackets and % as needed')}</div>
    <div className="calculator-keys">{keys.map(([label,value])=><button key={label} className={`${['÷','×','−','+'].includes(label)?'operator-key':''} ${label==='='?'equals-key':''} ${label==='AC'?'clear-key':''}`} onClick={()=>value==='clear'?clear():value==='equals'?calculate():append(value)}>{label}</button>)}<button className="backspace-key" onClick={backspace}>Delete last</button></div>
  </div></section></div>;
}

function Metric({label,value,change,icon:Icon,tone='blue',foot}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={17}/></div></div><div className="metric-value">{value}</div><div className="metric-foot">{change&&<span className={`metric-change ${change.startsWith('-')?'negative':''}`}>{change.startsWith('-')?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>} {change}</span>}<span>{foot}</span></div></div>; }
function PanelHead({title,sub,action,click}) { return <div className="panel-head"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action&&<button className="text-button" onClick={click}>{action}<ArrowRight size={14}/></button>}</div>; }
function StagePill({stage}) { const cls=stage==='Delivered'?'green':stage==='Dispatched'?'blue':stage==='Processing'?'amber':'muted'; return <span className={`status-pill ${cls}`}><i/>{stage}</span>; }
function PayPill({status,method}) { return <span className={`pay-pill ${status==='paid'?'paid':status==='unpaid'?'unpaid':'pending'}`}>{status==='paid'?<Check size={12}/>:<CreditCard size={12}/>} {status==='paid'?'Paid':status==='unpaid'?'Credit due':method==='credit'?'Credit':'Due on dispatch'}</span>; }

function Overview({data,todaySales,outstanding,stockValue,lowStock,monthRevenue,monthCogs,monthExpenses,onPage,onSale,onDispatch,onDelete,onCancel,onReturn,canManage}) {
 const orders=data.orders||[], products=data.products||[], customers=data.customers||[]; const recent=orders.slice(0,5);
 const daysInMonth=new Date().getDate();
 const daySales=Array.from({length:daysInMonth},(_,i)=>netSalesForPeriod(orders,data.returns||[],`${today.slice(0,7)}-${String(i+1).padStart(2,'0')}`,`${today.slice(0,7)}-${String(i+1).padStart(2,'0')}`,businessDate));
 const max=Math.max(1,...daySales.map(Math.abs));
 return <>
   <section className="metrics-grid"><Metric label="Net sales today" value={money(todaySales)} foot="invoices less dated credits" icon={TrendingUp}/><Metric label="Outstanding credit" value={money(outstanding)} foot="across unpaid invoices" icon={CreditCard} tone="amber"/><Metric label="Products in stock" value={products.reduce((s,p)=>s+Number(p.stock||0),0).toLocaleString('en-IN')} foot={`worth ${money(stockValue)} at cost`} icon={Boxes} tone="violet"/><Metric label="Orders delivered" value={String(orders.filter(o=>o.stage==='Delivered').length).padStart(2,'0')} foot="all recorded orders" icon={Truck} tone="green"/></section>
   <section className="overview-grid"><div className="panel chart-panel"><PanelHead title="Sales performance" sub={`Net revenue · ${new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date())}`} action="View reports" click={()=>onPage('reports')}/><div className="chart-summary"><b>{money(monthRevenue)}</b><span className="chart-note">{orders.filter(o=>String(o.invoice_date||o.created_at).slice(0,10).slice(0,7)===today.slice(0,7)&&['Dispatched','Delivered'].includes(o.stage)).length} dispatched invoices this month</span><span className="chart-period">This month</span></div><div className="chart-wrap"><div className="chart-y"><span>{money(max)}</span><span>{money(max*.75)}</span><span>{money(max*.5)}</span><span>{money(max*.25)}</span><span>₹0</span></div><div className="chart-main"><div className="chart-lines"><i/><i/><i/><i/><i/></div><div className="chart-bars">{daySales.map((v,i)=><div className="chart-col" key={i}><div className={`chart-bar ${v<0?'negative':''} ${i===new Date().getDate()-1?'highlight':''}`} style={{height:`${Math.abs(v)/max*100}%`}} title={`${money(v)} net on day ${i+1}`}/></div>)}</div><div className="chart-x"><span>1</span><span>{Math.ceil(daysInMonth*.25)}</span><span>{Math.ceil(daysInMonth*.5)}</span><span>{Math.ceil(daysInMonth*.75)}</span><span>{daysInMonth}</span></div></div></div><div className="chart-legend"><span><i className="legend-dot blue-dot"/>Net sales by invoice date (less dated credits)</span><span className="chart-cost">Estimated gross margin <b>{money(monthRevenue-monthCogs)}</b></span></div></div>
    <div className="panel quick-panel"><PanelHead title="Quick actions" sub="Common tasks, one click away"/><div className="quick-list"><button onClick={onSale}><span className="quick-icon q-blue"><Plus size={17}/></span><span><b>Create a sale</b><small>New customer order</small></span><ChevronRight size={16}/></button><button onClick={()=>onPage('customers')}><span className="quick-icon q-violet"><Users size={17}/></span><span><b>View customers</b><small>{customers.length} active customers</small></span><ChevronRight size={16}/></button><button onClick={()=>onPage('inventory')}><span className="quick-icon q-amber"><Boxes size={17}/></span><span><b>Update stock</b><small>{lowStock.length} products need attention</small></span><ChevronRight size={16}/></button></div><div className="quick-note"><div className="note-avatar">Z</div><span><b>Good business starts with a clear picture.</b><small>Your numbers are up to date.</small></span><Sparkles size={15}/></div></div></section>
   <section className="lower-grid"><div className="panel table-panel"><PanelHead title="Recent orders" sub="Latest customer activity" action="All orders" click={()=>onPage('sales')}/><OrderTable orders={recent} compact onDelete={onDelete} onCancel={onCancel} onReturn={onReturn} canManage={canManage}/></div><div className="panel low-stock-panel"><PanelHead title="Low stock" sub="Items to replenish" action="Manage stock" click={()=>onPage('inventory')}/>{lowStock.length===0?<div className="empty-state"><CheckCircle2 size={22}/><b>Stock levels look good</b><span>No products need attention right now.</span></div>:<div className="stock-alert-list">{lowStock.slice(0,4).map(p=><div className="stock-alert" key={p.id}><div className="product-thumb">{initials(p.name)}</div><div className="stock-alert-main"><b>{p.name}</b><small>{p.sku}</small></div><div className="stock-alert-count"><b>{p.stock}</b><small>left</small></div><div className="stock-meter"><i style={{width:`${Math.min(100,Number(p.stock)/Math.max(1,Number(p.low_stock_at))*100)}%`}}/></div></div>)}</div>}</div></section>
 </>;
}
function OrderTable({orders,compact=false,onDispatch,onCollect,onStage,onDelete,onCancel,onReturn,canManage}) { if(!orders.length)return <div className="empty-state"><ClipboardList size={23}/><b>No orders to show</b><span>Create a sale to start tracking activity.</span></div>; return <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>AMOUNT</th><th>PAYMENT</th><th>STATUS</th><th></th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b className="order-id">{o.id}</b></td><td><div className="customer-cell"><span className="mini-avatar">{initials(o.customer_name)}</span><span>{o.customer_name}</span></div></td><td>{dateLabel(o.created_at)}</td><td className="amount-cell">{money(o.total)}</td><td><PayPill status={o.payment_status} method={o.payment_method}/></td><td><StagePill stage={o.stage}/></td><td><OrderActions order={o} onDispatch={compact?null:onDispatch} onCollect={compact?null:onCollect} onStage={compact?null:onStage} onDelete={onDelete} onCancel={onCancel} onReturn={onReturn} canManage={canManage}/></td></tr>)}</tbody></table></div>; }
function OrderActions({order,onDispatch,onCollect,onStage,onDelete,onCancel,onReturn,canManage}) { const eligible=(['Order Received','Processing'].includes(order.stage)&&order.payment_status==='pending')||order.stage==='Cancelled'; const returnable=['Dispatched','Delivered'].includes(order.stage); return <div className="row-actions">{order.stage==='Order Received'&&onStage&&<button className="tiny-action primary-tiny" onClick={()=>onStage(order,'Processing')}><Package size={13}/>Process</button>}{order.stage==='Processing'&&onDispatch&&<button className="tiny-action primary-tiny" onClick={()=>onDispatch(order)}><Truck size={13}/>Dispatch</button>}{order.stage==='Dispatched'&&onStage&&<button className="tiny-action" onClick={()=>onStage(order,'Delivered')}><Check size={13}/>Delivered</button>}{returnable&&canManage&&onReturn&&<button className="tiny-action" onClick={()=>onReturn(order)}>Return</button>}{!['Order Received','Cancelled'].includes(order.stage)&&order.payment_status!=='paid'&&onCollect&&<button className="tiny-action" onClick={()=>onCollect(order)}><Banknote size={13}/>Collect full</button>}{canManage&&['Order Received','Processing'].includes(order.stage)&&order.payment_status==='pending'&&onCancel&&<button className="tiny-action" onClick={()=>onCancel(order)}>Cancel</button>}{canManage&&eligible&&onDelete&&<button className="tiny-action danger-action" onClick={()=>onDelete(order)}><Trash2 size={13}/>Delete</button>}</div>; }

function Sales({orders,query,setQuery,filter,setFilter,onNew,onDispatch,onCollect,onStage,onDelete,onCancel,onReturn,canManage,busy}) {
  const [page,setPage] = useState(1);
  const pageSize = 20;
  const pageCount = Math.max(1,Math.ceil(orders.length/pageSize));
  const activePage = Math.min(page,pageCount);
  const visibleOrders = orders.slice((activePage-1)*pageSize,activePage*pageSize);
  const firstShown = orders.length ? (activePage-1)*pageSize+1 : 0;
  const lastShown = Math.min(activePage*pageSize,orders.length);
  return <div className="panel full-panel"><div className="list-toolbar"><div className="filter-tabs">{['All orders','Unpaid','Order Received','Processing','Dispatched','Delivered','Cancelled'].map(x=><button key={x} className={filter===x?'selected':''} onClick={()=>{setFilter(x);setPage(1)}}>{x}</button>)}</div><div className="toolbar-right"><label className="table-search"><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Search orders"/></label><button className="button button-primary button-sm" onClick={onNew}><Plus size={15}/>New sale</button></div></div><OrderTable orders={visibleOrders} onDispatch={onDispatch} onCollect={onCollect} onStage={onStage} onDelete={onDelete} onCancel={onCancel} onReturn={onReturn} canManage={canManage}/><div className="table-bottom"><span>Showing <b>{firstShown}–{lastShown}</b> of <b>{orders.length}</b> orders</span><div><button aria-label="Previous page" disabled={activePage<=1} onClick={()=>setPage(activePage-1)}><ChevronLeft size={15}/></button><button className="page-number" aria-current="page">{activePage} / {pageCount}</button><button aria-label="Next page" disabled={activePage>=pageCount} onClick={()=>setPage(activePage+1)}><ChevronRight size={15}/></button></div></div>{busy&&<div className="loading-bar"/>}</div>;
}

function Customers({customers,balance,onAdd,onEdit,onArchive,onRestore,onLedger,onCollect,orders,showArchived,onToggleArchived,canManage}) { return <div className="panel full-panel"><div className="panel-toolbar"><div><h2>{showArchived?'Archived customers':'Customer directory'}</h2><p>Hotel/customer contacts, credit limits, and unpaid invoice balances</p></div><div className="heading-actions"><button className="button button-secondary button-sm" onClick={onToggleArchived}>{showArchived?'Back to active':'Archived customers'}</button>{!showArchived&&canManage&&<button className="button button-primary button-sm" onClick={onAdd}><Plus size={15}/>Add customer</button>}</div></div>{customers.length===0?<div className="empty-state"><Users size={24}/><b>{showArchived?'No archived customers':'No customers found'}</b><span>{showArchived?'Archived customers with history can be restored.':'Add your first customer to get started.'}</span></div>:<div className="customer-cards">{customers.map(c=>{const due=balance(c.id);const dueInvoices=orders.filter(o=>o.customer_id===c.id&&['Dispatched','Delivered'].includes(o.stage)&&o.payment_status==='unpaid');return <div className="customer-card" key={c.id}><div className="customer-card-top"><span className="customer-avatar">{initials(c.name)}</span><div className="row-actions">{showArchived?<button className="tiny-action" onClick={()=>onRestore(c)}><ArchiveRestore size={13}/>Restore</button>:canManage&&<><button className="icon-btn" title="Edit customer" aria-label={`Edit ${c.name}`} onClick={()=>onEdit(c)}><Pencil size={15}/></button><button className="tiny-action danger-action" title="Remove customer" onClick={()=>onArchive(c)}><Trash2 size={13}/>Remove</button></>}</div></div><h3>{c.name}</h3><p>{c.contact_person||'Business customer'}{c.area?` · ${c.area}`:''}{showArchived?' · Archived':''}</p><div className="customer-contact"><span><Activity size={14}/>{c.phone||'No phone added'}</span><span><CreditCard size={14}/>Limit {money(c.credit_limit)}</span></div><div className="customer-balance"><div><small>Outstanding balance</small><b className={due?'balance-due':''}>{money(due)}</b></div><span>{dueInvoices.length} unpaid {dueInvoices.length===1?'invoice':'invoices'}</span></div><button className="collect-button ledger-open" onClick={()=>onLedger(c)}>Open customer ledger <ArrowRight size={14}/></button>{dueInvoices.length>0&&<button className="collect-button" onClick={()=>onCollect(dueInvoices[0])}>Collect invoice in full <ArrowRight size={14}/></button>}</div>})}</div>}</div>; }

function CustomerLedger({customers,orders,payments,returns,onCollect,onCollectInvoices,onDelete,onCancel,onReturn,onVoidReceipt,canManage,customerId,onCustomerChange}) {
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const [selectedInvoices,setSelectedInvoices]=useState([]);
  const customer=customers.find(c=>c.id===customerId);
  const creditOrders=orders.filter(o=>o.customer_id===customerId&&o.payment_method==='credit'&&!['Order Received','Cancelled'].includes(o.stage));
  const pendingOrders=orders.filter(o=>o.customer_id===customerId&&o.payment_method==='credit'&&['Order Received','Processing'].includes(o.stage)&&o.payment_status!=='paid');
  const payableInvoices=creditOrders.filter(o=>o.payment_status==='unpaid');
  const selectedInvoiceOrders=payableInvoices.filter(o=>selectedInvoices.includes(o.db_id||o.id));
  const entries=[];
  for(const order of creditOrders){
    const ref=order.db_id||order.id;
    const orderPayments=payments.filter(p=>(p.order_id===ref||p.order_id===order.id||p.order_id===order.order_no));
    const payment=orderPayments.find(p=>p.status==='posted');
    const invoiceDate=businessDate(order.invoice_date||order.created_at);
      entries.push({key:`invoice-${ref}`,date:invoiceDate,sortAt:order.created_at||invoiceDate,priority:0,order,description:`Credit invoice · ${order.customer_name}`,reference:order.id,debit:Number(order.total),credit:0,payment:null,status:payment?'Paid in full':order.stage});
    for(const receipt of orderPayments){
      const isVoided=receipt.status==='voided';
      const paymentDate=businessDate(isVoided?(receipt.voided_at||receipt.payment_date):(receipt.payment_date||receipt.paid_at));
      entries.push({key:`payment-${receipt.id}-${ref}`,date:paymentDate,sortAt:isVoided?(receipt.voided_at||paymentDate):(receipt.paid_at||paymentDate),priority:isVoided?3:1,order,description:isVoided?`Receipt voided · ${receipt.void_reason||''}`:`Payment received · ${(receipt.method||'cash').toUpperCase()}`,reference:receipt.receipt_no||order.id,debit:isVoided?Number(receipt.amount):0,credit:isVoided?0:Number(receipt.amount),payment:receipt,status:isVoided?'Voided':'Received'});
    }
    for (const creditNote of (returns||[]).filter(row=>row.order_id===ref&&row.status==='posted')) {
      entries.push({key:`credit-note-${creditNote.id}`,date:businessDate(creditNote.return_date),sortAt:creditNote.created_at||creditNote.return_date,priority:2,order,description:`Credit note · ${creditNote.reason}`,reference:creditNote.credit_note_no,debit:0,credit:Number(creditNote.total_credit),payment:null,status:'Return credited'});
    }
  }
  entries.sort((a,b)=>a.date.localeCompare(b.date)||String(a.sortAt).localeCompare(String(b.sortAt))||a.priority-b.priority||a.key.localeCompare(b.key));
  let running=0;
  const balancedEntries=entries.map(entry=>{running+=entry.debit-entry.credit;return {...entry,balance:running};});
  const visible=balancedEntries.filter(e=>(!fromDate||e.date>=fromDate)&&(!toDate||e.date<=toDate));
  const invoices=creditOrders.length;
  const creditSales=creditOrders.reduce((s,o)=>s+Number(o.total),0);
  const receipts=payments.filter(p=>creditOrders.some(o=>p.order_id===(o.db_id||o.id))&&p.status==='posted').reduce((sum,p)=>sum+Number(p.amount||0),0);
  const due=running;
  const pendingAmount=pendingOrders.reduce((s,o)=>s+Number(o.total),0);
  return <><div className="panel full-panel ledger-panel"><div className="panel-toolbar"><div><h2>Customer credit ledger</h2><p>Invoice debits and full payment receipts, in date order. Each customer has a separate balance.</p></div><label className="field-label ledger-customer">Customer<select value={customerId} onChange={e=>onCustomerChange(e.target.value)}><option value="">Choose customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    {!customer?<div className="empty-state"><Users size={24}/><b>Select a customer</b><span>Add a customer before recording credit sales.</span></div>:<>
      <div className="metrics-grid small-metrics ledger-metrics"><Metric label="Outstanding credit" value={money(due)} foot="dispatched unpaid credit invoices" icon={CreditCard} tone="amber"/><Metric label="Credit invoices" value={invoices} foot={`Total credit sales ${money(creditSales)}`} icon={FileText}/><Metric label="Payments received" value={money(receipts)} foot="full invoice payments" icon={Wallet} tone="green"/><Metric label="Awaiting dispatch" value={money(pendingAmount)} foot={`${pendingOrders.length} credit order${pendingOrders.length===1?'':'s'} not invoiced yet`} icon={CalendarDays} tone="violet"/></div>
      <div className="ledger-note"><b>{customer.name}</b><span>Credit limit: {money(customer.credit_limit)} · Available credit including pending orders: {money(Math.max(0,Number(customer.credit_limit||0)-due-pendingAmount))}</span><small>Accepted credit orders awaiting dispatch are shown separately and still count toward the credit limit.</small></div>
      <div className="ledger-toolbar"><div><b>Account activity</b><span>{visible.length} entries · running balance remains based on all dates</span></div><div className="ledger-date-filters"><label>From<input type="date" value={fromDate} max={toDate||today} onChange={e=>setFromDate(e.target.value)}/></label><label>To<input type="date" value={toDate} min={fromDate||undefined} max={today} onChange={e=>setToDate(e.target.value)}/></label><button className="button button-secondary button-sm" onClick={()=>{setFromDate('');setToDate('')}}>Clear dates</button></div></div>
      {payableInvoices.length>1&&<div className="ledger-group-receipt"><span>Select multiple unpaid invoices to settle them together. Each selected invoice is paid in full.</span><button className="button button-primary button-sm" disabled={!selectedInvoiceOrders.length} onClick={()=>onCollectInvoices(selectedInvoiceOrders)}><Banknote size={14}/>Receive {selectedInvoiceOrders.length||''} invoice{selectedInvoiceOrders.length===1?'':'s'} in full</button></div>}
      {visible.length===0?<div className="empty-state compact-empty"><BookOpen size={22}/><b>No credit ledger entries</b><span>{entries.length?'No activity falls in this date range.':'Dispatched credit invoices and their full payments will appear here.'}</span></div>:<div className="table-scroll"><table><thead><tr><th></th><th>DATE</th><th>DETAILS</th><th>INVOICE</th><th>DEBIT · UDHAR</th><th>CREDIT · RECEIVED</th><th>BALANCE DUE</th><th></th></tr></thead><tbody>{visible.map(e=>{const invoiceKey=e.order.db_id||e.order.id;const selectable=e.debit&&!e.payment&&e.order.payment_status==='unpaid';return <tr key={e.key}><td>{selectable&&<input type="checkbox" aria-label={`Select invoice ${e.reference} for grouped full payment`} checked={selectedInvoices.includes(invoiceKey)} onChange={event=>setSelectedInvoices(current=>event.target.checked?[...current,invoiceKey]:current.filter(id=>id!==invoiceKey))}/>}</td><td>{dateLabel(e.date)}</td><td><b>{e.description}</b><small className="ledger-subline">{e.payment?`${e.status} · ${e.payment.receipt_no||'Receipt'}`:`Invoice status · ${e.status}`}</small></td><td><span className="sku-text">{e.reference}</span></td><td className="amount-cell">{e.debit?money(e.debit):'—'}</td><td className="amount-cell">{e.credit?money(e.credit):'—'}</td><td className="amount-cell"><b>{money(e.balance)}</b></td><td>{selectable&&<button className="tiny-action primary-tiny" onClick={()=>onCollect(e.order)}><Banknote size={13}/>Receive full</button>}{canManage&&e.debit&&['Dispatched','Delivered'].includes(e.order.stage)&&<button className="tiny-action" onClick={()=>onReturn(e.order)}><ArchiveRestore size={13}/>Return</button>}{canManage&&e.payment?.status==='posted'&&<button className="tiny-action danger-action" onClick={()=>onVoidReceipt(e.payment)}><Trash2 size={13}/>Void receipt</button>}</td></tr>})}</tbody></table></div>}
      {pendingOrders.length>0&&<div className="panel ledger-pending-panel"><div className="panel-toolbar"><div><h3>Orders awaiting dispatch</h3><p>These are not invoices yet and do not appear in the dated credit ledger balance.</p></div></div><div className="table-scroll"><table><thead><tr><th>ORDER DATE</th><th>ORDER</th><th>VALUE</th><th>STATUS</th><th></th></tr></thead><tbody>{pendingOrders.map(order=><tr key={order.id}><td>{dateLabel(order.created_at)}</td><td><b className="order-id">{order.id}</b></td><td className="amount-cell">{money(order.total)}</td><td><StagePill stage={order.stage}/></td><td><div className="row-actions">{canManage&&<><button className="tiny-action" onClick={()=>onCancel(order)}>Cancel</button><button className="tiny-action danger-action" onClick={()=>onDelete(order)}><Trash2 size={13}/>Delete</button></>}</div></td></tr>)}</tbody></table></div></div>}
    </>}</div></>;
}

function Inventory({products,archivedProducts,showArchived,onToggleArchived,lowStock,stockValue,onAdd,onEdit,onAdjust,onArchive,onRestore,movements,canManage}) {
  const rows=showArchived?archivedProducts:products;
  return <><div className="metrics-grid small-metrics"><Metric label="Finished products" value={products.length} foot="active SKUs" icon={Package}/><Metric label="Units on hand" value={products.reduce((s,p)=>s+Number(p.stock||0),0)} foot="ready for dispatch" icon={Boxes} tone="violet"/><Metric label="Inventory at cost" value={money(stockValue)} foot="based on product cost" icon={Wallet} tone="green"/><Metric label="Low stock items" value={lowStock.length} foot="at or below threshold" icon={TrendingDown} tone="amber"/></div>
    <div className="panel full-panel"><div className="panel-toolbar"><div><h2>{showArchived?'Archived products':'Product catalog'}</h2><p>{showArchived?'Archived products are hidden from sales and inventory totals.':'Finished goods only · Stock updates are recorded in history.'}</p></div><div className="heading-actions"><button className="button button-secondary button-sm" onClick={onToggleArchived}>{showArchived?'Back to active':'Archived products'} <span>{archivedProducts.length}</span></button>{!showArchived&&canManage&&<button className="button button-primary button-sm" onClick={onAdd}><Plus size={15}/>Add product</button>}</div></div>
      <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>SELL PRICE</th><th>UNIT COST</th><th>ON HAND</th><th>{showArchived?'STATUS':'STOCK STATUS'}</th><th></th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><div className="product-cell"><div className="product-thumb">{initials(p.name)}</div><b>{p.name}</b></div></td><td><span className="sku-text">{p.sku}</span></td><td className="amount-cell">{money(p.price)}</td><td>{money(p.unit_cost)}</td><td><b>{p.stock}</b> <span className="muted-text">{p.unit||'units'}</span></td><td>{showArchived?<span className="stock-tag low"><i/>Archived</span>:Number(p.stock)<=Number(p.low_stock_at)?<span className="stock-tag low"><i/>Low stock</span>:<span className="stock-tag healthy"><i/>In stock</span>}</td><td><div className="row-actions">{showArchived?canManage&&<button className="tiny-action" onClick={()=>onRestore(p)}><ArchiveRestore size={13}/>Restore</button>:<>{canManage&&<button className="tiny-action" onClick={()=>onEdit(p)}><Pencil size={13}/>Edit</button>}<button className="tiny-action" onClick={()=>onAdjust(p)}><SlidersHorizontal size={13}/>Stock</button>{canManage&&<button className="tiny-action danger-action" onClick={()=>onArchive(p)}><Trash2 size={13}/>Remove</button>}</>}</div></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state compact-empty">{showArchived?'No archived products match your search.':'No products match your search. Add a product to start tracking finished goods.'}</div>}</div>
    </div>
    {!showArchived&&<div className="panel full-panel movement-panel"><PanelHead title="Recent stock changes" sub="Every adjustment and dispatch is recorded"/>{movements.length===0?<div className="empty-state compact-empty">No stock changes recorded yet.</div>:<div className="movement-list">{movements.slice(0,6).map(m=><div className="movement-row" key={m.id}><span className={`movement-icon ${Number(m.quantity)>0?'positive':'negative'}`}>{Number(m.quantity)>0?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><b>{m.product_name||products.find(p=>p.id===m.product_id)?.name||'Product'}</b><small>{m.reason||'Stock adjustment'} · {dateLabel(m.movement_date||m.created_at)}</small></div><strong className={Number(m.quantity)>0?'text-green':'text-red'}>{Number(m.quantity)>0?'+':''}{m.quantity}</strong><time>{dateLabel(m.movement_date||m.created_at)}</time></div>)}</div>}</div>}
  </>;
}

function CashFlow({receipts,expenses,customers,orders,openBalance,onCollect,onOpenLedger,onVoidReceipt,onVoidExpense,onDeleteExpense,canManage}) {
  const [from,setFrom]=useState('');
  const [to,setTo]=useState(today);
  const dateKey=businessDate;
  const rows=useMemo(()=>buildCashFlowRows({receipts,expenses,customers,from,to,dateKey}),[receipts,expenses,customers,from,to]);
  const {inflow,outflow}=summarizeCashFlowRows(rows);
  const creditInvoices=useMemo(()=>buildCreditInvoiceRows({orders,openBalance,from,to,dateKey}),[orders,openBalance,from,to]);
  const creditAging=summarizeCreditAging(creditInvoices,today);
  const exportRows=rows.map(({date,kind,description,method,inflow:cashIn,outflow:cashOut,status,reason})=>({date,type:kind,description,method,inflow:cashIn,outflow:cashOut,status,reason:reason||''}));
  return <>
    <div className="metrics-grid small-metrics"><Metric label="Cash received" value={money(inflow)} foot="receipts less reversals in range" icon={ArrowDownLeft} tone="green"/><Metric label="Cash paid out" value={money(outflow)} foot="expenses less reversals in range" icon={ArrowUpRight} tone="amber"/><Metric label="Net cash movement" value={money(inflow-outflow)} foot="movement only; no opening balance" icon={Wallet} tone="violet"/><Metric label="Entries" value={rows.length} foot="dated receipts, expenses and reversals" icon={CalendarDays}/></div>
    <div className="panel full-panel cashflow-panel"><div className="panel-toolbar"><div><h2>Payment & cash-flow history</h2><p>Receipts are counted once per receipt, even when one hotel payment settles several invoices. Reversals appear on their void date.</p></div><div className="cashflow-actions">{rows.length>0&&<button className="button button-secondary button-sm" onClick={()=>download(toCsv(exportRows),'zelvo-cash-flow.csv')}><Download size={14}/>Export CSV</button>}</div></div>
      <div className="cashflow-filters"><label className="field-label">From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field-label">To date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="button button-secondary button-sm" onClick={()=>{setFrom('');setTo(today)}}>Reset dates</button><span>{rows.length} cash-flow {rows.length===1?'entry':'entries'}</span></div>
      {rows.length===0?<div className="empty-state"><Banknote size={24}/><b>No cash-flow entries in this date range</b><span>Receipts and expenses will appear here with their recorded dates.</span></div>:<div className="table-scroll"><table><thead><tr><th>DATE</th><th>TYPE / DESCRIPTION</th><th>METHOD</th><th>CASH IN</th><th>CASH OUT</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td><time dateTime={row.date}>{dateLabel(row.date)}</time></td><td><b>{row.description}</b>{row.reason&&<small className="ledger-subline">Reason: {row.reason}</small>}</td><td><span className="category-tag">{row.method}</span></td><td className="amount-cell text-green">{row.inflow?money(row.inflow):'—'}</td><td className="amount-cell text-red">{row.outflow?money(row.outflow):'—'}</td><td><span className={`cashflow-status ${row.status==='Posted'?'posted':''}`}>{row.status}</span></td><td>{canManage&&row.receipt?.status==='posted'&&<button className="tiny-action danger-action" onClick={()=>onVoidReceipt({id:row.receipt.id,receipt_no:row.receipt.receipt_no,status:row.receipt.status})}><Trash2 size={13}/>Void</button>}{canManage&&row.expense?.status==='posted'&&<button className="tiny-action danger-action" onClick={()=>onVoidExpense(row.expense)}><Trash2 size={13}/>Void</button>}{canManage&&row.expense&&<button className="tiny-action danger-action" onClick={()=>onDeleteExpense(row.expense)}><Trash2 size={13}/>Delete</button>}</td></tr>)}</tbody></table></div>}
      <p className="cashflow-note">This report shows money movements from recorded receipts and expenses. It does not include an opening cash/bank balance, transfers between accounts, owner withdrawals, or bank reconciliation.</p>
    </div>
    <div className="panel full-panel credit-management-panel"><div className="panel-toolbar"><div><h2>Credit management · Udhar to collect</h2><p>Unpaid dispatched credit invoices, aged from invoice date. No due date or partial collection is assumed.</p></div><button className="button button-secondary button-sm" onClick={()=>onOpenLedger('')}><BookOpen size={14}/>Open full customer ledger</button></div>
      <div className="credit-aging-grid"><div><span>Outstanding credit</span><b>{money(creditAging.total)}</b></div><div><span>0–30 days</span><b>{money(creditAging.current)}</b></div><div><span>31–60 days</span><b>{money(creditAging.days31to60)}</b></div><div><span>Over 60 days</span><b>{money(creditAging.over60)}</b></div></div>
      {creditInvoices.length===0?<div className="empty-state"><CreditCard size={23}/><b>No outstanding credit invoices for these dates</b><span>Credit invoices will appear here after they are dispatched.</span></div>:<div className="table-scroll"><table><thead><tr><th>INVOICE DATE</th><th>HOTEL / CUSTOMER</th><th>INVOICE</th><th>AGE</th><th>AMOUNT DUE</th><th></th></tr></thead><tbody>{creditInvoices.map(({order,balance,date})=><tr key={order.db_id||order.id}><td>{dateLabel(date)}</td><td><b>{order.customer_name||customers.find(c=>c.id===order.customer_id)?.name||'Customer'}</b></td><td><span className="sku-text">{order.id}</span></td><td>{invoiceAgeDays(date,today)} days</td><td className="amount-cell"><b>{money(balance)}</b></td><td className="credit-row-actions"><button className="tiny-action primary-tiny" onClick={()=>onCollect(order)}><Banknote size={13}/>Receive full</button><button className="tiny-action" onClick={()=>onOpenLedger(order.customer_id)}><BookOpen size={13}/>Ledger</button></td></tr>)}</tbody></table></div>}
      <p className="cashflow-note">Choose Ledger to review the customer’s dated history and select several full invoices for one grouped hotel receipt. Every invoice remains fully payable; partial settlements are disabled.</p>
    </div>
  </>;
}

function BackupReset({data,isOwner,connected,busy,onReset}) {
  const [backupReady,setBackupReady]=useState(false);
  const [backupSummary,setBackupSummary]=useState(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [phrase,setPhrase]=useState('');
  const [working,setWorking]=useState(false);
  const businessCounts={
    Customers:(data.customers||[]).length,
    Products:(data.products||[]).length,
    Orders:(data.orders||[]).length,
    Receipts:(data.receipts||[]).length,
    Returns:(data.returns||[]).length,
    Expenses:(data.expenses||[]).length,
    'Stock movements':(data.movements||[]).length,
    Notes:(data.notes||[]).length,
  };
  const totalRows=Object.values(businessCounts).reduce((sum,count)=>sum+count,0);
  const makeBackup=async()=>{
    setWorking(true);
    try{
      let backup;
      if(supabase){
        if(!connected)throw new Error('Reconnect to the shared workspace before downloading a reset backup.');
        const {data:exported,error}=await supabase.rpc('export_business_data',{p_org_id:orgId});
        if(error)throw error;
        backup=exported;
      }else{
        backup={format:'zelvo-workspace-backup-preview-v2',generated_at:new Date().toISOString(),...data};
      }
      if(!backup||typeof backup!=='object')throw new Error('Backup export returned no data. Nothing was reset.');
      if(supabase&&backup.format!=='zelvo-workspace-backup-v2')throw new Error('The live backup format was not recognized. Nothing was reset.');
      download(JSON.stringify(backup,null,2),`zelvo-full-backup-${today}.json`,'application/json');
      setBackupSummary({invoices:(backup.sales_orders||[]).reduce((sum,row)=>sum+Number(row.total||0),0),receipts:(backup.receipts||[]).filter(row=>row.status==='posted').reduce((sum,row)=>sum+Number(row.total||0),0),expenses:(backup.expenses||[]).filter(row=>row.status==='posted').reduce((sum,row)=>sum+Number(row.amount||0),0),creditNotes:(backup.order_returns||[]).filter(row=>row.status==='posted').reduce((sum,row)=>sum+Number(row.total_credit||0),0),auditWatermark:(backup.audit_events||[]).reduce((max,row)=>Math.max(max,Number(row.id)||0),0)});
      setBackupReady(true);setAcknowledged(false);setPhrase('');
    }catch(error){window.alert(error.message||'Could not create the backup. Nothing was reset.');}
    finally{setWorking(false);}
  };
  const reset=async()=>{
    if(!backupReady||!acknowledged||phrase!=='RESET ZELVO DATA'||!isOwner||!connected||busy)return;
    setWorking(true);
    const complete=await onReset(backupSummary?.auditWatermark??0);
    setWorking(false);
    if(complete){setBackupReady(false);setBackupSummary(null);setAcknowledged(false);setPhrase('');}
  };
  return <div className="backup-reset-layout">
    <section className="panel backup-panel"><div className="backup-panel-head"><div className="backup-icon"><Download size={18}/></div><div><h2>Full business backup</h2><p>Export a consistent snapshot directly from the shared database.</p></div></div>
      <div className="backup-count-grid">{Object.entries(businessCounts).map(([label,count])=><div key={label}><span>{label}</span><b>{count}</b></div>)}</div>
      {backupSummary&&<div className="backup-money-summary"><div><span>Invoice total in backup</span><b>{money(backupSummary.invoices)}</b></div><div><span>Posted receipts</span><b>{money(backupSummary.receipts)}</b></div><div><span>Posted expenses</span><b>{money(backupSummary.expenses)}</b></div><div><span>Posted credit notes</span><b>{money(backupSummary.creditNotes)}</b></div></div>}
      <div className="backup-includes"><b>Included in the downloadable file</b><p>Customers, finished products and stock, sales invoices and line items, receipts and allocations, returns and credit notes, stock movements, expenses, notes, bill settings, and the current audit history.</p><p>Login accounts and workspace membership are not exported. Keep the downloaded JSON file somewhere private and secure; it contains customer and financial information.</p></div>
      <button className="button button-primary" onClick={makeBackup} disabled={working||busy}><Download size={15}/>{working?'Preparing backup…':'Download full backup'}</button>
      {backupReady&&<div className="backup-success"><CheckCircle2 size={16}/>Backup file generated. Save it in a secure location before continuing.</div>}
    </section>
    <section className="panel reset-panel"><div className="backup-panel-head"><div className="reset-icon"><ArchiveRestore size={18}/></div><div><h2>Reset business records</h2><p>Permanently clear operational records from this Zelvo workspace.</p></div></div>
      <div className="reset-warning"><b>This action cannot be undone from the app.</b><p>It removes customers, products and stock history, orders, invoices, payment receipts, receipt allocations, returns, expenses, and notes. Workspace settings, sign-in accounts, and memberships stay in place. Old audit entries are cleared; the reset itself is recorded in a new audit entry.</p></div>
      <div className="reset-readiness"><span>Records currently loaded</span><b>{totalRows}</b><small>{connected?'Connected to shared Supabase data':'Connect and sign in to the live workspace before resetting.'}</small></div>
      {!isOwner&&<div className="form-error">Only the workspace owner can reset shared data.</div>}
      <label className="reset-ack"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} disabled={!backupReady||!isOwner||!connected}/><span>I downloaded the full backup and saved it somewhere secure.</span></label>
      <label className="field-label reset-phrase">Type <code>RESET ZELVO DATA</code> to confirm<input value={phrase} onChange={e=>setPhrase(e.target.value)} autoComplete="off" spellCheck="false" placeholder="RESET ZELVO DATA" disabled={!backupReady||!isOwner||!connected}/></label>
      <button className="button button-danger" onClick={reset} disabled={!backupReady||!acknowledged||phrase!=='RESET ZELVO DATA'||!isOwner||!connected||busy||working}><ArchiveRestore size={15}/>{working||busy?'Resetting…':'Reset all business data'}</button>
      {!backupReady&&<small className="reset-hint">Download the full backup above to enable the reset confirmation.</small>}
    </section>
  </div>;
}

function Expenses({expenses,total,onAdd,onVoid,onDelete,canManage}) {
  const [showHistory,setShowHistory]=useState(false);
  const visible=showHistory?expenses:expenses.filter(expense=>expense.status!=='voided');
  const posted=expenses.filter(expense=>expense.status!=='voided');
  return <><div className="metrics-grid small-metrics"><Metric label="Posted expenses" value={posted.length} foot="all time entries" icon={FileText}/><Metric label="Total expenses" value={money(total)} foot="posted operating costs" icon={Wallet} tone="amber"/><Metric label="This month" value={money(posted.filter(e=>String(e.expense_date).slice(0,7)===today.slice(0,7)).reduce((s,e)=>s+Number(e.amount),0))} foot={currentMonthLabel} icon={CalendarDays} tone="violet"/><Metric label="Categories" value={new Set(posted.map(e=>e.category)).size} foot="in use" icon={BriefcaseBusiness} tone="green"/></div>
  <div className="panel full-panel"><div className="panel-toolbar"><div><h2>{showHistory?'Expense history':'Active expenses'}</h2><p>Void incorrect entries to reverse them, or delete an expense with an audited snapshot.</p></div><div className="heading-actions"><button className="button button-secondary button-sm" onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Active only':'Show voided history'}</button>{canManage&&<button className="button button-primary button-sm" onClick={onAdd}><Plus size={15}/>Add expense</button>}</div></div>
    {visible.length===0?<div className="empty-state"><Wallet size={24}/><b>{showHistory?'No expenses in this history.':'No active expenses yet.'}</b><span>Add operating expenses to track your costs.</span></div>:<div className="table-scroll"><table><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th>PAYMENT METHOD</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>{visible.map(e=><tr key={e.id}><td><b>{e.title}</b>{e.void_reason&&<small className="ledger-subline">{e.void_reason}</small>}</td><td><span className="category-tag">{e.category}</span></td><td>{dateLabel(e.expense_date)}</td><td>{(e.payment_method||'UPI').toUpperCase()}</td><td className="amount-cell">{money(e.amount)}</td><td>{e.status==='voided'?'Voided':'Posted'}</td><td><div className="row-actions">{canManage&&e.status==='posted'&&<button className="tiny-action" onClick={()=>onVoid(e)}><ArchiveRestore size={13}/>Void</button>}{canManage&&<button className="tiny-action danger-action" onClick={()=>onDelete(e)}><Trash2 size={13}/>Delete</button>}</div></td></tr>)}</tbody></table></div>}
  </div></>;
}
function Reports({orders,expenses,products,outstanding,revenue,cogs,expenseTotal,onPage}) {
  const margin=revenue-cogs;
  const invoiced=orders.filter(order=>['Dispatched','Delivered'].includes(order.stage)).length;
  return <><div className="metrics-grid"><Metric label="Net revenue this month" value={money(revenue)} foot="invoices less dated credit notes" icon={TrendingUp}/><Metric label="Cost of goods sold" value={money(cogs)} foot="net of saleable returns" icon={Boxes} tone="violet"/><Metric label="Operating expenses" value={money(expenseTotal)} foot={currentMonthLabel} icon={Wallet} tone="amber"/><Metric label="Unpaid invoices" value={money(outstanding)} foot="full invoice balances" icon={CreditCard} tone="green"/></div><div className="reports-grid"><div className="panel report-panel"><PanelHead title="Monthly summary" sub="Invoice date and return date basis · current month"/><div className="report-lines"><div><span>Net sales revenue</span><b>{money(revenue)}</b></div><div><span>Cost of goods sold</span><b>− {money(cogs)}</b></div><div className="report-subtotal"><span>Gross profit</span><b>{money(margin)}</b></div><div><span>Operating expenses</span><b>− {money(expenseTotal)}</b></div><div className="report-total"><span>Estimated net operating profit</span><b>{money(margin-expenseTotal)}</b></div></div><p className="report-disclaimer">Returns reduce revenue on the credit-note date. Cost of goods is reversed only for returned units marked saleable and restocked. This estimate excludes tax, owner withdrawals, and other accounting adjustments.</p></div><div className="panel report-panel"><PanelHead title="At a glance" sub="Business activity and stock"/><div className="report-lines"><div><span>Total orders</span><b>{orders.length}</b></div><div><span>Dispatched / delivered</span><b>{invoiced}</b></div><div><span>Customers with orders</span><b>{new Set(orders.map(o=>o.customer_id)).size}</b></div><div><span>Active products</span><b>{products.length}</b></div><div className="report-subtotal"><span>Units on hand</span><b>{products.reduce((s,p)=>s+Number(p.stock||0),0)}</b></div></div><button className="button button-secondary full-button export-report" onClick={()=>download(toCsv(orders),'zelvo-orders.csv')}><Download size={15}/>Export orders CSV</button><button className="button button-secondary full-button export-report" onClick={()=>onPage('backup')}><ArchiveRestore size={15}/>Full backup & reset</button></div></div></>;
}
function BillStudio({orders,customers,settings,selectedId,setSelectedId,onSave,onReturn,canManage}) {
  const [draft,setDraft]=useState(settings);
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{ if(!dirty) setDraft(settings); },[settings,dirty]);
  const invoices=orders.filter(o=>o.stage==='Dispatched'||o.stage==='Delivered');
  const order=invoices.find(o=>o.id===selectedId)||invoices[0];
  const customer=order?customers.find(c=>c.id===order.customer_id):null;
  const change=(key,value)=>{setDraft(current=>({...current,[key]:value}));setDirty(true);};
  const save=async()=>{await onSave(draft);setDirty(false);};
  const subtotal=order?(order.items||[]).reduce((sum,item)=>sum+Number(item.line_total??item.total??(Number(item.unit_price||item.price)*Number(item.qty))),0):0;
  return <div className="bill-studio">
    <section className="panel bill-settings-panel">
      <div className="panel-toolbar"><div><h2>Bill setup</h2><p>Customize how your customer bills look</p></div><SlidersHorizontal size={17} className="bill-toolbar-icon"/></div>
      <fieldset className="bill-settings-fieldset" disabled={!canManage}><div className="bill-settings-body">
        <label className="bill-field">Choose dispatched order<select value={order?.id||''} onChange={e=>setSelectedId(e.target.value)}><option value="">Select an order</option>{invoices.map(o=><option key={o.id} value={o.id}>{o.id} · {o.customer_name} · {money(o.total)}</option>)}</select></label>
        {order&&<div className="bill-order-correction"><span>This is a posted invoice. Correct it with a dated item return and credit note.</span>{canManage&&<button className="tiny-action" onClick={()=>onReturn(order)}><ArchiveRestore size={13}/>Record return</button>}</div>}
        <div className="bill-fields-grid">
          <label className="bill-field span-two">Business name<input value={draft.business_name||''} onChange={e=>change('business_name',e.target.value)}/></label>
          <label className="bill-field span-two">Business address<input value={draft.business_address||''} onChange={e=>change('business_address',e.target.value)} placeholder="Street, area, city, state"/></label>
          <label className="bill-field">Phone<input value={draft.business_phone||''} onChange={e=>change('business_phone',e.target.value)} placeholder="Business phone"/></label>
          <label className="bill-field">Email<input type="email" value={draft.business_email||''} onChange={e=>change('business_email',e.target.value)} placeholder="Optional"/></label>
          <label className="bill-field span-two">Tax ID / GSTIN (optional)<input value={draft.tax_id||''} onChange={e=>change('tax_id',e.target.value)} placeholder="Shown as entered; no tax is calculated"/></label>
          <label className="bill-field">UPI ID<input value={draft.upi_id||''} onChange={e=>change('upi_id',e.target.value)} placeholder="name@bank"/></label>
          <label className="bill-field color-field">Bill accent color<input type="color" value={draft.accent_color||'#168bd2'} onChange={e=>change('accent_color',e.target.value)}/></label>
          <label className="bill-field span-two">Payment / footer note<textarea rows="2" value={draft.footer_note||''} onChange={e=>change('footer_note',e.target.value)} placeholder="Thank you for your business."/></label>
          <label className="bill-field span-two">Terms and notes<textarea rows="3" value={draft.terms||''} onChange={e=>change('terms',e.target.value)} placeholder="Payment terms or customer note"/></label>
        </div>
        <label className="bill-checkbox"><input type="checkbox" checked={draft.show_logo!==false} onChange={e=>change('show_logo',e.target.checked)}/>Show Zelvo logo</label>
        <button className="button button-primary bill-save" onClick={save} disabled={!dirty}><Check size={15}/>{dirty?'Save bill settings':'Settings saved'}</button>
        <p className="bill-settings-note">{canManage?'Settings are shared with your team when Supabase is connected. Tax is not calculated by this bill generator.':'Only an owner or manager can change shared bill settings.'}</p>
      </div></fieldset>
    </section>
    <section className="bill-preview-column">
      <div className="bill-preview-toolbar"><div><b>Live preview</b><span>Print or save as PDF</span></div><button className="button button-primary" onClick={()=>window.print()} disabled={!order}><FileText size={15}/>Print / Save PDF</button></div>
      {order?<article className="invoice-paper bill-print-area" style={{'--bill-accent':draft.accent_color||'#168bd2'}}>
        <div className="invoice-topline"/>
        <header className="invoice-brand-row"><div className="invoice-business"><div className="invoice-logo-wrap">{draft.show_logo!==false&&<img src="/zelvo-wordmark.jpg" alt="Zelvo Cleaning Solutions"/>}</div><div><h2>{draft.business_name||'Business name'}</h2><p>{draft.business_address||''}</p>{draft.business_phone&&<p>Phone: {draft.business_phone}</p>}{draft.business_email&&<p>{draft.business_email}</p>}{draft.tax_id&&<p>Tax ID / GSTIN: {draft.tax_id}</p>}</div></div><div className="invoice-title"><span>SALES BILL</span><h1>INVOICE</h1><b>{order.id}</b><small>{dateLabel(order.created_at)}</small></div></header>
        <div className="invoice-rule"/>
        <section className="invoice-parties"><div><small>BILLED TO</small><h3>{order.customer_name}</h3>{customer?.contact_person&&<p>Attn: {customer.contact_person}</p>}{customer?.area&&<p>{customer.area}</p>}{customer?.phone&&<p>Phone: {customer.phone}</p>}</div><div className="invoice-meta"><div><small>ORDER DATE</small><b>{dateLabel(order.created_at)}</b></div><div><small>FULFILMENT</small><b>{order.stage}</b></div><div><small>PAYMENT</small><b>{order.payment_status==='paid'?'Paid in full':'Credit · due in full'}</b></div></div></section>
        <table className="invoice-lines"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>{(order.items||[]).map((item,i)=><tr key={item.id||`${item.product_id}-${i}`}><td>{item.product_name||item.name}</td><td>{item.qty}</td><td>{money(item.unit_price??item.price)}</td><td>{money(item.line_total??item.total??Number(item.unit_price??item.price)*Number(item.qty))}</td></tr>)}</tbody></table>
        <div className="invoice-total-area"><div className="invoice-total-card"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="invoice-grand"><span>Invoice total</span><b>{money(order.total)}</b></div><div className="invoice-payment-status"><span>Payment status</span><b>{order.payment_status==='paid'?'PAID IN FULL':'CREDIT · FULL BALANCE DUE'}</b></div></div></div>
        {draft.upi_id&&<div className="invoice-upi"><span>PAYMENT DETAILS</span><b>UPI: {draft.upi_id}</b></div>}
        {draft.terms&&<div className="invoice-terms"><b>Notes & terms</b><p>{draft.terms}</p></div>}
        <footer className="invoice-footer"><b>{draft.footer_note||'Thank you for your business.'}</b><span>Generated by Zelvo Cleaning Solutions</span></footer>
      </article>:<div className="panel bill-empty"><FileText size={28}/><b>No dispatched orders to bill yet</b><span>Create a sale, then dispatch it. The bill will use that saved order and total.</span></div>}
    </section>
  </div>;
}

function StockAdjustmentModal({product,form,setForm,onClose,onSave,busy}) {
  const projected=Number(product.stock)+(Number(form.quantity)||0);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-header"><div><div className="eyebrow">FINISHED GOODS STOCK</div><h2>Change stock</h2><p>{product.name} · Current stock: {product.stock} {product.unit||'units'}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="modal-body"><label className="field-label">Quantity change<input autoFocus type="number" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Example: 12 to add, -2 to remove"/></label><p className="bill-settings-note">Use a positive number to add stock or a negative number to remove it. Stock cannot go below zero. Projected stock: <b>{projected}</b>.</p><label className="field-label">Date<input required type="date" value={form.movement_date} max={today} onChange={e=>setForm({...form,movement_date:e.target.value})}/></label><label className="field-label">Reason (optional)<input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Add a note if helpful"/></label></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy||!form.movement_date||!Number.isInteger(Number(form.quantity))||Number(form.quantity)===0||projected<0} onClick={onSave}><Check size={15}/>Save stock change</button></div></div></div>;
}

function ArchiveProductModal({product,onClose,onConfirm,busy}) {
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-header"><div><div className="eyebrow">REMOVE FROM ACTIVE INVENTORY</div><h2>Remove {product.name}?</h2><p>This hides the product from new sales and active inventory.</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="modal-body"><p className="bill-settings-note">Past orders and stock history are kept. You can restore this product from <b>Archived products</b>.</p></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary danger-button" disabled={busy} onClick={onConfirm}><Trash2 size={15}/>Remove product</button></div></div></div>;
}

function ReturnModal({order,returns,onClose,onSave,busy}) {
  const orderRef=order.db_id||order.id;
  const lines=(order.items||[]).map(line=>{
    const previous=(returns||[]).filter(row=>row.order_id===orderRef&&row.status==='posted').flatMap(row=>row.items||[]).filter(item=>item.order_item_id===line.id).reduce((sum,item)=>sum+Number(item.quantity),0);
    return {...line,order_item_id:line.id,previous,remaining:Math.max(0,Number(line.qty)-previous)};
  });
  const [draft,setDraft]=useState({return_date:today,reason:'',items:lines.map(line=>({order_item_id:line.order_item_id,quantity:'',restock:false}))});
  const setLine=(idx,key,value)=>setDraft(current=>({...current,items:current.items.map((item,index)=>index===idx?{...item,[key]:value}:item)}));
  const total=draft.items.reduce((sum,item)=>{const line=lines.find(row=>row.order_item_id===item.order_item_id);return sum+Number(item.quantity||0)*Number(line?.unit_price||0);},0);
  const hasItems=draft.items.some(item=>Number(item.quantity)>0);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal return-modal"><div className="modal-header"><div><div className="eyebrow">RETURN & CREDIT NOTE</div><h2>Record returned items</h2><p>{order.id} · {order.customer_name}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="modal-body"><label className="field-label">Return date<input required type="date" min={businessDate(order.invoice_date||order.created_at)} max={today} value={draft.return_date} onChange={e=>setDraft({...draft,return_date:e.target.value})}/></label><label className="field-label">Reason<input required value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})} placeholder="Why is this item being returned?"/></label><div className="return-lines">{lines.map((line,index)=><div className="return-line" key={line.order_item_id}><div className="return-line-title"><b>{line.product_name||line.name}</b><small>{line.remaining} of {line.qty} units available to return</small></div><input type="number" min="0" max={line.remaining} step="1" value={draft.items[index]?.quantity||''} disabled={!line.remaining} onChange={e=>setLine(index,'quantity',e.target.value)} aria-label={`Returned quantity for ${line.product_name||line.name}`}/><label><input type="checkbox" checked={draft.items[index]?.restock||false} disabled={Number(draft.items[index]?.quantity||0)<=0} onChange={e=>setLine(index,'restock',e.target.checked)}/>Saleable · restock</label></div>)}</div><div className="sale-total"><span>Credit note amount</span><b>{money(total)}</b></div><p className="bill-settings-note">Only quantities marked saleable go back into stock. The invoice itself remains in history.</p></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy||!draft.return_date||draft.return_date<businessDate(order.invoice_date||order.created_at)||draft.return_date>today||!draft.reason.trim()||!hasItems} onClick={()=>onSave(draft)}><Check size={15}/>Post return & credit note</button></div></div></div>;
}
function PaymentModal({orders,dueAmounts,method,setMethod,paymentDate,setPaymentDate,onClose,onConfirm,busy}) { const invoiceDate=orders.map(order=>businessDate(order.invoice_date||order.created_at)).sort().at(-1); const total=dueAmounts.reduce((sum,amount)=>sum+Number(amount||0),0); const customerName=orders[0]?.customer_name||''; return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-header"><div><div className="eyebrow">FULL PAYMENT ONLY</div><h2>{orders.length>1?'Record grouped receipt':'Record invoice payment'}</h2><p>{orders.length>1?`${orders.length} invoices · ${customerName}`:`${orders[0]?.id} · ${customerName}`}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="modal-body"><div className="sale-total"><span>{orders.length>1?'Total for full invoice settlement':'Full amount due'}</span><b>{money(total)}</b></div>{orders.length>1&&<div className="bill-settings-note">{orders.map((order,index)=><div key={order.db_id||order.id}>{order.id} · {money(dueAmounts[index])}</div>)}</div>}<label className="field-label" style={{marginTop:16}}>Payment date<input required type="date" min={invoiceDate} max={today} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label><label className="field-label">Payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label><p className="bill-settings-note">Every selected invoice is settled in full. Partial payments are not supported.</p></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy||!paymentDate||paymentDate<invoiceDate||paymentDate>today||total<=0} onClick={onConfirm}><Check size={15}/>{orders.length>1?'Record grouped receipt':'Record full payment'}</button></div></div></div>; }

function SaleModal({customers,products,sale,setSale,onClose,onSubmit,busy,balance}) { const total=sale.items.reduce((s,i)=>{const p=products.find(x=>x.id===i.product_id);return s+Number(p?.price||0)*Number(i.qty||0)},0); const customer=customers.find(c=>c.id===sale.customer_id); const due=customer?balance(customer.id):0; const selectProduct=(id)=>setSale({...sale,items:[...sale.items,{product_id:id,qty:1}]}); const change=(idx,key,value)=>setSale({...sale,items:sale.items.map((i,n)=>n===idx?{...i,[key]:value}:i)}); return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal sale-modal"><div className="modal-header"><div><div className="eyebrow">NEW TRANSACTION</div><h2>Create a sale</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><div className="modal-body"><label className="field-label">Customer<select value={sale.customer_id} onChange={e=>setSale({...sale,customer_id:e.target.value})}><option value="">Choose a customer</option>{customers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{customer&&<div className="credit-info"><span>Outstanding + open credit orders</span><b>{money(due)}</b><span>Credit limit</span><b>{money(customer.credit_limit)}</b></div>}<div className="modal-section-title"><b>Products</b><span>{sale.items.length} items</span></div>{sale.items.map((item,idx)=>{const p=products.find(x=>x.id===item.product_id);return <div className="sale-item-row" key={`${item.product_id}-${idx}`}><select value={item.product_id} onChange={e=>change(idx,'product_id',e.target.value)}>{products.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><span>{money(p?.price)}</span><input type="number" min="1" step="1" value={item.qty} onChange={e=>change(idx,'qty',e.target.value)} aria-label="Quantity"/><button className="icon-btn" onClick={()=>setSale({...sale,items:sale.items.filter((_,n)=>n!==idx)})}><X size={15}/></button></div>})}<button className="add-line-button" onClick={()=>selectProduct(products[0]?.id)} disabled={!products.length}><Plus size={14}/>Add product</button><div className="modal-section-title payment-title"><b>Payment option</b><span>Partial payment is disabled</span></div><div className="payment-options"><button className={sale.payment_method==='cash'?'chosen':''} onClick={()=>setSale({...sale,payment_method:'cash'})}><Banknote size={16}/><span><b>Paid in full</b><small>Cash at dispatch</small></span>{sale.payment_method==='cash'&&<CheckCircle2 size={16}/>}</button><button className={sale.payment_method==='credit'?'chosen':''} onClick={()=>setSale({...sale,payment_method:'credit'})}><CreditCard size={16}/><span><b>Credit sale</b><small>Collect the full invoice later</small></span>{sale.payment_method==='credit'&&<CheckCircle2 size={16}/>}</button></div><div className="sale-total"><span>Invoice total</span><b>{money(total)}</b></div></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy||!sale.items.length||!sale.customer_id} onClick={onSubmit}>Create order <ArrowRight size={15}/></button></div></div></div>; }

function RecordModal({type,form,setForm,onClose,onSave,editing,busy}) {
  const configs={
    customer:{title:'Customer',intro:'Customer details and credit limit.',fields:[['name','Business name','text',true],['contact_person','Contact person','text'],['phone','Phone number','tel'],['area','Area / address','text'],['credit_limit','Credit limit (₹)','number']]},
    product:{title:'Product',intro:'Finished goods catalog. Edit stock separately using Stock.',fields:[['name','Product name','text',true],['sku','SKU','text',true],['unit','Selling unit','text'],['price','Selling price (₹)','number',true],['unit_cost','Unit cost (₹)','number',true],['stock','Opening stock','number',true],['stock_date','Opening stock date','date'],['low_stock_at','Low stock alert at','number']]},
    expense:{title:'Expense',intro:'Record an operating cost for your reports.',fields:[['title','Description','text',true],['category','Category','text',true],['amount','Amount (₹)','number',true],['expense_date','Date','date',true],['payment_method','Payment method','select',true]]}
  };
  const config=configs[type];
  const fields=editing&&type==='product'?config.fields.filter(([key])=>!['stock','stock_date'].includes(key)):type==='product'&&Number(form.stock||0)<=0?config.fields.filter(([key])=>key!=='stock_date'):config.fields;
  const label=editing?'Edit':'Add';
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal record-modal"><div className="modal-header"><div><div className="eyebrow">ZELVO WORKSPACE</div><h2>{label} {config.title.toLowerCase()}</h2><p>{config.intro}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="modal-body form-grid">{fields.map(([key,fieldLabel,kind,required])=><label className="field-label" key={key}>{fieldLabel}{kind==='select'?<select required={required} value={form[key]||'upi'} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option></select>:<input required={required} type={kind} min={kind==='number'?'0':undefined} step={kind==='number'?(key==='stock'||key==='low_stock_at'?'1':'0.01'):undefined} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={key==='credit_limit'?'10000':key==='unit'?'5L can':''}/>}</label>)}</div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy} onClick={onSave}><Check size={15}/>{editing?'Save changes':`Save ${type}`}</button></div></div></div>;
}

function toCsv(rows) { const quote=(v)=>{let value=String(v??'');if(/^[=+\-@\t\r]/.test(value))value=`'${value}`;return `"${value.replaceAll('"','""')}"`;}; return ['Order,Customer,Date,Total,Payment,Status',...rows.map(o=>[o.id,o.customer_name,o.created_at,o.total,o.payment_status,o.stage].map(quote).join(','))].join('\n'); }
function download(content,name,type='text/csv;charset=utf-8') { const a=document.createElement('a'); const url=URL.createObjectURL(new Blob([content],{type})); a.href=url; a.download=name; a.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000); }

export default App;
