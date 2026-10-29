# Zelvo Cleaning Solutions ERP — Product and Implementation Plan

## Purpose

Replace the current Zelvo business app at its existing web address with a dependable, shared ERP-style web app for daily operations. Use the new `zelvo-erp` Supabase project for the ERP and leave the legacy Supabase project and its data untouched as a recoverable archive.

## Decisions confirmed by the owner

- Replace the current app at its existing deployment URL.
- Create a new Supabase project/database for the ERP; do not modify or delete the current Supabase project.
- Start the new ERP with a clean business database. Keep the old database available; only import records later if the owner explicitly requests it.
- A single hotel/customer receipt may settle multiple invoices in one transaction.
- Each invoice included in a receipt must be settled in full. Partial invoice payments are not allowed.
- Track finished products only. Do not add BOM, raw-material, or empty-can tracking.
- Support cash and credit sales.
- Require a date for stock additions/removals; stock adjustment reason is optional.
- Add finished-product stock only through dated stock adjustments in the first release; do not add supplier purchasing/receiving.
- Track hotel credit by invoice date and age; no required due date or default payment term in the first release.
- Show optional tax identity/details on bills, but keep GST/tax calculations off.
- Share data across computers and phones.
- Keep a customized Zelvo bill generator, customer credit ledger, dated notes, and calculator.
- Provide delete/cancel actions wherever safe, using archive, void, cancellation, and reversal rules that preserve audit and financial history.
- Allow item-level returns after dispatch/delivery; create a credit note and restock only quantities explicitly marked saleable.
- Create the new Supabase project in the selected organization and Mumbai region. The project is `zelvo-erp` and its quoted cost is $0/month; the existing project stays untouched.

## Current baseline

- Front end: React and Vite, hosted on the existing Cloudflare Worker domain.
- Data/auth: Supabase Auth and PostgreSQL with organization membership and row-level security.
- Current app modules: overview, sales, customers, products/stock, customer ledger, bills, expenses, notes, calculator, and reports.
- Current source concentrates much of the UI and business logic in `src/App.jsx`; the database schema and upgrade scripts live in `supabase/`.
- Existing server-side database functions validate order creation, dispatch stock, collect full invoice payments, and apply dated stock adjustments. Preserve these guarantees and improve them where necessary.
- The old project's `payments` rows are one-per-invoice. The new project starts clean with grouped receipt headers and allocations designed into its schema; the old project remains unchanged.
- Current order flow is `Order Received` → `Processing` → `Dispatched` → `Delivered`. Dispatch decrements stock once, sets the invoice date, and records full payment for cash orders.

## Product scope and workflows

### 1. Sign-in, users, and workspace

- Require authenticated access in production. The production build must not silently fall back to browser-only preview data.
- Create the Zelvo organization in the new project. Invite users to the new Auth project; existing passwords/sessions are not assumed to carry over from the old project.
- Provide clear owner/staff permissions. Restrict inviting users and changing business settings to the owner/authorized manager.
- Show connection, loading, permission, and save errors clearly. Prevent duplicate submissions and ambiguous retry behavior.

### 2. Customers and hotels

- Maintain a customer directory with business/hotel name, contact person, phone, location, credit limit, active status, and notes.
- Open a customer account view showing invoices, receipts, invoice dates, aging from invoice date, running balance, and date filters. Due dates are not required in the first release.
- Calculate balances from invoices and receipts. Never store a separately editable balance.
- Prevent new credit orders that exceed the agreed credit limit, including orders awaiting dispatch.

### 3. Finished product catalog and stock

- Store finished-product name, SKU, unit, selling price, unit cost, current quantity, low-stock threshold, and active/archive status.
- Record every stock change as a dated movement with product, signed quantity, source/type, optional reason, user, and linked order/receipt when relevant.
- Keep stock quantity equal to the opening balance plus all movements. Block negative stock and duplicate dispatch deductions.
- Stock adjustment date is mandatory; reason is optional. Removing a catalog product should archive it if it has transaction history.
- Products without transaction history can be permanently deleted after confirmation; products with linked orders or stock movements can only be archived. Stock movements are never deleted; corrections use dated reversal movements.
- Exclude BOM, ingredients/raw materials, and empty containers from this release.

### 4. Sales, invoices, and delivery

- Create a sale from a selected customer and one or more finished products. Snapshot product name, SKU, unit price, unit cost, quantity, and totals on each invoice line so later catalog edits cannot rewrite historical invoices.
- Keep order/delivery status separate from payment status. Use `Order Received` → `Processing` → `Dispatched` → `Delivered`; dispatch decrements stock and records the invoice date.
- Deduct stock once when the order is dispatched. Run order creation and dispatch changes transactionally in PostgreSQL.
- Cash sale: record full cash payment at dispatch; partial payment is not allowed.
- Credit sale: create an unpaid invoice, calculate the customer's available credit, and allow full settlement later.
- A not-yet-dispatched order can be cancelled with confirmation and a required reason. If it has never been invoiced, paid, or moved stock, it can later be permanently deleted with a reason and an audit snapshot.
- A dispatched/delivered order cannot be deleted. Cancellation/return creates a linked credit-note/reversal record. Restock returned quantities only when marked saleable; preserve the original invoice and receipt history.
- Invoice dates and payment dates use the business's India time zone. Store timestamps consistently and render business dates as Asia/Kolkata.

### 5. Receipts and customer ledger

- Model a receipt as a dated transaction with method (cash, UPI, or bank), total amount, reference/remarks, and user.
- Allow one receipt to allocate to several selected invoices only when each selected invoice's entire current outstanding amount is covered.
- Validate receipt total equals the sum of allocated full invoice balances. Reject partial allocations, overpayments, duplicate allocations, already-paid invoices, or receipts dated before invoice date/in the future.
- Use a receipt-to-invoice allocation table to preserve a reliable audit trail and support grouped hotel payments.
- Provide a chronological customer ledger with invoice debits, receipt credits, references, running balance, and date filters. Keep unpaid invoices visible by hotel/customer.
- Never silently edit or delete posted receipts. Corrections should use a controlled reversal/void action with an audit record.
- Draft receipts can be discarded. Posted receipts can only be reversed/voided by an authorized role, with a required reason; reverse all invoice allocations atomically and keep the original receipt visible.

### 6. Customized bill generator

- Keep Zelvo logo/branding and editable business name, address, phone, email, tax ID, UPI ID, accent color, footer, and terms.
- Generate a print-friendly invoice/PDF from the immutable sale snapshot.
- Support unique invoice numbers and display invoice date, customer details, item quantities/rates, subtotal, optional tax identity/details, amount paid/due, and payment status.
- Do not calculate GST/tax or require due dates in the first release.

### 7. Expenses, notes, calculator, and reports

- Expenses: date, description, category, amount, and payment method; keep separate from sales and inventory cost. A posted expense can be voided to reverse it, or deleted from active records with a required reason and an audit snapshot.
- Notes: title, required date, body, search, edit, and soft-delete/restore with user/workspace permissions.
- Customers with invoice/receipt history are archived, not hard-deleted. Customers without history can be deleted after confirmation. Record all archive/restore actions.
- Calculator: safe arithmetic for business use; it must not mutate accounts or financial records.
- Reports: net sales by invoice date less posted credit notes by return date, cost of goods less only saleable restocked returns, outstanding credit and invoice-age buckets, receipts by date/method, stock valuation/low stock, and posted expenses. Export records and provide a full database backup/reset path.

## Proposed database model

- New project tables: `organizations`, `business_members`, `customers`, `products`, `sales_orders`, `sales_order_items`, `receipts`, `receipt_allocations`, `order_returns`, `order_return_items`, `inventory_movements`, `expenses`, `organization_settings`, `business_notes`, and `audit_events`.
- A receipt header stores date, method, total, reference, recorder, and status. Receipt allocations link the receipt to invoices. Each allocation must exactly equal that invoice's full outstanding amount; the sum must equal the receipt total. Do not model invoice balances as mutable fields.
- Keep the old Supabase project untouched. The new project starts with a clean organization and no sample business records. Do not import old records unless the owner separately requests a migration.
- Add an append-only `audit_events` record for material actions such as receipt posting/voiding, stock adjustment, dispatch, cancellation/return, archive/restore, and permission changes.
- Use database transactions, constraints, and security-definer functions with explicit authorization checks for financial and stock mutations. Apply row-level security to every business table.
- Use numeric/decimal types for money; never use JavaScript floating-point arithmetic as the final authority for totals.
- Add indexes for organization, customer, invoice, movement date, and receipt date queries. Use soft archive for products/customers with history.

## User interface and navigation

- Keep a clean, fast, dark/neutral Zelvo interface inspired by Framer/Raycast, with a responsive desktop sidebar and phone navigation.
- Primary navigation: Overview; Sales & Orders; Customers; Products & Stock; Customer Ledger; Cash Flow with invoice-age credit management; Expenses; Reports.
- Additional tools: Bill generator, dated Notes, Calculator, and owner-only Backup & Reset.
- Use consistent searchable tables, date filters, status labels, empty states, accessible forms, confirmations for irreversible actions, and clear success/error messages.
- Make common tasks prominent: new sale, add customer, add product, stock adjustment, receive hotel payment, print invoice.

### Delete and correction behavior in every screen

- Order actions appear wherever an order is shown: sales list/detail, customer profile and ledger, invoice/bill view, and dashboard recent activity. All entry points call the same server-validated operation.
- An undispatched or cancelled order with no payment or stock movement can be permanently deleted after confirmation. Record the actor, reason, order, and line snapshot before removing the order and its lines.
- A dispatched or paid order cannot be physically erased. Show Cancel/Return instead; remove it from active lists by default but retain its original invoice, returns, receipts, and audit trail in history.
- Customers/products with history are archived; receipts are voided; expenses can be voided or deleted with an audit snapshot; notes can be soft-deleted/restored; stock movements are corrected with a new linked dated movement.
- No screen should expose a hard-delete action for data that has changed stock, customer balances, or financial reports. Put the correct cancel/void/reversal action in its place.
- Require confirmation for destructive actions. Require a reason for cancel, return, void, and reversal; validate role authorization in PostgreSQL, not only in the UI.
- Deleting an expense removes it from active expense and cash-flow totals; audit history retains its deleted snapshot and reason.
- The owner-only reset requires a fresh full backup, a backup acknowledgement, and exact typed confirmation. It clears business records in one transaction, preserves settings and memberships, and records the reset in the audit history.

## Implementation sequence and release gates

### Phase 0 — Review and close requirements

- Review this plan and settle the open business decisions below.
- Inventory the live Supabase schema, policies, functions, member IDs, and existing data without changing them.
- Capture/export a restorable backup before any production database migration.
- Provision and initialize the new `zelvo-erp` Supabase project; the old project remains untouched and is not the target of any new schema SQL.
- Invite the owner/staff in the new Supabase Auth project; credentials/sessions do not transfer automatically.

### Phase 1 — Modular app foundation

- Split the current monolithic component into app shell, routes/pages, reusable components, data services, and domain modules.
- Fix production authentication so missing configuration blocks access instead of opening local preview mode.
- Keep the current database untouched while building.

### Phase 2 — Master data and stock

- Deliver customers, finished-product catalog, archive/restore, date-required adjustments, stock history, and validated dispatch stock deduction.

### Phase 3 — Sales, bills, receipts, and ledger

- Deliver order/invoice snapshots, cash and credit flows, grouped full-invoice receipts, credit limits, date-aware ledger, and printable customized bills.

### Phase 4 — Remaining business tools

- Deliver expenses, dated notes, calculator, reports, CSV export, and backup/export workflow.

### Phase 5 — Production verification and switch-over

- Replace the existing app at its current URL after local acceptance tests pass. Do not create a separate deployed preview app, matching the owner's choice.
- Verify database migration behavior against a disposable/local test database or isolated test fixtures first; never create fake sales/receipts in the live business ledger for testing.
- Apply the bootstrap schema and reviewed migrations to the new Supabase project only.
- Point the replacement app build to the new project. Retain the old project as a recoverable archive; do not delete it at cutover.
- Build and deploy the replacement to the existing Cloudflare Worker only after the build, migration, auth, and data-integrity gates pass.
- Confirm login, multi-device sync, invoice printing, stock, grouped receipt posting, reports, and recovery/export using the actual live URL.

## Acceptance tests

1. Signed-out users cannot view or mutate business records; missing Supabase configuration shows a setup error rather than a local dashboard.
2. An authorized user can add/edit/archive a customer and finished product; unauthorized users cannot cross workspace boundaries.
3. Stock adjustments require a valid date, allow a blank reason, preserve movement history, and cannot create negative stock.
4. Dispatch decrements stock once; retrying or double-clicking does not decrement it again. Insufficient stock rejects the transaction without a partial order update.
5. A cash invoice settles in full and records its receipt; a credit invoice remains due until settled.
6. A grouped hotel receipt can settle several full outstanding invoices in one atomic transaction. Any partial allocation, excess amount, duplicate invoice, or invalid date is rejected without changing any balance.
7. Customer ledger balances reconcile to invoice debits minus receipt allocations for any date filter and across devices.
8. Catalog price/name changes do not change already-issued invoice lines or printed bills.
9. Concurrent users see shared updates; conflicting/retried operations do not duplicate stock movements, invoices, or receipts.
10. Notes, expenses, reports, export, calculator, and bill settings work on desktop and phone layouts.
11. Undispatched unpaid orders can be fully deleted from sales, ledger, and bill/order contexts; the same order disappears from active lists, and an audit deletion event remains.
12. Dispatched orders cannot be erased. Item returns create credit notes; only saleable returned quantities increase stock; the original order/receipt remains in history.
13. Posted receipts and stock movements cannot be hard-deleted; authorized reversal actions preserve the original and record a reason.
14. Deleted expenses disappear from active expenses and cash-flow totals while audit history retains their values and deletion reason.
15. Net revenue subtracts posted credit notes by return date; COGS is reduced only by saleable quantities actually returned to stock.
16. Full backup contains every business table from a consistent authorized database snapshot. Reset requires a fresh backup and preserves owner login, memberships, and settings.

## Operational checks still needed before launch

- Confirm cash is collected at dispatch for every cash order.
- Confirm the owner has rotated the password shared in the conversation and can sign in to the new project.
- Confirm backups can be downloaded and stored securely before first business use.
- Verify the live hosting build points to the new Supabase project and that production login, sync, printing, stock, receipts, returns, and reset safeguards work at the live domain.

## Explicitly out of scope for the first release

- BOM, raw-material consumption, chemical recipes, and empty-can tracking.
- Partial invoice payments.
- Automatic tax/GST calculations.
- Destructive reset or deletion of the existing Supabase project as part of app replacement.
