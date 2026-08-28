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

// --- Cost Centers ---

export interface CostCenter {
  id: number;
  name: string;
  code: string;
  description: string;
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

export interface Position {
  id: number;
  title: string;
  department: number | null;
  created_at: string;
}

export interface SalaryStructure {
  id: number;
  name: string;
  base_salary_cents: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface ShiftTemplate {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  scheduled_hours: number;
  created_at: string;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: number | null;
  department: number | null;
  branch: number | null;
  shift: number | null;
  cost_center: number | null;
  manager: number | null;
  manager_name: string;
  salary_structure: number | null;
  effective_salary_cents: number;
  salary_cents: number;
  joining_date: string | null;
  status: "active" | "on_leave" | "terminated";
  user: number | null;
  user_name: string;
  payment_method: "bank_transfer" | "cash" | "mobile_money";
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  national_id: string;
  passport_number: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | "";
  marital_status: "single" | "married" | "divorced" | "widowed" | "";
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  employee: number;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "absent" | "late" | "half_day";
  source: "manual" | "device_import";
  notes: string;
  worked_hours: number;
  overtime_hours: number;
  created_at: string;
}

// --- Payroll ---

export interface SalaryComponent {
  id: number;
  name: string;
  category: "earning" | "deduction";
  is_taxable: boolean;
  created_at: string;
}

export interface EmployeeSalaryComponent {
  id: number;
  employee: number;
  component: number;
  component_name: string;
  component_category: "earning" | "deduction";
  amount_cents: number;
  created_at: string;
}

export interface PayrollRun {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "draft" | "processed" | "paid";
  processed_at: string | null;
  paid_at: string | null;
  total_net_pay_cents: number;
  created_at: string;
}

export interface PayslipLine {
  id: number;
  label: string;
  line_type: "earning" | "deduction";
  amount_cents: number;
  source_loan: number | null;
}

export interface Payslip {
  id: number;
  payroll_run: number;
  employee: number;
  gross_cents: number;
  taxable_income_cents: number;
  paye_tax_cents: number;
  pension_employee_cents: number;
  pension_employer_cents: number;
  other_deductions_cents: number;
  loan_repayment_cents: number;
  net_pay_cents: number;
  lines: PayslipLine[];
  created_at: string;
}

export interface Loan {
  id: number;
  loan_number: string;
  employee: number;
  employee_name: string;
  principal_cents: number;
  term_months: number;
  start_date: string;
  status: "active" | "paid_off" | "cancelled";
  notes: string;
  monthly_installment_cents: number;
  repaid_cents: number;
  remaining_balance_cents: number;
  created_at: string;
}

export interface TaxBracket {
  id: number;
  lower_bound_cents: number;
  upper_bound_cents: number | null;
  rate_percent: string;
  is_active: boolean;
  created_at: string;
}

export interface PensionSettings {
  id: number;
  employee_rate_percent: string;
  employer_rate_percent: string;
  created_at: string;
}

export interface OvertimeSettings {
  id: number;
  standard_hours_per_day: string;
  working_days_per_month: number;
  rate_multiplier: string;
  created_at: string;
}

// --- Recruitment ---

export interface JobVacancy {
  id: number;
  title: string;
  department: number | null;
  position: number | null;
  description: string;
  openings: number;
  status: "open" | "on_hold" | "closed";
  posted_date: string;
  applicant_count: number;
  created_at: string;
}

export interface Applicant {
  id: number;
  vacancy: number;
  vacancy_title: string;
  full_name: string;
  email: string;
  phone: string;
  status: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  applied_date: string;
  notes: string;
  hired_employee: number | null;
  referred_by: number | null;
  referred_by_name: string;
  created_at: string;
}

export interface OnboardingTask {
  id: number;
  employee: number;
  title: string;
  is_complete: boolean;
  due_date: string | null;
  created_at: string;
}

// --- Performance & Training ---

export interface PerformanceReview {
  id: number;
  employee: number;
  reviewer: number | null;
  review_period: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  comments: string;
  status: "draft" | "completed";
  completed_at: string | null;
  created_at: string;
}

export interface TrainingProgram {
  id: number;
  title: string;
  description: string;
  provider: string;
  start_date: string;
  end_date: string | null;
  enrollment_count: number;
  created_at: string;
}

export interface TrainingEnrollment {
  id: number;
  program: number;
  program_title: string;
  employee: number;
  status: "enrolled" | "completed" | "cancelled";
  completion_date: string | null;
  created_at: string;
}

// --- Employee Self-Service ---

export interface MyLeaveRequest {
  id: number;
  leave_type: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled";
  days: number;
  created_at: string;
}

export interface MyOnboardingTask {
  id: number;
  title: string;
  is_complete: boolean;
  due_date: string | null;
  created_at: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  created_at: string;
}

export interface EmployeeSkill {
  id: number;
  employee: number;
  employee_name: string;
  skill: number;
  skill_name: string;
  skill_category: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
  created_at: string;
}

export interface EmployeeContract {
  id: number;
  employee: number;
  contract_type: "permanent" | "fixed_term" | "probation" | "contractor";
  start_date: string;
  end_date: string | null;
  salary_cents: number;
  notes: string;
  created_at: string;
}

export interface EmployeeDocument {
  id: number;
  employee: number;
  employee_name: string;
  doc_type: "id_card" | "passport" | "contract" | "certificate" | "work_permit" | "health_check" | "other";
  doc_type_display: string;
  expiry_date: string | null;
  notes: string;
  created_at: string;
}

export interface ShiftAssignment {
  id: number;
  employee: number;
  employee_name: string;
  shift_template: number;
  shift_template_name: string;
  start_time: string;
  end_time: string;
  date: string;
  notes: string;
  created_at: string;
}

export interface ShiftSwapRequest {
  id: number;
  assignment: number;
  current_employee_name: string;
  shift_template_name: string;
  date: string;
  proposed_employee: number;
  proposed_employee_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  resolved_at: string | null;
  created_at: string;
}

export interface Offboarding {
  id: number;
  employee: number;
  employee_name: string;
  reason: "resignation" | "termination" | "retirement" | "other";
  reason_display: string;
  resignation_date: string;
  last_working_day: string;
  exit_interview_notes: string;
  clearance_it: boolean;
  clearance_finance: boolean;
  clearance_admin: boolean;
  status: "in_progress" | "completed";
  completed_at: string | null;
  created_at: string;
}

export interface LeaveType {
  id: number;
  name: string;
  paid: boolean;
  default_days_per_year: number;
  accrual_enabled: boolean;
  accrual_rate_days_per_month: string;
  carryover_cap_days: number;
  created_at: string;
}

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  employee: number;
  leave_type: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled";
  days: number;
  created_at: string;
}

export interface LeaveBalance {
  leave_type: number;
  leave_type_name: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
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
  applies_to_room_charges: boolean;
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

export interface StorageLocation {
  id: number;
  warehouse: number;
  name: string;
  code: string;
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
  location: number | null;
  type: "in" | "out" | "transfer" | "adjustment";
  quantity: number;
  reference: string;
  created_at: string;
}

export interface ReorderSuggestion {
  item_id: number;
  item_name: string;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  minimum_stock: number;
  suggested_quantity: number;
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
  id_type: "" | "national_id" | "passport" | "driving_license";
  id_number: string;
  nationality: string;
  id_expiry_date: string | null;
  id_document: string | null;
  is_registered: boolean;
  created_at: string;
}

export interface TravelAgency {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  commission_rate_percent: string;
  is_active: boolean;
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
  // SalesOrder lines only (not Quotation) — see SalesOrderLine.dispatched_quantity.
  dispatched_quantity?: number;
  outstanding_quantity?: number;
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

export interface PublicMenu {
  company_name: string;
  table_name: string | null;
  items: {
    id: number;
    name: string;
    description: string;
    category: string;
    price_cents: number;
  }[];
}

// --- Hotel: Front Office & Room Management ---

export interface Building {
  id: number;
  name: string;
  branch: number | null;
  created_at: string;
}

export interface Floor {
  id: number;
  building: number;
  name: string;
  level: number;
  created_at: string;
}

export interface RoomType {
  id: number;
  name: string;
  description: string;
  base_rate_cents: number;
  max_occupancy: number;
  amenities: string;
  created_at: string;
}

export interface SeasonalRate {
  id: number;
  room_type: number;
  room_type_name: string;
  name: string;
  start_date: string;
  end_date: string;
  rate_cents: number;
  created_at: string;
}

export interface SuggestedRate {
  base_rate_cents: number;
  occupancy_percent: number;
  surge_percent: number;
  suggested_rate_cents: number;
  seasonal_rate_name: string | null;
}

export type RoomStatus =
  | "available"
  | "occupied"
  | "dirty"
  | "clean"
  | "inspected"
  | "out_of_order"
  | "maintenance";

export interface Room {
  id: number;
  floor: number;
  room_type: number;
  room_type_name: string;
  number: string;
  status: RoomStatus;
  created_at: string;
}

export interface RoomStatusLog {
  id: number;
  room: number;
  status: RoomStatus;
  changed_by: number | null;
  changed_by_name: string | null;
  created_at: string;
}

export type ReservationStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";

export interface RoomTransfer {
  id: number;
  from_room: number;
  from_room_number: string;
  to_room: number;
  to_room_number: string;
  reason: string;
  created_at: string;
}

export interface Reservation {
  id: number;
  guest: number;
  guest_name: string;
  room_type: number;
  room_type_name: string;
  room: number | null;
  room_number: string | null;
  source: "website" | "walk_in" | "phone" | "travel_agency" | "group";
  travel_agency: number | null;
  travel_agency_name: string;
  commission_cents: number;
  group: number | null;
  group_name: string;
  status: ReservationStatus;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate_cents: number;
  confirmation_number: string;
  room_transfers: RoomTransfer[];
  late_checkout_approved: boolean;
  early_checkin_approved: boolean;
  created_at: string;
}

export interface RoomBlock {
  id: number;
  room: number;
  room_number: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

export interface GroupReservation {
  id: number;
  name: string;
  organizer: number;
  organizer_name: string;
  check_in_date: string;
  check_out_date: string;
  notes: string;
  reservations: Reservation[];
  created_at: string;
}

export interface FolioCharge {
  id: number;
  folio: number;
  source_module: "room" | "restaurant" | "bar" | "spa" | "laundry" | "conference" | "misc";
  description: string;
  amount_cents: number;
  tax_amount_cents: number;
  created_at: string;
}

export interface GuestPayment {
  id: number;
  folio: number;
  method: "cash" | "card" | "mobile_money" | "bank_transfer";
  amount_cents: number;
  reference: string;
  received_by: number | null;
  received_by_name: string;
  created_at: string;
}

export interface GuestRefund {
  id: number;
  folio: number;
  payment: number | null;
  amount_cents: number;
  reason: string;
  issued_by: number | null;
  issued_by_name: string;
  created_at: string;
}

export interface GuestFolio {
  id: number;
  reservation: number;
  status: "open" | "closed";
  balance_cents: number;
  charges: FolioCharge[];
  payments: GuestPayment[];
  refunds: GuestRefund[];
  created_at: string;
}

// --- Housekeeping ---

export type HousekeepingTaskType = "cleaning" | "inspection" | "linen" | "lost_and_found";
export type HousekeepingTaskStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface HousekeepingTask {
  id: number;
  room: number;
  room_number: string;
  task_type: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  assigned_to: number | null;
  assigned_to_name: string | null;
  notes: string;
  scheduled_date: string | null;
  created_at: string;
}

// --- Maintenance ---

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type WorkOrderStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface WorkOrderPart {
  id: number;
  work_order: number;
  item: number;
  item_name: string;
  warehouse: number;
  warehouse_name: string;
  quantity: number;
  movement: number;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  room: number;
  room_number: string;
  asset: number | null;
  asset_name: string | null;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  reported_by: number | null;
  reported_by_name: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  resolved_at: string | null;
  schedule: number | null;
  parts_used: WorkOrderPart[];
  created_at: string;
}

export interface MaintenanceSchedule {
  id: number;
  room: number;
  room_number: string;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  frequency_days: number;
  next_due_date: string;
  is_active: boolean;
  is_due: boolean;
  created_at: string;
}

export type AssetCategory = "furniture" | "electronics" | "hvac" | "kitchen_equipment" | "vehicle" | "other";
export type AssetStatus = "in_service" | "under_maintenance" | "retired";

export interface Asset {
  id: number;
  name: string;
  category: AssetCategory;
  room: number | null;
  room_number: string | null;
  location: string;
  serial_number: string;
  purchase_date: string | null;
  purchase_cost_cents: number | null;
  useful_life_years: number | null;
  warranty_expiry_date: string | null;
  status: AssetStatus;
  notes: string;
  created_at: string;
}

// --- POS (Restaurant / Bar) ---

export type TableArea = "restaurant" | "bar" | "outdoor";
export type TableStatus = "available" | "occupied" | "reserved";

export interface PosTable {
  id: number;
  name: string;
  area: TableArea;
  capacity: number;
  status: TableStatus;
  created_at: string;
}

export type OrderStatus = "open" | "paid" | "charged_to_room" | "cancelled";
export type KitchenStatus = "queued" | "preparing" | "ready" | "served";

export interface PosOrderLine {
  id: number;
  order: number;
  item: number;
  item_name: string;
  item_prep_time_minutes: number | null;
  quantity: number;
  unit_price_cents: number;
  kitchen_status: KitchenStatus;
  is_rush: boolean;
  started_preparing_at: string | null;
  ready_at: string | null;
  line_total_cents: number;
  created_at: string;
}

export interface PosOrder {
  id: number;
  table: number | null;
  table_name: string | null;
  reservation: number | null;
  guest: number | null;
  guest_name: string | null;
  is_vip_guest: boolean;
  tab_name: string;
  server: number | null;
  server_name: string | null;
  status: OrderStatus;
  discount_cents: number;
  promotion: number | null;
  promotion_name: string | null;
  receipt_number: string;
  subtotal_cents: number;
  total_cents: number;
  split_from: number | null;
  lines: PosOrderLine[];
  closed_at: string | null;
  created_at: string;
}

export interface HappyHourRule {
  id: number;
  name: string;
  category: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  discount_percent: string;
  is_active: boolean;
  created_at: string;
}

export interface Promotion {
  id: number;
  name: string;
  discount_percent: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface SuggestedPrice {
  base_price_cents: number;
  suggested_price_cents: number;
  happy_hour_name: string | null;
  discount_percent: number;
}

// --- Laundry ---

export type LaundryCategory = "guest" | "hotel_linen";
export type LaundryTrackingStatus = "received" | "washing" | "ready" | "delivered";
export type LaundryStatus = "open" | "paid" | "charged_to_room" | "cancelled";

export interface LaundryOrderLine {
  id: number;
  order: number;
  item: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  created_at: string;
}

export interface LaundryOrder {
  id: number;
  category: LaundryCategory;
  reservation: number | null;
  guest: number | null;
  guest_name: string | null;
  tracking_status: LaundryTrackingStatus;
  status: LaundryStatus;
  receipt_number: string;
  total_cents: number;
  lines: LaundryOrderLine[];
  notes: string;
  closed_at: string | null;
  created_at: string;
}

// --- Spa ---

export type SpaBookingStatus = "open" | "paid" | "charged_to_room" | "cancelled";
export type SpaTreatmentStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface SpaBookingLine {
  id: number;
  booking: number;
  treatment: number;
  treatment_name: string;
  therapist: number | null;
  therapist_name: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  quantity: number;
  unit_price_cents: number;
  status: SpaTreatmentStatus;
  line_total_cents: number;
  created_at: string;
}

export interface SpaBooking {
  id: number;
  reservation: number | null;
  guest: number | null;
  guest_name: string | null;
  status: SpaBookingStatus;
  receipt_number: string;
  total_cents: number;
  lines: SpaBookingLine[];
  notes: string;
  closed_at: string | null;
  created_at: string;
}

// --- Gym ---

export type GymBillingStatus = "open" | "paid" | "charged_to_room" | "cancelled";
export type GymPlanType = "monthly" | "annual";
export type GymMembershipStatus = "pending" | "active" | "expired" | "cancelled";
export type GymActivityStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface GymMembership {
  id: number;
  guest: number | null;
  guest_name: string | null;
  reservation: number | null;
  plan_type: GymPlanType;
  start_date: string;
  end_date: string;
  price_cents: number;
  status: GymBillingStatus;
  membership_status: GymMembershipStatus;
  receipt_number: string;
  closed_at: string | null;
  created_at: string;
}

export interface GymBookingLine {
  id: number;
  booking: number;
  activity: number;
  activity_name: string;
  trainer: number | null;
  trainer_name: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  quantity: number;
  unit_price_cents: number;
  status: GymActivityStatus;
  line_total_cents: number;
  created_at: string;
}

export interface GymBooking {
  id: number;
  reservation: number | null;
  guest: number | null;
  guest_name: string | null;
  status: GymBillingStatus;
  receipt_number: string;
  total_cents: number;
  lines: GymBookingLine[];
  notes: string;
  closed_at: string | null;
  created_at: string;
}

// --- Conference ---

export type ConferenceStatus = "open" | "paid" | "charged_to_room" | "cancelled";
export type ConferenceEventType = "corporate" | "wedding" | "other";
export type ConferenceSeatingPlan = "theater" | "classroom" | "banquet" | "u_shape" | "boardroom";

export interface ConferenceHall {
  id: number;
  name: string;
  capacity: number;
  day_rate_cents: number;
  description: string;
  created_at: string;
}

export interface ConferenceBookingLine {
  id: number;
  booking: number;
  item: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  created_at: string;
}

export interface ConferenceBooking {
  id: number;
  hall: number;
  hall_name: string;
  reservation: number | null;
  guest: number | null;
  guest_name: string | null;
  event_name: string;
  event_type: ConferenceEventType;
  seating_plan: ConferenceSeatingPlan;
  attendees: number;
  start_at: string;
  end_at: string;
  status: ConferenceStatus;
  receipt_number: string;
  hall_rate_cents: number;
  total_cents: number;
  lines: ConferenceBookingLine[];
  notes: string;
  closed_at: string | null;
  created_at: string;
}

// --- Loyalty ---

export interface LoyaltyTier {
  id: number;
  name: string;
  min_points: number;
  benefits: string;
  discount_percent: string;
  created_at: string;
}

export interface LoyaltyReward {
  id: number;
  name: string;
  points_cost: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface LoyaltyMember {
  id: number;
  guest: number;
  guest_name: string;
  points_balance: number;
  tier_name: string | null;
  created_at: string;
}

export interface LoyaltyTransaction {
  id: number;
  member: number;
  member_guest_name: string;
  points: number;
  reason: string;
  reservation: number | null;
  reward: number | null;
  reward_name: string | null;
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
  hotel?: {
    room_count: number;
    occupied_count: number;
    occupancy_pct: number;
    room_status_counts: Partial<Record<RoomStatus, number>>;
    today_arrivals: number;
    today_departures: number;
    revenue_by_department_cents: Record<string, number>;
    revpar_cents: number;
    pending_folio_count: number;
    recent_activity: {
      label: string;
      room_number: string;
      changed_by_name: string | null;
      created_at: string;
    }[];
  };
  housekeeping?: {
    rooms_to_clean: number;
    currently_cleaning: number;
    inspections_due: number;
    out_of_service: number;
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

  // --- Cost Centers ---
  listCostCenters: () => request<CostCenter[]>("/api/cost-centers/"),
  createCostCenter: (data: Partial<CostCenter>) =>
    request<CostCenter>("/api/cost-centers/", { method: "POST", body: JSON.stringify(data) }),
  updateCostCenter: (id: number, data: Partial<CostCenter>) =>
    request<CostCenter>(`/api/cost-centers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCostCenter: (id: number) => request<void>(`/api/cost-centers/${id}/`, { method: "DELETE" }),

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
  listPositions: () => request<Position[]>("/api/hr/positions/"),
  createPosition: (data: { title: string; department?: number | null }) =>
    request<Position>("/api/hr/positions/", { method: "POST", body: JSON.stringify(data) }),
  deletePosition: (id: number) => request<void>(`/api/hr/positions/${id}/`, { method: "DELETE" }),
  listSalaryStructures: () => request<SalaryStructure[]>("/api/hr/salary-structures/"),
  createSalaryStructure: (data: { name: string; base_salary_cents: number; description?: string }) =>
    request<SalaryStructure>("/api/hr/salary-structures/", { method: "POST", body: JSON.stringify(data) }),
  deleteSalaryStructure: (id: number) =>
    request<void>(`/api/hr/salary-structures/${id}/`, { method: "DELETE" }),
  listSkills: () => request<Skill[]>("/api/hr/skills/"),
  createSkill: (data: { name: string; category?: string }) =>
    request<Skill>("/api/hr/skills/", { method: "POST", body: JSON.stringify(data) }),
  deleteSkill: (id: number) => request<void>(`/api/hr/skills/${id}/`, { method: "DELETE" }),
  listEmployeeSkills: (employeeId?: number) =>
    request<EmployeeSkill[]>(
      `/api/hr/employee-skills/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  createEmployeeSkill: (data: {
    employee: number;
    skill: number;
    proficiency: EmployeeSkill["proficiency"];
  }) => request<EmployeeSkill>("/api/hr/employee-skills/", { method: "POST", body: JSON.stringify(data) }),
  updateEmployeeSkill: (id: number, data: { proficiency: EmployeeSkill["proficiency"] }) =>
    request<EmployeeSkill>(`/api/hr/employee-skills/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEmployeeSkill: (id: number) =>
    request<void>(`/api/hr/employee-skills/${id}/`, { method: "DELETE" }),
  listEmployeeContracts: (employeeId?: number) =>
    request<EmployeeContract[]>(
      `/api/hr/employee-contracts/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  createEmployeeContract: (data: Partial<EmployeeContract>) =>
    request<EmployeeContract>("/api/hr/employee-contracts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteEmployeeContract: (id: number) =>
    request<void>(`/api/hr/employee-contracts/${id}/`, { method: "DELETE" }),
  listOffboardings: (employeeId?: number) =>
    request<Offboarding[]>(`/api/hr/offboarding/${employeeId ? `?employee=${employeeId}` : ""}`),
  createOffboarding: (data: {
    employee: number;
    reason: Offboarding["reason"];
    resignation_date: string;
    last_working_day: string;
    exit_interview_notes?: string;
  }) => request<Offboarding>("/api/hr/offboarding/", { method: "POST", body: JSON.stringify(data) }),
  updateOffboarding: (
    id: number,
    data: Partial<
      Pick<
        Offboarding,
        | "reason"
        | "resignation_date"
        | "last_working_day"
        | "exit_interview_notes"
        | "clearance_it"
        | "clearance_finance"
        | "clearance_admin"
      >
    >
  ) => request<Offboarding>(`/api/hr/offboarding/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  completeOffboarding: (id: number) =>
    request<Offboarding>(`/api/hr/offboarding/${id}/complete/`, { method: "POST" }),
  deleteOffboarding: (id: number) => request<void>(`/api/hr/offboarding/${id}/`, { method: "DELETE" }),
  listEmployeeDocuments: (employeeId?: number) =>
    request<EmployeeDocument[]>(
      `/api/hr/employee-documents/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  expiringEmployeeDocuments: () =>
    request<EmployeeDocument[]>("/api/hr/employee-documents/expiring/"),
  createEmployeeDocument: (data: {
    employee: number;
    doc_type: EmployeeDocument["doc_type"];
    expiry_date?: string | null;
    notes?: string;
  }) => request<EmployeeDocument>("/api/hr/employee-documents/", { method: "POST", body: JSON.stringify(data) }),
  deleteEmployeeDocument: (id: number) =>
    request<void>(`/api/hr/employee-documents/${id}/`, { method: "DELETE" }),
  listShiftAssignments: (employeeId?: number) =>
    request<ShiftAssignment[]>(
      `/api/hr/shift-assignments/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  createShiftAssignment: (data: {
    employee: number;
    shift_template: number;
    date: string;
    notes?: string;
  }) => request<ShiftAssignment>("/api/hr/shift-assignments/", { method: "POST", body: JSON.stringify(data) }),
  deleteShiftAssignment: (id: number) =>
    request<void>(`/api/hr/shift-assignments/${id}/`, { method: "DELETE" }),
  listShiftSwapRequests: () => request<ShiftSwapRequest[]>("/api/hr/shift-swap-requests/"),
  createShiftSwapRequest: (data: { assignment: number; proposed_employee: number; reason?: string }) =>
    request<ShiftSwapRequest>("/api/hr/shift-swap-requests/", { method: "POST", body: JSON.stringify(data) }),
  approveShiftSwapRequest: (id: number) =>
    request<ShiftSwapRequest>(`/api/hr/shift-swap-requests/${id}/approve/`, { method: "POST" }),
  rejectShiftSwapRequest: (id: number) =>
    request<ShiftSwapRequest>(`/api/hr/shift-swap-requests/${id}/reject/`, { method: "POST" }),
  deleteShiftSwapRequest: (id: number) =>
    request<void>(`/api/hr/shift-swap-requests/${id}/`, { method: "DELETE" }),
  listLeaveTypes: () => request<LeaveType[]>("/api/hr/leave-types/"),
  createLeaveType: (data: {
    name: string;
    paid: boolean;
    default_days_per_year?: number;
    accrual_enabled?: boolean;
    accrual_rate_days_per_month?: string;
    carryover_cap_days?: number;
  }) => request<LeaveType>("/api/hr/leave-types/", { method: "POST", body: JSON.stringify(data) }),
  listPublicHolidays: () => request<PublicHoliday[]>("/api/hr/public-holidays/"),
  createPublicHoliday: (data: { name: string; date: string }) =>
    request<PublicHoliday>("/api/hr/public-holidays/", { method: "POST", body: JSON.stringify(data) }),
  deletePublicHoliday: (id: number) =>
    request<void>(`/api/hr/public-holidays/${id}/`, { method: "DELETE" }),
  listLeaveRequests: (employeeId?: number) =>
    request<LeaveRequest[]>(
      `/api/hr/leave-requests/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  createLeaveRequest: (data: {
    employee: number;
    leave_type: number;
    start_date: string;
    end_date: string;
    reason?: string;
  }) => request<LeaveRequest>("/api/hr/leave-requests/", { method: "POST", body: JSON.stringify(data) }),
  deleteLeaveRequest: (id: number) =>
    request<void>(`/api/hr/leave-requests/${id}/`, { method: "DELETE" }),
  cancelLeaveRequest: (id: number) =>
    request<LeaveRequest>(`/api/hr/leave-requests/${id}/cancel/`, { method: "POST" }),
  leaveBalances: (employeeId: number, year?: number) =>
    request<LeaveBalance[]>(
      `/api/hr/leave-requests/balances/?employee=${employeeId}${year ? `&year=${year}` : ""}`
    ),
  listShifts: () => request<ShiftTemplate[]>("/api/hr/shifts/"),
  createShift: (data: { name: string; start_time: string; end_time: string; break_minutes?: number }) =>
    request<ShiftTemplate>("/api/hr/shifts/", { method: "POST", body: JSON.stringify(data) }),
  deleteShift: (id: number) => request<void>(`/api/hr/shifts/${id}/`, { method: "DELETE" }),
  listAttendance: (params?: { employee?: number; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.employee) qs.set("employee", String(params.employee));
    if (params?.date) qs.set("date", params.date);
    const query = qs.toString();
    return request<AttendanceRecord[]>(`/api/hr/attendance/${query ? `?${query}` : ""}`);
  },
  createAttendance: (data: {
    employee: number;
    date: string;
    clock_in?: string | null;
    clock_out?: string | null;
    status?: AttendanceRecord["status"];
    notes?: string;
  }) => request<AttendanceRecord>("/api/hr/attendance/", { method: "POST", body: JSON.stringify(data) }),
  deleteAttendance: (id: number) => request<void>(`/api/hr/attendance/${id}/`, { method: "DELETE" }),
  importAttendance: (
    records: { employee: number; date: string; clock_in?: string; clock_out?: string; status?: string }[]
  ) =>
    request<AttendanceRecord[]>("/api/hr/attendance/import_records/", {
      method: "POST",
      body: JSON.stringify({ records }),
    }),

  // --- Payroll ---
  listSalaryComponents: () => request<SalaryComponent[]>("/api/payroll/salary-components/"),
  createSalaryComponent: (data: { name: string; category: SalaryComponent["category"]; is_taxable?: boolean }) =>
    request<SalaryComponent>("/api/payroll/salary-components/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSalaryComponent: (id: number) =>
    request<void>(`/api/payroll/salary-components/${id}/`, { method: "DELETE" }),
  listEmployeeSalaryComponents: (employeeId?: number) =>
    request<EmployeeSalaryComponent[]>(
      `/api/payroll/employee-salary-components/${employeeId ? `?employee=${employeeId}` : ""}`
    ),
  createEmployeeSalaryComponent: (data: { employee: number; component: number; amount_cents: number }) =>
    request<EmployeeSalaryComponent>("/api/payroll/employee-salary-components/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteEmployeeSalaryComponent: (id: number) =>
    request<void>(`/api/payroll/employee-salary-components/${id}/`, { method: "DELETE" }),
  listPayrollRuns: () => request<PayrollRun[]>("/api/payroll/runs/"),
  createPayrollRun: (data: { label: string; start_date: string; end_date: string }) =>
    request<PayrollRun>("/api/payroll/runs/", { method: "POST", body: JSON.stringify(data) }),
  deletePayrollRun: (id: number) => request<void>(`/api/payroll/runs/${id}/`, { method: "DELETE" }),
  processPayrollRun: (id: number) =>
    request<PayrollRun>(`/api/payroll/runs/${id}/process/`, { method: "POST" }),
  markPayrollRunPaid: (id: number) =>
    request<PayrollRun>(`/api/payroll/runs/${id}/mark_paid/`, { method: "POST" }),
  listPayslips: (params?: { payroll_run?: number; employee?: number }) => {
    const qs = new URLSearchParams();
    if (params?.payroll_run) qs.set("payroll_run", String(params.payroll_run));
    if (params?.employee) qs.set("employee", String(params.employee));
    const query = qs.toString();
    return request<Payslip[]>(`/api/payroll/payslips/${query ? `?${query}` : ""}`);
  },
  listLoans: (employeeId?: number) =>
    request<Loan[]>(`/api/payroll/loans/${employeeId ? `?employee=${employeeId}` : ""}`),
  createLoan: (data: { employee: number; principal_cents: number; term_months: number; start_date: string; notes?: string }) =>
    request<Loan>("/api/payroll/loans/", { method: "POST", body: JSON.stringify(data) }),
  updateLoan: (id: number, data: Partial<Pick<Loan, "principal_cents" | "term_months" | "start_date" | "notes">>) =>
    request<Loan>(`/api/payroll/loans/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLoan: (id: number) => request<void>(`/api/payroll/loans/${id}/`, { method: "DELETE" }),
  cancelLoan: (id: number) => request<Loan>(`/api/payroll/loans/${id}/cancel/`, { method: "POST" }),
  listTaxBrackets: () => request<TaxBracket[]>("/api/payroll/tax-brackets/"),
  createTaxBracket: (data: { lower_bound_cents: number; upper_bound_cents: number | null; rate_percent: string }) =>
    request<TaxBracket>("/api/payroll/tax-brackets/", { method: "POST", body: JSON.stringify(data) }),
  updateTaxBracket: (id: number, data: Partial<Pick<TaxBracket, "lower_bound_cents" | "upper_bound_cents" | "rate_percent" | "is_active">>) =>
    request<TaxBracket>(`/api/payroll/tax-brackets/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTaxBracket: (id: number) => request<void>(`/api/payroll/tax-brackets/${id}/`, { method: "DELETE" }),
  getPensionSettings: () => request<PensionSettings>("/api/payroll/pension-settings/"),
  updatePensionSettings: (data: { employee_rate_percent?: string; employer_rate_percent?: string }) =>
    request<PensionSettings>("/api/payroll/pension-settings/", { method: "PATCH", body: JSON.stringify(data) }),
  getOvertimeSettings: () => request<OvertimeSettings>("/api/payroll/overtime-settings/"),
  updateOvertimeSettings: (
    data: Partial<Pick<OvertimeSettings, "standard_hours_per_day" | "working_days_per_month" | "rate_multiplier">>
  ) =>
    request<OvertimeSettings>("/api/payroll/overtime-settings/", { method: "PATCH", body: JSON.stringify(data) }),

  // --- Recruitment ---
  listJobVacancies: () => request<JobVacancy[]>("/api/recruitment/vacancies/"),
  createJobVacancy: (data: {
    title: string;
    department?: number | null;
    position?: number | null;
    description?: string;
    openings?: number;
    posted_date: string;
  }) => request<JobVacancy>("/api/recruitment/vacancies/", { method: "POST", body: JSON.stringify(data) }),
  updateJobVacancy: (id: number, data: Partial<Pick<JobVacancy, "title" | "department" | "position" | "description" | "openings" | "status">>) =>
    request<JobVacancy>(`/api/recruitment/vacancies/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteJobVacancy: (id: number) => request<void>(`/api/recruitment/vacancies/${id}/`, { method: "DELETE" }),
  listApplicants: (vacancyId?: number) =>
    request<Applicant[]>(`/api/recruitment/applicants/${vacancyId ? `?vacancy=${vacancyId}` : ""}`),
  createApplicant: (data: { vacancy: number; full_name: string; email?: string; phone?: string; applied_date: string; notes?: string; referred_by?: number | null }) =>
    request<Applicant>("/api/recruitment/applicants/", { method: "POST", body: JSON.stringify(data) }),
  updateApplicant: (id: number, data: Partial<Pick<Applicant, "status" | "notes" | "email" | "phone" | "referred_by">>) =>
    request<Applicant>(`/api/recruitment/applicants/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteApplicant: (id: number) => request<void>(`/api/recruitment/applicants/${id}/`, { method: "DELETE" }),
  hireApplicant: (id: number) => request<Applicant>(`/api/recruitment/applicants/${id}/hire/`, { method: "POST" }),
  listOnboardingTasks: (employeeId?: number) =>
    request<OnboardingTask[]>(`/api/recruitment/onboarding-tasks/${employeeId ? `?employee=${employeeId}` : ""}`),
  createOnboardingTask: (data: { employee: number; title: string; due_date?: string | null }) =>
    request<OnboardingTask>("/api/recruitment/onboarding-tasks/", { method: "POST", body: JSON.stringify(data) }),
  updateOnboardingTask: (id: number, data: Partial<Pick<OnboardingTask, "is_complete" | "title" | "due_date">>) =>
    request<OnboardingTask>(`/api/recruitment/onboarding-tasks/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteOnboardingTask: (id: number) => request<void>(`/api/recruitment/onboarding-tasks/${id}/`, { method: "DELETE" }),

  // --- Performance & Training ---
  listPerformanceReviews: (employeeId?: number) =>
    request<PerformanceReview[]>(`/api/performance/reviews/${employeeId ? `?employee=${employeeId}` : ""}`),
  createPerformanceReview: (data: { employee: number; reviewer?: number | null; review_period: string; comments?: string }) =>
    request<PerformanceReview>("/api/performance/reviews/", { method: "POST", body: JSON.stringify(data) }),
  updatePerformanceReview: (id: number, data: Partial<Pick<PerformanceReview, "rating" | "comments" | "reviewer" | "review_period">>) =>
    request<PerformanceReview>(`/api/performance/reviews/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePerformanceReview: (id: number) => request<void>(`/api/performance/reviews/${id}/`, { method: "DELETE" }),
  completePerformanceReview: (id: number) =>
    request<PerformanceReview>(`/api/performance/reviews/${id}/complete/`, { method: "POST" }),
  listTrainingPrograms: () => request<TrainingProgram[]>("/api/performance/training-programs/"),
  createTrainingProgram: (data: { title: string; description?: string; provider?: string; start_date: string; end_date?: string | null }) =>
    request<TrainingProgram>("/api/performance/training-programs/", { method: "POST", body: JSON.stringify(data) }),
  deleteTrainingProgram: (id: number) => request<void>(`/api/performance/training-programs/${id}/`, { method: "DELETE" }),
  listTrainingEnrollments: (programId?: number) =>
    request<TrainingEnrollment[]>(`/api/performance/training-enrollments/${programId ? `?program=${programId}` : ""}`),
  createTrainingEnrollment: (data: { program: number; employee: number }) =>
    request<TrainingEnrollment>("/api/performance/training-enrollments/", { method: "POST", body: JSON.stringify(data) }),
  deleteTrainingEnrollment: (id: number) =>
    request<void>(`/api/performance/training-enrollments/${id}/`, { method: "DELETE" }),
  completeTrainingEnrollment: (id: number) =>
    request<TrainingEnrollment>(`/api/performance/training-enrollments/${id}/complete/`, { method: "POST" }),
  cancelTrainingEnrollment: (id: number) =>
    request<TrainingEnrollment>(`/api/performance/training-enrollments/${id}/cancel/`, { method: "POST" }),

  // --- Employee Self-Service ---
  getMyProfile: () => request<Employee>("/api/me/profile/"),
  getMyAttendance: () => request<AttendanceRecord[]>("/api/me/attendance/"),
  listMyLeaveTypes: () => request<LeaveType[]>("/api/me/leave-types/"),
  listMyLeaveRequests: () => request<MyLeaveRequest[]>("/api/me/leave-requests/"),
  createMyLeaveRequest: (data: { leave_type: number; start_date: string; end_date: string; reason?: string }) =>
    request<MyLeaveRequest>("/api/me/leave-requests/", { method: "POST", body: JSON.stringify(data) }),
  deleteMyLeaveRequest: (id: number) => request<void>(`/api/me/leave-requests/${id}/`, { method: "DELETE" }),
  cancelMyLeaveRequest: (id: number) =>
    request<MyLeaveRequest>(`/api/me/leave-requests/${id}/cancel/`, { method: "POST" }),
  myLeaveBalances: (year?: number) =>
    request<LeaveBalance[]>(`/api/me/leave-requests/balances/${year ? `?year=${year}` : ""}`),
  submitMyLeaveRequest: (id: number) =>
    request<MyLeaveRequest>(`/api/me/leave-requests/${id}/submit/`, { method: "POST" }),
  listMyOnboardingTasks: () => request<MyOnboardingTask[]>("/api/me/onboarding-tasks/"),
  toggleMyOnboardingTask: (id: number, is_complete: boolean) =>
    request<MyOnboardingTask>(`/api/me/onboarding-tasks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_complete }),
    }),
  listMyPayslips: () => request<Payslip[]>("/api/me/payslips/"),
  listMyPerformanceReviews: () => request<PerformanceReview[]>("/api/me/performance-reviews/"),

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
  listStorageLocations: (warehouseId?: number) =>
    request<StorageLocation[]>(
      `/api/inventory/storage-locations/${warehouseId ? `?warehouse=${warehouseId}` : ""}`
    ),
  createStorageLocation: (data: { warehouse: number; name: string; code?: string }) =>
    request<StorageLocation>("/api/inventory/storage-locations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteStorageLocation: (id: number) =>
    request<void>(`/api/inventory/storage-locations/${id}/`, { method: "DELETE" }),
  reorderSuggestions: () => request<ReorderSuggestion[]>("/api/inventory/reports/reorder-suggestions/"),
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
  createCustomer: (data: Partial<Customer> | FormData) =>
    request<Customer>("/api/crm/customers/", {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
  updateCustomer: (id: number, data: Partial<Customer> | FormData) =>
    request<Customer>(`/api/crm/customers/${id}/`, {
      method: "PATCH",
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
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
  listTravelAgencies: () => request<TravelAgency[]>("/api/crm/travel-agencies/"),
  createTravelAgency: (data: Partial<TravelAgency>) =>
    request<TravelAgency>("/api/crm/travel-agencies/", { method: "POST", body: JSON.stringify(data) }),
  updateTravelAgency: (id: number, data: Partial<TravelAgency>) =>
    request<TravelAgency>(`/api/crm/travel-agencies/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTravelAgency: (id: number) => request<void>(`/api/crm/travel-agencies/${id}/`, { method: "DELETE" }),

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
  dispatchSalesOrder: (id: number, data: { warehouse: number; lines: { line: number; quantity: number }[] }) =>
    request<SalesOrder>(`/api/sales/sales-orders/${id}/dispatch/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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

  // --- Hotel: Room Management ---
  listBuildings: () => request<Building[]>("/api/hotel/buildings/"),
  createBuilding: (data: { name: string; branch?: number | null }) =>
    request<Building>("/api/hotel/buildings/", { method: "POST", body: JSON.stringify(data) }),
  listFloors: () => request<Floor[]>("/api/hotel/floors/"),
  createFloor: (data: { building: number; name: string; level?: number }) =>
    request<Floor>("/api/hotel/floors/", { method: "POST", body: JSON.stringify(data) }),
  listRoomTypes: () => request<RoomType[]>("/api/hotel/room-types/"),
  createRoomType: (data: Partial<RoomType>) =>
    request<RoomType>("/api/hotel/room-types/", { method: "POST", body: JSON.stringify(data) }),
  getSuggestedRate: (roomTypeId: number, checkInDate: string, checkOutDate: string) =>
    request<SuggestedRate>(
      `/api/hotel/room-types/${roomTypeId}/suggested_rate/?check_in_date=${checkInDate}&check_out_date=${checkOutDate}`
    ),
  listSeasonalRates: () => request<SeasonalRate[]>("/api/hotel/seasonal-rates/"),
  createSeasonalRate: (data: Partial<SeasonalRate>) =>
    request<SeasonalRate>("/api/hotel/seasonal-rates/", { method: "POST", body: JSON.stringify(data) }),
  updateSeasonalRate: (id: number, data: Partial<SeasonalRate>) =>
    request<SeasonalRate>(`/api/hotel/seasonal-rates/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSeasonalRate: (id: number) => request<void>(`/api/hotel/seasonal-rates/${id}/`, { method: "DELETE" }),
  listRooms: () => request<Room[]>("/api/hotel/rooms/"),
  createRoom: (data: { floor: number; room_type: number; number: string }) =>
    request<Room>("/api/hotel/rooms/", { method: "POST", body: JSON.stringify(data) }),
  setRoomStatus: (id: number, roomStatus: RoomStatus) =>
    request<Room>(`/api/hotel/rooms/${id}/set_status/`, {
      method: "POST",
      body: JSON.stringify({ status: roomStatus }),
    }),
  listRoomStatusLogs: (roomId: number) =>
    request<RoomStatusLog[]>(`/api/hotel/room-status-logs/?room=${roomId}`),
  listRoomBlocks: () => request<RoomBlock[]>("/api/hotel/room-blocks/"),
  createRoomBlock: (data: { room: number; start_date: string; end_date: string; reason?: string }) =>
    request<RoomBlock>("/api/hotel/room-blocks/", { method: "POST", body: JSON.stringify(data) }),
  deleteRoomBlock: (id: number) => request<void>(`/api/hotel/room-blocks/${id}/`, { method: "DELETE" }),

  // --- Hotel: Front Office ---
  listReservations: () => request<Reservation[]>("/api/hotel/reservations/"),
  createReservation: (data: {
    guest: number;
    room_type: number;
    room?: number | null;
    source: Reservation["source"];
    travel_agency?: number | null;
    check_in_date: string;
    check_out_date: string;
    adults?: number;
    children?: number;
    rate_cents?: number;
  }) => request<Reservation>("/api/hotel/reservations/", { method: "POST", body: JSON.stringify(data) }),
  assignReservationRoom: (id: number, room: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ room }),
    }),
  checkInReservation: (id: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/check_in/`, { method: "POST" }),
  checkOutReservation: (id: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/check_out/`, { method: "POST" }),
  cancelReservation: (id: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/cancel/`, { method: "POST" }),
  transferReservationRoom: (id: number, room: number, reason?: string) =>
    request<Reservation>(`/api/hotel/reservations/${id}/transfer_room/`, {
      method: "POST",
      body: JSON.stringify({ room, reason: reason ?? "" }),
    }),
  markReservationNoShow: (id: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/mark_no_show/`, { method: "POST" }),
  approveLateCheckout: (id: number, feeCents?: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/approve_late_checkout/`, {
      method: "POST",
      body: JSON.stringify({ fee_cents: feeCents ?? 0 }),
    }),
  approveEarlyCheckin: (id: number) =>
    request<Reservation>(`/api/hotel/reservations/${id}/approve_early_checkin/`, { method: "POST" }),
  listGroupReservations: () => request<GroupReservation[]>("/api/hotel/group-reservations/"),
  createGroupReservation: (data: {
    name: string;
    organizer: number;
    check_in_date: string;
    check_out_date: string;
    notes?: string;
    rooms: { guest: number; room_type: number; room?: number | null; adults?: number; children?: number }[];
  }) =>
    request<GroupReservation>("/api/hotel/group-reservations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkInGroup: (id: number) =>
    request<{ checked_in: number[]; skipped: { reservation: number; detail: unknown }[] }>(
      `/api/hotel/group-reservations/${id}/check_in_all/`,
      { method: "POST" }
    ),
  checkOutGroup: (id: number) =>
    request<{ checked_out: number[]; skipped: { reservation: number; detail: unknown }[] }>(
      `/api/hotel/group-reservations/${id}/check_out_all/`,
      { method: "POST" }
    ),

  // --- Hotel: Guest Folios ---
  listFolios: () => request<GuestFolio[]>("/api/hotel/folios/"),
  folioPdfUrl: (id: number) => `${API_URL}/api/hotel/folios/${id}/pdf/`,
  createFolioCharge: (data: {
    folio: number;
    source_module: FolioCharge["source_module"];
    description: string;
    amount_cents: number;
  }) =>
    request<FolioCharge>("/api/hotel/folio-charges/", { method: "POST", body: JSON.stringify(data) }),
  listGuestPayments: () => request<GuestPayment[]>("/api/hotel/guest-payments/"),
  createGuestPayment: (data: { folio: number; method: GuestPayment["method"]; amount_cents: number; reference?: string }) =>
    request<GuestPayment>("/api/hotel/guest-payments/", { method: "POST", body: JSON.stringify(data) }),
  listGuestRefunds: () => request<GuestRefund[]>("/api/hotel/guest-refunds/"),
  createGuestRefund: (data: { folio: number; payment?: number | null; amount_cents: number; reason?: string }) =>
    request<GuestRefund>("/api/hotel/guest-refunds/", { method: "POST", body: JSON.stringify(data) }),

  // --- Housekeeping ---
  listHousekeepingTasks: () => request<HousekeepingTask[]>("/api/housekeeping/tasks/"),
  createHousekeepingTask: (data: {
    room: number;
    task_type: HousekeepingTaskType;
    assigned_to?: number | null;
    notes?: string;
    scheduled_date?: string | null;
  }) =>
    request<HousekeepingTask>("/api/housekeeping/tasks/", { method: "POST", body: JSON.stringify(data) }),
  startHousekeepingTask: (id: number) =>
    request<HousekeepingTask>(`/api/housekeeping/tasks/${id}/start/`, { method: "POST" }),
  completeHousekeepingTask: (id: number) =>
    request<HousekeepingTask>(`/api/housekeeping/tasks/${id}/complete/`, { method: "POST" }),
  cancelHousekeepingTask: (id: number) =>
    request<HousekeepingTask>(`/api/housekeeping/tasks/${id}/cancel/`, { method: "POST" }),

  // --- Maintenance ---
  listWorkOrders: () => request<WorkOrder[]>("/api/maintenance/work-orders/"),
  createWorkOrder: (data: {
    room: number;
    asset?: number | null;
    title: string;
    description?: string;
    priority?: WorkOrderPriority;
    assigned_to?: number | null;
  }) =>
    request<WorkOrder>("/api/maintenance/work-orders/", { method: "POST", body: JSON.stringify(data) }),
  resolveWorkOrder: (id: number) =>
    request<WorkOrder>(`/api/maintenance/work-orders/${id}/resolve/`, { method: "POST" }),
  listMaintenanceSchedules: () => request<MaintenanceSchedule[]>("/api/maintenance/schedules/"),
  createMaintenanceSchedule: (data: {
    room: number;
    title: string;
    description?: string;
    priority?: WorkOrderPriority;
    frequency_days: number;
    next_due_date: string;
  }) =>
    request<MaintenanceSchedule>("/api/maintenance/schedules/", { method: "POST", body: JSON.stringify(data) }),
  updateMaintenanceSchedule: (id: number, data: Partial<MaintenanceSchedule>) =>
    request<MaintenanceSchedule>(`/api/maintenance/schedules/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  generateWorkOrderFromSchedule: (id: number) =>
    request<WorkOrder>(`/api/maintenance/schedules/${id}/generate_work_order/`, { method: "POST" }),
  listAssets: () => request<Asset[]>("/api/maintenance/assets/"),
  createAsset: (data: Partial<Asset>) =>
    request<Asset>("/api/maintenance/assets/", { method: "POST", body: JSON.stringify(data) }),
  updateAsset: (id: number, data: Partial<Asset>) =>
    request<Asset>(`/api/maintenance/assets/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAsset: (id: number) => request<void>(`/api/maintenance/assets/${id}/`, { method: "DELETE" }),
  useWorkOrderPart: (workOrderId: number, data: { item: number; warehouse: number; quantity: number }) =>
    request<WorkOrderPart>(`/api/maintenance/work-orders/${workOrderId}/use_part/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- POS ---
  getPublicMenu: (companyId: number, tableId?: number | null) =>
    request<PublicMenu>(
      `/api/pos/public/menu/?company=${companyId}${tableId ? `&table=${tableId}` : ""}`
    ),
  listTables: () => request<PosTable[]>("/api/pos/tables/"),
  createTable: (data: { name: string; area: TableArea; capacity?: number }) =>
    request<PosTable>("/api/pos/tables/", { method: "POST", body: JSON.stringify(data) }),
  listOrders: () => request<PosOrder[]>("/api/pos/orders/"),
  createOrder: (data: {
    table?: number | null;
    reservation?: number | null;
    guest?: number | null;
    tab_name?: string;
    lines: { item: number; quantity: number; unit_price_cents: number }[];
  }) => request<PosOrder>("/api/pos/orders/", { method: "POST", body: JSON.stringify(data) }),
  addOrderLine: (data: { order: number; item: number; quantity: number; unit_price_cents: number }) =>
    request<PosOrderLine>("/api/pos/order-lines/", { method: "POST", body: JSON.stringify(data) }),
  getSuggestedPrice: (itemId: number) =>
    request<SuggestedPrice>(`/api/pos/order-lines/suggested_price/?item=${itemId}`),
  chargeOrderToRoom: (id: number) =>
    request<PosOrder>(`/api/pos/orders/${id}/charge_to_room/`, { method: "POST" }),
  markOrderPaid: (id: number) => request<PosOrder>(`/api/pos/orders/${id}/mark_paid/`, { method: "POST" }),
  cancelOrder: (id: number) => request<PosOrder>(`/api/pos/orders/${id}/cancel/`, { method: "POST" }),
  splitOrder: (id: number, lineIds: number[]) =>
    request<{ original: PosOrder; new_order: PosOrder }>(`/api/pos/orders/${id}/split/`, {
      method: "POST",
      body: JSON.stringify({ line_ids: lineIds }),
    }),
  applyPromotion: (orderId: number, promotionId: number) =>
    request<PosOrder>(`/api/pos/orders/${orderId}/apply_promotion/`, {
      method: "POST",
      body: JSON.stringify({ promotion: promotionId }),
    }),
  listHappyHourRules: () => request<HappyHourRule[]>("/api/pos/happy-hour-rules/"),
  createHappyHourRule: (data: Partial<HappyHourRule>) =>
    request<HappyHourRule>("/api/pos/happy-hour-rules/", { method: "POST", body: JSON.stringify(data) }),
  updateHappyHourRule: (id: number, data: Partial<HappyHourRule>) =>
    request<HappyHourRule>(`/api/pos/happy-hour-rules/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteHappyHourRule: (id: number) =>
    request<void>(`/api/pos/happy-hour-rules/${id}/`, { method: "DELETE" }),
  listPromotions: () => request<Promotion[]>("/api/pos/promotions/"),
  createPromotion: (data: Partial<Promotion>) =>
    request<Promotion>("/api/pos/promotions/", { method: "POST", body: JSON.stringify(data) }),
  updatePromotion: (id: number, data: Partial<Promotion>) =>
    request<Promotion>(`/api/pos/promotions/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePromotion: (id: number) => request<void>(`/api/pos/promotions/${id}/`, { method: "DELETE" }),
  startPreparing: (lineId: number) =>
    request<PosOrderLine>(`/api/pos/order-lines/${lineId}/start_preparing/`, { method: "POST" }),
  markLineReady: (lineId: number) =>
    request<PosOrderLine>(`/api/pos/order-lines/${lineId}/mark_ready/`, { method: "POST" }),
  markLineServed: (lineId: number) =>
    request<PosOrderLine>(`/api/pos/order-lines/${lineId}/mark_served/`, { method: "POST" }),
  markLineRush: (lineId: number) =>
    request<PosOrderLine>(`/api/pos/order-lines/${lineId}/mark_rush/`, { method: "POST" }),
  unmarkLineRush: (lineId: number) =>
    request<PosOrderLine>(`/api/pos/order-lines/${lineId}/unmark_rush/`, { method: "POST" }),

  // --- Laundry ---
  listLaundryOrders: () => request<LaundryOrder[]>("/api/laundry/orders/"),
  createLaundryOrder: (data: {
    category: LaundryCategory;
    reservation?: number | null;
    guest?: number | null;
    notes?: string;
    lines: { item: number; quantity: number; unit_price_cents: number }[];
  }) => request<LaundryOrder>("/api/laundry/orders/", { method: "POST", body: JSON.stringify(data) }),
  addLaundryOrderLine: (data: { order: number; item: number; quantity: number; unit_price_cents: number }) =>
    request<LaundryOrderLine>("/api/laundry/order-lines/", { method: "POST", body: JSON.stringify(data) }),
  startWashingLaundryOrder: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/start_washing/`, { method: "POST" }),
  markLaundryOrderReady: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/mark_ready/`, { method: "POST" }),
  deliverLaundryOrder: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/deliver/`, { method: "POST" }),
  chargeLaundryOrderToRoom: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/charge_to_room/`, { method: "POST" }),
  markLaundryOrderPaid: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/mark_paid/`, { method: "POST" }),
  cancelLaundryOrder: (id: number) =>
    request<LaundryOrder>(`/api/laundry/orders/${id}/cancel/`, { method: "POST" }),

  // --- Spa ---
  listSpaBookings: () => request<SpaBooking[]>("/api/spa/bookings/"),
  createSpaBooking: (data: {
    reservation?: number | null;
    guest?: number | null;
    notes?: string;
    lines: {
      treatment: number;
      therapist?: number | null;
      scheduled_at?: string | null;
      duration_minutes?: number;
      quantity: number;
      unit_price_cents: number;
    }[];
  }) => request<SpaBooking>("/api/spa/bookings/", { method: "POST", body: JSON.stringify(data) }),
  addSpaBookingLine: (data: {
    booking: number;
    treatment: number;
    therapist?: number | null;
    scheduled_at?: string | null;
    duration_minutes?: number;
    quantity: number;
    unit_price_cents: number;
  }) => request<SpaBookingLine>("/api/spa/booking-lines/", { method: "POST", body: JSON.stringify(data) }),
  startSpaTreatment: (lineId: number) =>
    request<SpaBookingLine>(`/api/spa/booking-lines/${lineId}/start/`, { method: "POST" }),
  completeSpaTreatment: (lineId: number) =>
    request<SpaBookingLine>(`/api/spa/booking-lines/${lineId}/complete/`, { method: "POST" }),
  cancelSpaTreatment: (lineId: number) =>
    request<SpaBookingLine>(`/api/spa/booking-lines/${lineId}/cancel/`, { method: "POST" }),
  chargeSpaBookingToRoom: (id: number) =>
    request<SpaBooking>(`/api/spa/bookings/${id}/charge_to_room/`, { method: "POST" }),
  markSpaBookingPaid: (id: number) =>
    request<SpaBooking>(`/api/spa/bookings/${id}/mark_paid/`, { method: "POST" }),
  cancelSpaBooking: (id: number) =>
    request<SpaBooking>(`/api/spa/bookings/${id}/cancel/`, { method: "POST" }),

  // --- Gym ---
  listGymMemberships: () => request<GymMembership[]>("/api/gym/memberships/"),
  createGymMembership: (data: {
    guest?: number | null;
    reservation?: number | null;
    plan_type: GymPlanType;
    start_date: string;
    end_date: string;
    price_cents: number;
  }) => request<GymMembership>("/api/gym/memberships/", { method: "POST", body: JSON.stringify(data) }),
  chargeGymMembershipToRoom: (id: number) =>
    request<GymMembership>(`/api/gym/memberships/${id}/charge_to_room/`, { method: "POST" }),
  markGymMembershipPaid: (id: number) =>
    request<GymMembership>(`/api/gym/memberships/${id}/mark_paid/`, { method: "POST" }),
  cancelGymMembership: (id: number) =>
    request<GymMembership>(`/api/gym/memberships/${id}/cancel/`, { method: "POST" }),

  listGymBookings: () => request<GymBooking[]>("/api/gym/bookings/"),
  createGymBooking: (data: {
    reservation?: number | null;
    guest?: number | null;
    notes?: string;
    lines: {
      activity: number;
      trainer?: number | null;
      scheduled_at?: string | null;
      duration_minutes?: number;
      quantity: number;
      unit_price_cents: number;
    }[];
  }) => request<GymBooking>("/api/gym/bookings/", { method: "POST", body: JSON.stringify(data) }),
  addGymBookingLine: (data: {
    booking: number;
    activity: number;
    trainer?: number | null;
    scheduled_at?: string | null;
    duration_minutes?: number;
    quantity: number;
    unit_price_cents: number;
  }) => request<GymBookingLine>("/api/gym/booking-lines/", { method: "POST", body: JSON.stringify(data) }),
  startGymActivity: (lineId: number) =>
    request<GymBookingLine>(`/api/gym/booking-lines/${lineId}/start/`, { method: "POST" }),
  completeGymActivity: (lineId: number) =>
    request<GymBookingLine>(`/api/gym/booking-lines/${lineId}/complete/`, { method: "POST" }),
  cancelGymActivity: (lineId: number) =>
    request<GymBookingLine>(`/api/gym/booking-lines/${lineId}/cancel/`, { method: "POST" }),
  chargeGymBookingToRoom: (id: number) =>
    request<GymBooking>(`/api/gym/bookings/${id}/charge_to_room/`, { method: "POST" }),
  markGymBookingPaid: (id: number) =>
    request<GymBooking>(`/api/gym/bookings/${id}/mark_paid/`, { method: "POST" }),
  cancelGymBooking: (id: number) =>
    request<GymBooking>(`/api/gym/bookings/${id}/cancel/`, { method: "POST" }),

  // --- Conference ---
  listConferenceHalls: () => request<ConferenceHall[]>("/api/conference/halls/"),
  createConferenceHall: (data: { name: string; capacity: number; day_rate_cents: number; description?: string }) =>
    request<ConferenceHall>("/api/conference/halls/", { method: "POST", body: JSON.stringify(data) }),
  listConferenceBookings: () => request<ConferenceBooking[]>("/api/conference/bookings/"),
  createConferenceBooking: (data: {
    hall: number;
    reservation?: number | null;
    guest?: number | null;
    event_name: string;
    event_type: ConferenceEventType;
    seating_plan: ConferenceSeatingPlan;
    attendees: number;
    start_at: string;
    end_at: string;
    notes?: string;
    lines: { item: number; quantity: number; unit_price_cents: number }[];
  }) => request<ConferenceBooking>("/api/conference/bookings/", { method: "POST", body: JSON.stringify(data) }),
  addConferenceBookingLine: (data: { booking: number; item: number; quantity: number; unit_price_cents: number }) =>
    request<ConferenceBookingLine>("/api/conference/booking-lines/", { method: "POST", body: JSON.stringify(data) }),
  chargeConferenceBookingToRoom: (id: number) =>
    request<ConferenceBooking>(`/api/conference/bookings/${id}/charge_to_room/`, { method: "POST" }),
  markConferenceBookingPaid: (id: number) =>
    request<ConferenceBooking>(`/api/conference/bookings/${id}/mark_paid/`, { method: "POST" }),
  cancelConferenceBooking: (id: number) =>
    request<ConferenceBooking>(`/api/conference/bookings/${id}/cancel/`, { method: "POST" }),

  // --- Loyalty ---
  listLoyaltyTiers: () => request<LoyaltyTier[]>("/api/loyalty/tiers/"),
  createLoyaltyTier: (data: { name: string; min_points: number; benefits?: string; discount_percent?: number }) =>
    request<LoyaltyTier>("/api/loyalty/tiers/", { method: "POST", body: JSON.stringify(data) }),
  listLoyaltyRewards: () => request<LoyaltyReward[]>("/api/loyalty/rewards/"),
  createLoyaltyReward: (data: { name: string; points_cost: number; description?: string }) =>
    request<LoyaltyReward>("/api/loyalty/rewards/", { method: "POST", body: JSON.stringify(data) }),
  listLoyaltyMembers: () => request<LoyaltyMember[]>("/api/loyalty/members/"),
  enrollLoyaltyMember: (data: { guest: number }) =>
    request<LoyaltyMember>("/api/loyalty/members/", { method: "POST", body: JSON.stringify(data) }),
  listLoyaltyTransactions: () => request<LoyaltyTransaction[]>("/api/loyalty/transactions/"),
  awardLoyaltyPoints: (data: { member: number; points: number; reason: string }) =>
    request<LoyaltyTransaction>("/api/loyalty/transactions/", { method: "POST", body: JSON.stringify(data) }),
  redeemLoyaltyReward: (data: { member: number; reward: number; points: number; reason: string }) =>
    request<LoyaltyTransaction>("/api/loyalty/transactions/", { method: "POST", body: JSON.stringify(data) }),
};
