const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET" && method !== "HEAD") {
    // Django's CSRF cookie must be fetched once (see ensureCsrf) before
    // any unsafe request — this just forwards whatever's already set.
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers.set("X-CSRFToken", csrfToken);
    // A FormData body (file uploads) must NOT get a manual Content-Type —
    // the browser sets its own multipart boundary. JSON bodies still get
    // one automatically as before.
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.detail ?? JSON.stringify(data);
    } catch {
      // response had no JSON body
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function ensureCsrf(): Promise<void> {
  await request("/api/auth/csrf/");
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  full_name: string;
  is_platform_admin: boolean;
}

export interface Company {
  id: number;
  name: string;
  logo_url: string;
  industry: string;
  country: string;
  currency: string;
  timezone: string;
  tax_number: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
}

export interface Membership {
  id: number;
  company: Company;
  status: string;
  roles: { id: number; name: string }[];
  permissions: string[];
  created_at: string;
  accepted_at: string | null;
}

export interface Me {
  user: User;
  memberships: Membership[];
  active_company_id: number | null;
}

// --- Branches ---

export interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

// --- HR ---

export interface Department {
  id: number;
  name: string;
  branch: number | null;
  created_at: string;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: number | null;
  branch: number | null;
  salary_cents: number;
  joining_date: string | null;
  status: "active" | "on_leave" | "terminated";
  created_at: string;
}

// --- Catalog ---

export interface Item {
  id: number;
  type: "product" | "service";
  name: string;
  category: string;
  price_cents: number;
  cost_cents: number;
  tax_rate: number | null;
  status: "active" | "archived";
  created_at: string;
}

// --- Tax ---

export interface TaxRate {
  id: number;
  name: string;
  code: string;
  rate_percent: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

// --- Inventory ---

export interface Warehouse {
  id: number;
  name: string;
  location: string;
  branch: number | null;
  created_at: string;
}

export interface Stock {
  id: number;
  item: number;
  item_name: string;
  warehouse: number;
  warehouse_name: string;
  quantity: number;
  minimum_stock: number;
  created_at: string;
}

export interface StockMovement {
  id: number;
  item: number;
  warehouse: number;
  to_warehouse: number | null;
  type: "in" | "out" | "transfer" | "adjustment";
  quantity: number;
  reference: string;
  created_at: string;
}

export interface StockCountLine {
  id: number;
  item: number;
  item_name: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
}

export interface StockCount {
  id: number;
  warehouse: number;
  warehouse_name: string;
  status: "open" | "completed";
  lines: StockCountLine[];
  completed_at: string | null;
  created_at: string;
}

// --- CRM ---

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: "individual" | "business" | "government" | "vip";
  address: string;
  created_at: string;
}

export interface Contact {
  id: number;
  customer: number;
  name: string;
  title: string;
  email: string;
  phone: string;
  is_primary: boolean;
  created_at: string;
}

export interface Lead {
  id: number;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "disqualified" | "converted";
  notes: string;
  assigned_to: number | null;
  assigned_to_name: string;
  converted_customer: number | null;
  created_at: string;
}

export interface Opportunity {
  id: number;
  customer: number;
  lead: number | null;
  name: string;
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "won" | "lost";
  amount_cents: number;
  expected_close_date: string | null;
  notes: string;
  assigned_to: number | null;
  assigned_to_name: string;
  created_at: string;
}

// --- Suppliers ---

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  created_at: string;
}

// --- Procurement ---

export interface PurchaseOrderLine {
  id: number;
  item: number;
  quantity: number;
  unit_cost_cents: number;
  received_quantity: number;
  outstanding_quantity: number;
}

export interface PurchaseOrder {
  id: number;
  supplier: number;
  status: "draft" | "submitted" | "approved" | "received" | "cancelled";
  lines: PurchaseOrderLine[];
  total_cents: number;
  created_at: string;
}

export interface PurchaseRequestLine {
  id: number;
  item: number;
  quantity: number;
  estimated_unit_cost_cents: number;
}

export interface PurchaseRequest {
  id: number;
  requested_by: number | null;
  requested_by_name: string;
  justification: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "converted";
  lines: PurchaseRequestLine[];
  total_cents: number;
  converted_purchase_order: number | null;
  created_at: string;
}

// --- Sales ---

export interface OrderLine {
  id: number;
  item: number;
  quantity: number;
  unit_price_cents: number;
  discount_percent: number;
  line_total_cents: number;
}

export interface Quotation {
  id: number;
  customer: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  lines: OrderLine[];
  total_cents: number;
  created_at: string;
}

export interface SalesOrder {
  id: number;
  customer: number;
  quotation: number | null;
  status: "pending" | "processing" | "fulfilled" | "cancelled";
  payment_status: "unpaid" | "partially_paid" | "paid";
  lines: OrderLine[];
  total_cents: number;
  created_at: string;
}

export interface Invoice {
  id: number;
  sales_order: number | null;
  invoice_number: string;
  amount_cents: number;
  tax_amount_cents: number;
  due_date: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  created_at: string;
}

export interface CreditNote {
  id: number;
  invoice: number;
  credit_note_number: string;
  amount_cents: number;
  tax_amount_cents: number;
  reason: string;
  created_at: string;
}

// --- Procurement: Bills ---

export interface Bill {
  id: number;
  purchase_order: number | null;
  bill_number: string;
  amount_cents: number;
  tax_amount_cents: number;
  due_date: string | null;
  status: "draft" | "received" | "paid" | "overdue" | "void";
  created_at: string;
}

export interface PurchaseReturn {
  id: number;
  bill: number;
  debit_note_number: string;
  amount_cents: number;
  tax_amount_cents: number;
  reason: string;
  created_at: string;
}

// --- Expenses ---

export interface Expense {
  id: number;
  employee: number;
  category: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "paid";
  created_at: string;
}

// --- Accounting ---

export interface Account {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent: number | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
}

export interface JournalLine {
  id: number;
  account: number;
  debit_cents: number;
  credit_cents: number;
}

export interface JournalEntry {
  id: number;
  reference: string;
  memo: string;
  lines: JournalLine[];
  created_at: string;
}

export interface Payment {
  id: number;
  direction: "received" | "paid";
  amount_cents: number;
  method: "cash" | "bank_transfer" | "mobile_money" | "card";
  reference: string;
  receipt_number: string;
  invoice: number | null;
  bill: number | null;
  expense: number | null;
  created_at: string;
}

export interface TrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  type: Account["type"];
  total_debit_cents: number;
  total_credit_cents: number;
  net_cents: number;
}

export interface ReportLine {
  code: string;
  name: string;
  amount_cents: number;
}

export interface ProfitAndLoss {
  revenue: ReportLine[];
  total_revenue_cents: number;
  expenses: ReportLine[];
  total_expense_cents: number;
  net_income_cents: number;
}

export interface BalanceSheet {
  assets: ReportLine[];
  total_assets_cents: number;
  liabilities: ReportLine[];
  total_liabilities_cents: number;
  equity: ReportLine[];
  total_equity_cents: number;
  unclosed_net_income_cents: number;
  note: string;
}

export interface CashFlow {
  cash_received_from_customers_cents: number;
  cash_paid_to_suppliers_cents: number;
  cash_paid_to_employees_cents: number;
  other_cash_movements_cents: number;
  net_change_in_cash_cents: number;
  note: string;
}

// --- Financial Periods ---

export interface FinancialPeriod {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  closed_at: string | null;
  net_income_cents: number | null;
  created_at: string;
}

// --- Bank Accounts & Reconciliation ---

export interface BankAccount {
  id: number;
  name: string;
  bank_name: string;
  account_number: string;
  account: number;
  is_active: boolean;
  balance_cents: number;
  created_at: string;
}

export interface BankStatementLine {
  id: number;
  bank_account: number;
  date: string;
  description: string;
  amount_cents: number;
  is_reconciled: boolean;
  created_at: string;
}

// --- Petty Cash ---

export interface PettyCashFund {
  id: number;
  name: string;
  custodian: number;
  account: number;
  imprest_amount_cents: number;
  is_active: boolean;
  balance_cents: number;
  created_at: string;
}

export interface PettyCashTransaction {
  id: number;
  fund: number;
  type: "disbursement" | "replenishment";
  category: string;
  description: string;
  amount_cents: number;
  date: string;
  created_at: string;
}

// --- Budgets ---

export interface Budget {
  id: number;
  account: number;
  period_label: string;
  amount_cents: number;
  created_at: string;
}

export interface BudgetVsActualRow {
  budget_id: number;
  account_code: string;
  account_name: string;
  period_label: string;
  budget_cents: number;
  actual_cents: number;
  variance_cents: number;
}

// --- Fixed Assets ---

export interface FixedAsset {
  id: number;
  name: string;
  category: string;
  purchase_date: string;
  cost_cents: number;
  salvage_value_cents: number;
  useful_life_months: number;
  accumulated_depreciation_cents: number;
  last_depreciated_on: string | null;
  status: "active" | "disposed";
  book_value_cents: number;
  monthly_depreciation_cents: number;
  created_at: string;
}

// --- Documents & Notes ---
// Both attach to any (app_label, model, object_id) named in the
// backend's apps.common.targeting.ALLOWED_TARGETS — see that file for
// the current whitelist. Same target shape, shared by both features.

export interface RecordTarget {
  appLabel: string;
  model: string;
  objectId: number;
}

export interface Document {
  id: number;
  target_label: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface Note {
  id: number;
  body: string;
  author_name: string;
  created_at: string;
}

export interface Activity {
  id: number;
  verb: "created" | "note_added" | "document_attached";
  summary: string;
  actor_name: string;
  created_at: string;
}

// --- Approvals ---

export interface ApprovalRequestEntry {
  id: number;
  target_label: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  decision_note: string;
  requested_by_name: string;
  decided_by_name: string;
  decided_at: string | null;
  created_at: string;
}

// --- Audit log ---

export interface AuditLogEntry {
  id: number;
  action: "created" | "updated" | "deleted";
  target_label: string;
  changes: Record<string, [unknown, unknown]>;
  actor_name: string;
  created_at: string;
}

// --- Global search ---

export interface SearchResult {
  app_label: string;
  model: string;
  object_id: number;
  module: string;
  title: string;
  url: string;
}

// --- Notifications ---

export interface Notification {
  id: number;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

// --- Company members (for assignee/owner pickers) ---

export interface CompanyMember {
  user_id: number;
  name: string;
  email: string;
}

export interface EmployeePickerEntry {
  id: number;
  name: string;
}

// --- Tasks ---

export interface Task {
  id: number;
  title: string;
  description: string;
  assignee: number | null;
  assignee_name: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  created_by_name: string;
  created_at: string;
}

// --- Calendar ---

export interface Event {
  id: number;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  created_at: string;
}

// --- Company dashboard summary ---
// Each section is present only if the user has that module's own view
// permission — same per-module gating as everywhere else, so a
// single-role user still gets a (smaller) dashboard, not a 403.

export interface CompanySummary {
  finance?: {
    revenue_cents: number;
    expense_cents: number;
    profit_cents: number;
    pending_receivable_cents: number;
    pending_payable_cents: number;
  };
  sales?: {
    order_count: number;
    total_sales_cents: number;
  };
  inventory?: {
    item_count: number;
    total_units: number;
    low_stock_count: number;
  };
  hr?: {
    employee_count: number;
  };
}

export const api = {
  ensureCsrf,
  me: () => request<Me>("/api/auth/me/"),
  login: (email: string, password: string) =>
    request<User>("/api/auth/login/", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    request<User>("/api/auth/signup/", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<void>("/api/auth/logout/", { method: "POST" }),
  listCompanies: () => request<Company[]>("/api/companies/"),
  createCompany: (data: Partial<Company>) =>
    request<Company>("/api/companies/", { method: "POST", body: JSON.stringify(data) }),
  setActiveCompany: (companyId: number) =>
    request<Company>("/api/companies/active/", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId }),
    }),
  updateCompany: (id: number, data: Partial<Company>) =>
    request<Company>(`/api/companies/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  listCompanyMembers: () => request<CompanyMember[]>("/api/companies/members/"),

  // --- Branches ---
  listBranches: () => request<Branch[]>("/api/branches/"),
  createBranch: (data: Partial<Branch>) =>
    request<Branch>("/api/branches/", { method: "POST", body: JSON.stringify(data) }),
  updateBranch: (id: number, data: Partial<Branch>) =>
    request<Branch>(`/api/branches/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBranch: (id: number) => request<void>(`/api/branches/${id}/`, { method: "DELETE" }),

  // --- HR ---
  listDepartments: () => request<Department[]>("/api/hr/departments/"),
  createDepartment: (data: { name: string; branch?: number | null }) =>
    request<Department>("/api/hr/departments/", { method: "POST", body: JSON.stringify(data) }),
  updateDepartment: (id: number, data: { name: string; branch?: number | null }) =>
    request<Department>(`/api/hr/departments/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDepartment: (id: number) => request<void>(`/api/hr/departments/${id}/`, { method: "DELETE" }),
  listEmployees: () => request<Employee[]>("/api/hr/employees/"),
  listEmployeePicker: () => request<EmployeePickerEntry[]>("/api/hr/employee-picker/"),
  createEmployee: (data: Partial<Employee>) =>
    request<Employee>("/api/hr/employees/", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    request<Employee>(`/api/hr/employees/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEmployee: (id: number) => request<void>(`/api/hr/employees/${id}/`, { method: "DELETE" }),

  // --- Catalog ---
  listItems: () => request<Item[]>("/api/catalog/items/"),
  createItem: (data: Partial<Item>) =>
    request<Item>("/api/catalog/items/", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: number, data: Partial<Item>) =>
    request<Item>(`/api/catalog/items/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteItem: (id: number) => request<void>(`/api/catalog/items/${id}/`, { method: "DELETE" }),

  // --- Tax ---
  listTaxRates: () => request<TaxRate[]>("/api/tax-rates/"),
  createTaxRate: (data: Partial<TaxRate>) =>
    request<TaxRate>("/api/tax-rates/", { method: "POST", body: JSON.stringify(data) }),
  updateTaxRate: (id: number, data: Partial<TaxRate>) =>
    request<TaxRate>(`/api/tax-rates/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTaxRate: (id: number) => request<void>(`/api/tax-rates/${id}/`, { method: "DELETE" }),

  // --- Inventory ---
  listWarehouses: () => request<Warehouse[]>("/api/inventory/warehouses/"),
  createWarehouse: (data: { name: string; location?: string; branch?: number | null }) =>
    request<Warehouse>("/api/inventory/warehouses/", { method: "POST", body: JSON.stringify(data) }),
  updateWarehouse: (id: number, data: { name: string; location?: string; branch?: number | null }) =>
    request<Warehouse>(`/api/inventory/warehouses/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteWarehouse: (id: number) =>
    request<void>(`/api/inventory/warehouses/${id}/`, { method: "DELETE" }),
  listStock: () => request<Stock[]>("/api/inventory/stock/"),
  listStockMovements: () => request<StockMovement[]>("/api/inventory/stock-movements/"),
  createStockMovement: (data: Partial<StockMovement>) =>
    request<StockMovement>("/api/inventory/stock-movements/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listStockCounts: () => request<StockCount[]>("/api/inventory/stock-counts/"),
  createStockCount: (warehouse: number) =>
    request<StockCount>("/api/inventory/stock-counts/", {
      method: "POST",
      body: JSON.stringify({ warehouse }),
    }),
  recordStockCounts: (id: number, lines: { id: number; counted_quantity: number | null }[]) =>
    request<StockCount>(`/api/inventory/stock-counts/${id}/record_counts/`, {
      method: "POST",
      body: JSON.stringify({ lines }),
    }),
  finalizeStockCount: (id: number) =>
    request<StockCount>(`/api/inventory/stock-counts/${id}/finalize/`, { method: "POST" }),

  // --- CRM ---
  listCustomers: () => request<Customer[]>("/api/crm/customers/"),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>("/api/crm/customers/", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: Partial<Customer>) =>
    request<Customer>(`/api/crm/customers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: number) => request<void>(`/api/crm/customers/${id}/`, { method: "DELETE" }),
  listContacts: (customerId?: number) =>
    request<Contact[]>(`/api/crm/contacts/${customerId ? `?customer=${customerId}` : ""}`),
  createContact: (data: Partial<Contact>) =>
    request<Contact>("/api/crm/contacts/", { method: "POST", body: JSON.stringify(data) }),
  updateContact: (id: number, data: Partial<Contact>) =>
    request<Contact>(`/api/crm/contacts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteContact: (id: number) => request<void>(`/api/crm/contacts/${id}/`, { method: "DELETE" }),
  listLeads: () => request<Lead[]>("/api/crm/leads/"),
  createLead: (data: Partial<Lead>) =>
    request<Lead>("/api/crm/leads/", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<Lead>(`/api/crm/leads/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLead: (id: number) => request<void>(`/api/crm/leads/${id}/`, { method: "DELETE" }),
  convertLead: (id: number) => request<Lead>(`/api/crm/leads/${id}/convert/`, { method: "POST" }),
  listOpportunities: (customerId?: number) =>
    request<Opportunity[]>(`/api/crm/opportunities/${customerId ? `?customer=${customerId}` : ""}`),
  createOpportunity: (data: Partial<Opportunity>) =>
    request<Opportunity>("/api/crm/opportunities/", { method: "POST", body: JSON.stringify(data) }),
  updateOpportunity: (id: number, data: Partial<Opportunity>) =>
    request<Opportunity>(`/api/crm/opportunities/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteOpportunity: (id: number) =>
    request<void>(`/api/crm/opportunities/${id}/`, { method: "DELETE" }),

  // --- Suppliers ---
  listSuppliers: () => request<Supplier[]>("/api/suppliers/suppliers/"),
  createSupplier: (data: Partial<Supplier>) =>
    request<Supplier>("/api/suppliers/suppliers/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Partial<Supplier>) =>
    request<Supplier>(`/api/suppliers/suppliers/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSupplier: (id: number) =>
    request<void>(`/api/suppliers/suppliers/${id}/`, { method: "DELETE" }),

  // --- Procurement ---
  listPurchaseOrders: () => request<PurchaseOrder[]>("/api/procurement/purchase-orders/"),
  createPurchaseOrder: (data: {
    supplier: number;
    status: string;
    lines: { item: number; quantity: number; unit_cost_cents: number }[];
  }) =>
    request<PurchaseOrder>("/api/procurement/purchase-orders/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePurchaseOrder: (
    id: number,
    data: {
      supplier: number;
      status: string;
      lines: { item: number; quantity: number; unit_cost_cents: number }[];
    }
  ) =>
    request<PurchaseOrder>(`/api/procurement/purchase-orders/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePurchaseOrder: (id: number) =>
    request<void>(`/api/procurement/purchase-orders/${id}/`, { method: "DELETE" }),
  receivePurchaseOrder: (id: number, data: { warehouse: number; lines: { line: number; quantity: number }[] }) =>
    request<PurchaseOrder>(`/api/procurement/purchase-orders/${id}/receive/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPurchaseRequests: () => request<PurchaseRequest[]>("/api/procurement/purchase-requests/"),
  createPurchaseRequest: (data: {
    requested_by?: number | null;
    justification?: string;
    lines: { item: number; quantity: number; estimated_unit_cost_cents: number }[];
  }) =>
    request<PurchaseRequest>("/api/procurement/purchase-requests/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePurchaseRequest: (id: number) =>
    request<void>(`/api/procurement/purchase-requests/${id}/`, { method: "DELETE" }),
  convertPurchaseRequest: (id: number, supplier: number) =>
    request<PurchaseRequest>(`/api/procurement/purchase-requests/${id}/convert/`, {
      method: "POST",
      body: JSON.stringify({ supplier }),
    }),

  // --- Sales ---
  listQuotations: () => request<Quotation[]>("/api/sales/quotations/"),
  createQuotation: (data: {
    customer: number;
    status: string;
    lines: { item: number; quantity: number; unit_price_cents: number; discount_percent?: number }[];
  }) =>
    request<Quotation>("/api/sales/quotations/", { method: "POST", body: JSON.stringify(data) }),
  updateQuotation: (
    id: number,
    data: {
      customer: number;
      status: string;
      lines: { item: number; quantity: number; unit_price_cents: number; discount_percent?: number }[];
    }
  ) =>
    request<Quotation>(`/api/sales/quotations/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteQuotation: (id: number) =>
    request<void>(`/api/sales/quotations/${id}/`, { method: "DELETE" }),
  listSalesOrders: () => request<SalesOrder[]>("/api/sales/sales-orders/"),
  createSalesOrder: (data: {
    customer: number;
    quotation?: number | null;
    status: string;
    payment_status: string;
    lines: { item: number; quantity: number; unit_price_cents: number; discount_percent?: number }[];
  }) =>
    request<SalesOrder>("/api/sales/sales-orders/", { method: "POST", body: JSON.stringify(data) }),
  updateSalesOrder: (
    id: number,
    data: {
      customer: number;
      quotation?: number | null;
      status: string;
      payment_status: string;
      lines: { item: number; quantity: number; unit_price_cents: number; discount_percent?: number }[];
    }
  ) =>
    request<SalesOrder>(`/api/sales/sales-orders/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSalesOrder: (id: number) =>
    request<void>(`/api/sales/sales-orders/${id}/`, { method: "DELETE" }),
  listInvoices: () => request<Invoice[]>("/api/sales/invoices/"),
  createInvoice: (data: {
    sales_order?: number | null;
    amount_cents?: number;
    tax_amount_cents?: number;
    due_date?: string | null;
  }) => request<Invoice>("/api/sales/invoices/", { method: "POST", body: JSON.stringify(data) }),
  listCreditNotes: (invoiceId?: number) =>
    request<CreditNote[]>(`/api/sales/credit-notes/${invoiceId ? `?invoice=${invoiceId}` : ""}`),
  createCreditNote: (data: { invoice: number; amount_cents: number; tax_amount_cents?: number; reason?: string }) =>
    request<CreditNote>("/api/sales/credit-notes/", { method: "POST", body: JSON.stringify(data) }),

  // --- Procurement: Bills ---
  listBills: () => request<Bill[]>("/api/procurement/bills/"),
  createBill: (data: {
    purchase_order?: number | null;
    amount_cents?: number;
    tax_amount_cents?: number;
    due_date?: string | null;
  }) => request<Bill>("/api/procurement/bills/", { method: "POST", body: JSON.stringify(data) }),
  listPurchaseReturns: (billId?: number) =>
    request<PurchaseReturn[]>(`/api/procurement/purchase-returns/${billId ? `?bill=${billId}` : ""}`),
  createPurchaseReturn: (data: { bill: number; amount_cents: number; tax_amount_cents?: number; reason?: string }) =>
    request<PurchaseReturn>("/api/procurement/purchase-returns/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Expenses ---
  listExpenses: () => request<Expense[]>("/api/expenses/"),
  createExpense: (data: Partial<Expense>) =>
    request<Expense>("/api/expenses/", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: number, data: Partial<Expense>) =>
    request<Expense>(`/api/expenses/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExpense: (id: number) => request<void>(`/api/expenses/${id}/`, { method: "DELETE" }),

  // --- Accounting ---
  listAccounts: () => request<Account[]>("/api/accounting/accounts/"),
  createAccount: (data: Partial<Account>) =>
    request<Account>("/api/accounting/accounts/", { method: "POST", body: JSON.stringify(data) }),
  updateAccount: (id: number, data: Partial<Account>) =>
    request<Account>(`/api/accounting/accounts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAccount: (id: number) =>
    request<void>(`/api/accounting/accounts/${id}/`, { method: "DELETE" }),
  listJournalEntries: () => request<JournalEntry[]>("/api/accounting/journal-entries/"),
  createJournalEntry: (data: {
    reference: string;
    memo: string;
    lines: { account: number; debit_cents: number; credit_cents: number }[];
  }) =>
    request<JournalEntry>("/api/accounting/journal-entries/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPayments: () => request<Payment[]>("/api/accounting/payments/"),
  getPayment: (id: number) => request<Payment>(`/api/accounting/payments/${id}/`),
  createPayment: (data: {
    direction: Payment["direction"];
    amount_cents: number;
    method: Payment["method"];
    reference?: string;
    invoice?: number | null;
    bill?: number | null;
    expense?: number | null;
  }) => request<Payment>("/api/accounting/payments/", { method: "POST", body: JSON.stringify(data) }),
  trialBalance: () => request<TrialBalanceRow[]>("/api/accounting/reports/trial-balance/"),
  profitAndLoss: () => request<ProfitAndLoss>("/api/accounting/reports/profit-and-loss/"),
  balanceSheet: () => request<BalanceSheet>("/api/accounting/reports/balance-sheet/"),
  cashFlow: () => request<CashFlow>("/api/accounting/reports/cash-flow/"),

  // --- Financial Periods ---
  listFinancialPeriods: () => request<FinancialPeriod[]>("/api/accounting/financial-periods/"),
  createFinancialPeriod: (data: { label: string; start_date: string; end_date: string }) =>
    request<FinancialPeriod>("/api/accounting/financial-periods/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  closeFinancialPeriod: (id: number) =>
    request<FinancialPeriod>(`/api/accounting/financial-periods/${id}/close/`, { method: "POST" }),

  // --- Bank Accounts & Reconciliation ---
  listBankAccounts: () => request<BankAccount[]>("/api/accounting/bank-accounts/"),
  createBankAccount: (data: Partial<BankAccount>) =>
    request<BankAccount>("/api/accounting/bank-accounts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBankAccount: (id: number, data: Partial<BankAccount>) =>
    request<BankAccount>(`/api/accounting/bank-accounts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteBankAccount: (id: number) =>
    request<void>(`/api/accounting/bank-accounts/${id}/`, { method: "DELETE" }),
  listBankStatementLines: (bankAccount?: number) =>
    request<BankStatementLine[]>(
      `/api/accounting/bank-statement-lines/${bankAccount ? `?bank_account=${bankAccount}` : ""}`
    ),
  createBankStatementLine: (data: Partial<BankStatementLine>) =>
    request<BankStatementLine>("/api/accounting/bank-statement-lines/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBankStatementLine: (id: number, data: Partial<BankStatementLine>) =>
    request<BankStatementLine>(`/api/accounting/bank-statement-lines/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteBankStatementLine: (id: number) =>
    request<void>(`/api/accounting/bank-statement-lines/${id}/`, { method: "DELETE" }),

  // --- Petty Cash ---
  listPettyCashFunds: () => request<PettyCashFund[]>("/api/accounting/petty-cash-funds/"),
  createPettyCashFund: (data: Partial<PettyCashFund>) =>
    request<PettyCashFund>("/api/accounting/petty-cash-funds/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePettyCashFund: (id: number, data: Partial<PettyCashFund>) =>
    request<PettyCashFund>(`/api/accounting/petty-cash-funds/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePettyCashFund: (id: number) =>
    request<void>(`/api/accounting/petty-cash-funds/${id}/`, { method: "DELETE" }),
  listPettyCashTransactions: (fund?: number) =>
    request<PettyCashTransaction[]>(
      `/api/accounting/petty-cash-transactions/${fund ? `?fund=${fund}` : ""}`
    ),
  createPettyCashTransaction: (data: {
    fund: number;
    type: PettyCashTransaction["type"];
    category?: string;
    description?: string;
    amount_cents: number;
    date: string;
  }) =>
    request<PettyCashTransaction>("/api/accounting/petty-cash-transactions/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Budgets ---
  listBudgets: () => request<Budget[]>("/api/accounting/budgets/"),
  createBudget: (data: Partial<Budget>) =>
    request<Budget>("/api/accounting/budgets/", { method: "POST", body: JSON.stringify(data) }),
  updateBudget: (id: number, data: Partial<Budget>) =>
    request<Budget>(`/api/accounting/budgets/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteBudget: (id: number) => request<void>(`/api/accounting/budgets/${id}/`, { method: "DELETE" }),
  budgetVsActual: () =>
    request<BudgetVsActualRow[]>("/api/accounting/reports/budget-vs-actual/"),

  // --- Fixed Assets ---
  listFixedAssets: () => request<FixedAsset[]>("/api/accounting/fixed-assets/"),
  createFixedAsset: (data: Partial<FixedAsset>) =>
    request<FixedAsset>("/api/accounting/fixed-assets/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFixedAsset: (id: number, data: Partial<FixedAsset>) =>
    request<FixedAsset>(`/api/accounting/fixed-assets/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteFixedAsset: (id: number) =>
    request<void>(`/api/accounting/fixed-assets/${id}/`, { method: "DELETE" }),
  depreciateFixedAsset: (id: number) =>
    request<FixedAsset>(`/api/accounting/fixed-assets/${id}/depreciate/`, { method: "POST" }),

  // --- Documents ---
  listDocuments: (target: RecordTarget) =>
    request<Document[]>(
      `/api/documents/?app_label=${target.appLabel}&model=${target.model}&object_id=${target.objectId}`
    ),
  uploadDocument: (target: RecordTarget, file: File) => {
    const form = new FormData();
    form.append("app_label", target.appLabel);
    form.append("model", target.model);
    form.append("object_id", String(target.objectId));
    form.append("file", file);
    return request<Document>("/api/documents/", { method: "POST", body: form });
  },
  deleteDocument: (id: number) => request<void>(`/api/documents/${id}/`, { method: "DELETE" }),
  documentDownloadUrl: (id: number) => `${API_URL}/api/documents/${id}/download/`,

  // --- Notes ---
  listNotes: (target: RecordTarget) =>
    request<Note[]>(
      `/api/notes/?app_label=${target.appLabel}&model=${target.model}&object_id=${target.objectId}`
    ),
  createNote: (target: RecordTarget, body: string) =>
    request<Note>("/api/notes/", {
      method: "POST",
      body: JSON.stringify({ app_label: target.appLabel, model: target.model, object_id: target.objectId, body }),
    }),
  updateNote: (id: number, body: string) =>
    request<Note>(`/api/notes/${id}/`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deleteNote: (id: number) => request<void>(`/api/notes/${id}/`, { method: "DELETE" }),

  // --- Activity ---
  listActivity: (target: RecordTarget) =>
    request<Activity[]>(
      `/api/activity/?app_label=${target.appLabel}&model=${target.model}&object_id=${target.objectId}`
    ),

  // --- Approvals ---
  listApprovals: (target: RecordTarget) =>
    request<ApprovalRequestEntry[]>(
      `/api/approvals/?app_label=${target.appLabel}&model=${target.model}&object_id=${target.objectId}`
    ),
  requestApproval: (target: RecordTarget, note: string) =>
    request<ApprovalRequestEntry>("/api/approvals/", {
      method: "POST",
      body: JSON.stringify({ app_label: target.appLabel, model: target.model, object_id: target.objectId, note }),
    }),
  approveRequest: (id: number) =>
    request<ApprovalRequestEntry>(`/api/approvals/${id}/approve/`, { method: "POST" }),
  rejectRequest: (id: number, decision_note: string) =>
    request<ApprovalRequestEntry>(`/api/approvals/${id}/reject/`, {
      method: "POST",
      body: JSON.stringify({ decision_note }),
    }),

  // --- Global search ---
  globalSearch: (q: string) => request<SearchResult[]>(`/api/search/?q=${encodeURIComponent(q)}`),

  // --- Audit log ---
  listAuditLog: () => request<AuditLogEntry[]>("/api/audit-log/"),

  // --- Notifications ---
  listNotifications: () => request<Notification[]>("/api/notifications/"),
  unreadNotificationCount: () => request<{ count: number }>("/api/notifications/unread_count/"),
  markNotificationRead: (id: number) =>
    request<Notification>(`/api/notifications/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_read: true }),
    }),
  markAllNotificationsRead: () => request<void>("/api/notifications/mark_all_read/", { method: "POST" }),

  // --- Tasks ---
  listTasks: () => request<Task[]>("/api/tasks/"),
  createTask: (data: {
    title: string;
    description?: string;
    assignee?: number | null;
    due_date?: string | null;
    status?: Task["status"];
  }) => request<Task>("/api/tasks/", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (
    id: number,
    data: {
      title: string;
      description?: string;
      assignee?: number | null;
      due_date?: string | null;
      status?: Task["status"];
    }
  ) => request<Task>(`/api/tasks/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}/`, { method: "DELETE" }),

  // --- Calendar ---
  listEvents: () => request<Event[]>("/api/calendar/events/"),
  createEvent: (data: { title: string; description?: string; start_at: string; end_at?: string | null; all_day?: boolean }) =>
    request<Event>("/api/calendar/events/", { method: "POST", body: JSON.stringify(data) }),
  updateEvent: (
    id: number,
    data: { title: string; description?: string; start_at: string; end_at?: string | null; all_day?: boolean }
  ) => request<Event>(`/api/calendar/events/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEvent: (id: number) => request<void>(`/api/calendar/events/${id}/`, { method: "DELETE" }),

  // --- Company dashboard summary ---
  companySummary: () => request<CompanySummary>("/api/dashboard/summary/"),
};
