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
  reviewer_name: string;
  cycle: number | null;
  rater_type: "self" | "manager" | "peer" | "other";
  review_period: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  comments: string;
  status: "draft" | "completed";
  completed_at: string | null;
  created_at: string;
}

export interface ReviewCycle {
  id: number;
  employee: number;
  employee_name: string;
  review_period: string;
  status: "open" | "closed";
  closed_at: string | null;
  average_rating: number | null;
  review_count: number;
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

export interface Vehicle {
  id: number;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  status: "active" | "maintenance" | "retired";
  notes: string;
  current_assignee_name: string;
  created_at: string;
}

export interface VehicleAssignment {
  id: number;
  vehicle: number;
  vehicle_registration: string;
  employee: number;
  employee_name: string;
  start_date: string;
  end_date: string | null;
  notes: string;
  created_at: string;
}

// --- Manufacturing (Section I) ---

export interface WorkCenter {
  id: number;
  name: string;
  code: string;
  hourly_rate_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface Machine {
  id: number;
  work_center: number;
  work_center_name: string;
  name: string;
  code: string;
  status: "active" | "maintenance" | "retired";
  notes: string;
  created_at: string;
}

export interface MachineMaintenanceLog {
  id: number;
  machine: number;
  machine_name: string;
  performed_at: string;
  description: string;
  cost_cents: number;
  downtime_hours: string | null;
  created_at: string;
}

export interface BOMLine {
  id: number;
  component_item: number;
  component_item_name: string;
  quantity_per_unit: number;
}

export interface BOMByproduct {
  id: number;
  item: number;
  item_name: string;
  quantity_per_unit: number;
}

export interface BOMOperation {
  id: number;
  work_center: number;
  work_center_name: string;
  name: string;
  sequence: number;
  duration_minutes: string;
}

export interface BillOfMaterial {
  id: number;
  output_item: number;
  output_item_name: string;
  name: string;
  is_active: boolean;
  notes: string;
  lines: BOMLine[];
  byproducts: BOMByproduct[];
  operations: BOMOperation[];
  created_at: string;
}

export interface ManufacturingWorkOrder {
  id: number;
  production_order: number;
  work_center: number;
  work_center_name: string;
  operation_name: string;
  sequence: number;
  status: "pending" | "in_progress" | "completed";
  planned_hours: string;
  actual_hours: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string;
  created_at: string;
}

export interface MaterialConsumption {
  id: number;
  production_order: number;
  item: number;
  item_name: string;
  quantity: number;
  unit_cost_cents: number;
  created_at: string;
}

export interface ScrapEntry {
  id: number;
  production_order: number;
  item: number;
  item_name: string;
  quantity: number;
  unit_cost_cents: number;
  reason: string;
  created_at: string;
}

export interface QualityCheck {
  id: number;
  production_order: number;
  result: "pass" | "fail" | "rework";
  checked_by: number | null;
  checked_by_name: string;
  notes: string;
  created_at: string;
}

export interface ProductionOrder {
  id: number;
  number: string;
  bom: number;
  bom_name: string;
  output_item_name: string;
  warehouse: number;
  warehouse_name: string;
  quantity: number;
  produced_quantity: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  planned_start_date: string | null;
  planned_end_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string;
  work_orders: ManufacturingWorkOrder[];
  total_material_cost_cents: number;
  total_labor_cost_cents: number;
  total_scrap_cost_cents: number;
  total_cost_cents: number;
  created_at: string;
}

export interface ShortageReportRow {
  item: number;
  item_name: string;
  warehouse: number;
  warehouse_name: string;
  required_quantity: number;
  on_hand_quantity: number;
  shortage_quantity: number;
}

// --- Real Estate (Section K) ---

export interface PropertyProject {
  id: number;
  name: string;
  description: string;
  location: string;
  status: "planning" | "under_construction" | "completed" | "on_hold";
  start_date: string | null;
  expected_completion_date: string | null;
  notes: string;
  created_at: string;
}

export interface RealEstateBuilding {
  id: number;
  project: number | null;
  project_name: string;
  name: string;
  address: string;
  floors_count: number;
  notes: string;
  created_at: string;
}

export interface UnitType {
  id: number;
  name: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: string | null;
  base_sale_price_cents: number;
  base_rent_cents_monthly: number;
  created_at: string;
}

export interface PropertyUnit {
  id: number;
  building: number;
  building_name: string;
  unit_type: number | null;
  unit_type_name: string;
  unit_number: string;
  floor: number | null;
  status: "available" | "reserved" | "sold" | "rented" | "maintenance";
  notes: string;
  created_at: string;
}

export interface PropertyListing {
  id: number;
  unit: number;
  unit_label: string;
  listing_type: "sale" | "rent";
  price_cents: number;
  listed_date: string;
  status: "active" | "withdrawn" | "closed";
  description: string;
  created_at: string;
}

export interface SalesAgent {
  id: number;
  employee: number | null;
  employee_name: string;
  name: string;
  phone: string;
  email: string;
  commission_rate_percent: string;
  is_active: boolean;
  created_at: string;
}

export interface PaymentInstallment {
  id: number;
  sale: number;
  installment_number: number;
  due_date: string;
  amount_cents: number;
  paid_amount_cents: number;
  paid_date: string | null;
  status: "pending" | "paid" | "overdue";
}

export interface AgentCommission {
  id: number;
  sale: number;
  agent: number;
  agent_name: string;
  rate_percent: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_date: string | null;
}

export interface PropertySale {
  id: number;
  number: string;
  unit: number;
  unit_label: string;
  buyer: number;
  buyer_name: string;
  agent: number | null;
  agent_name: string;
  sale_price_cents: number;
  down_payment_cents: number;
  sale_date: string;
  status: "pending" | "completed" | "cancelled";
  notes: string;
  installments: PaymentInstallment[];
  commissions: AgentCommission[];
  created_at: string;
}

export interface RentPayment {
  id: number;
  lease: number;
  period_start: string;
  period_end: string;
  due_date: string;
  amount_cents: number;
  paid_amount_cents: number;
  paid_date: string | null;
  status: "pending" | "paid" | "overdue";
}

export interface LeaseContract {
  id: number;
  number: string;
  unit: number;
  unit_label: string;
  tenant: number;
  tenant_name: string;
  start_date: string;
  end_date: string;
  monthly_rent_cents: number;
  deposit_cents: number;
  status: "active" | "terminated" | "expired";
  notes: string;
  rent_payments: RentPayment[];
  created_at: string;
}

export interface PropertyMaintenanceRequest {
  id: number;
  unit: number;
  unit_label: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "completed" | "cancelled";
  reported_by: number | null;
  reported_by_name: string;
  resolved_at: string | null;
  created_at: string;
}

export interface PropertyExpense {
  id: number;
  building: number;
  building_name: string;
  unit: number | null;
  unit_label: string;
  category: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  created_at: string;
}

// --- Retail (Section L) ---

export interface Register {
  id: number;
  branch: number | null;
  branch_name: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface CashierShift {
  id: number;
  register: number;
  register_name: string;
  cashier: number;
  cashier_name: string;
  opening_float_cents: number;
  closing_amount_cents: number | null;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
}

export interface ProductVariant {
  id: number;
  item: number;
  item_name: string;
  name: string;
  sku: string;
  barcode: string;
  price_cents: number | null;
  is_active: boolean;
  created_at: string;
}

export interface RetailPromotion {
  id: number;
  name: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RetailSaleLine {
  id: number;
  item: number;
  item_name: string;
  variant: number | null;
  variant_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_percent: number;
  line_total_cents: number;
}

export interface RetailSale {
  id: number;
  number: string;
  register: number;
  register_name: string;
  shift: number;
  warehouse: number;
  customer: number | null;
  customer_name: string;
  cashier: number;
  cashier_name: string;
  promotion: number | null;
  promotion_name: string;
  payment_method: "cash" | "card" | "mobile_money" | "gift_card";
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  status: "completed" | "partially_returned" | "returned";
  lines: RetailSaleLine[];
  created_at: string;
}

export interface GiftCard {
  id: number;
  code: string;
  initial_balance_cents: number;
  balance_cents: number;
  issued_to: number | null;
  issued_to_name: string;
  issued_date: string;
  status: "active" | "redeemed" | "expired";
  created_at: string;
}

export interface GiftCardTransaction {
  id: number;
  gift_card: number;
  type: "issue" | "reload" | "redeem";
  amount_cents: number;
  sale: number | null;
  created_at: string;
}

export interface RetailReturnLine {
  id: number;
  sale_line: number;
  item_name: string;
  quantity: number;
  refund_amount_cents: number;
}

export interface RetailReturn {
  id: number;
  number: string;
  sale: number;
  sale_number: string;
  reason: string;
  refund_amount_cents: number;
  lines: RetailReturnLine[];
  created_at: string;
}

// --- Healthcare (Section M) ---

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | "";
  blood_type: string;
  phone: string;
  email: string;
  address: string;
  allergies: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
}

export interface MedicalStaff {
  id: number;
  employee: number | null;
  employee_name: string;
  role: "doctor" | "nurse";
  name: string;
  specialization: string;
  license_number: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: number;
  patient: number;
  patient_name: string;
  staff: number;
  staff_name: string;
  visit_type: "outpatient" | "inpatient" | "emergency" | "surgery";
  scheduled_at: string;
  duration_minutes: number;
  room: string;
  reason: string;
  status: "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";
  created_at: string;
}

export interface MedicalRecord {
  id: number;
  patient: number;
  patient_name: string;
  appointment: number | null;
  recorded_by: number;
  recorded_by_name: string;
  record_date: string;
  diagnosis: string;
  notes: string;
  blood_pressure: string;
  temperature_celsius: string | null;
  pulse_bpm: number | null;
  weight_kg: string | null;
  created_at: string;
}

export interface DiagnosticOrder {
  id: number;
  patient: number;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  medical_record: number | null;
  type: "lab" | "imaging";
  test_name: string;
  status: "ordered" | "in_progress" | "completed" | "cancelled";
  ordered_date: string;
  result_text: string;
  result_date: string | null;
  created_at: string;
}

export interface PrescriptionLine {
  id: number;
  item: number;
  item_name: string;
  quantity: number;
  dosage_instructions: string;
  dispensed: boolean;
}

export interface Prescription {
  id: number;
  number: string;
  patient: number;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  medical_record: number | null;
  prescribed_date: string;
  status: "active" | "filled" | "cancelled";
  lines: PrescriptionLine[];
  created_at: string;
}

export interface Bed {
  id: number;
  ward: string;
  bed_number: string;
  status: "available" | "occupied" | "maintenance";
  created_at: string;
}

export interface Admission {
  id: number;
  number: string;
  patient: number;
  patient_name: string;
  bed: number;
  bed_label: string;
  admitting_doctor: number;
  doctor_name: string;
  reason: string;
  discharged_at: string | null;
  status: "admitted" | "discharged";
  created_at: string;
}

export interface InsuranceProvider {
  id: number;
  name: string;
  contact_phone: string;
  contact_email: string;
  is_active: boolean;
  created_at: string;
}

export interface PatientInsurance {
  id: number;
  patient: number;
  patient_name: string;
  provider: number;
  provider_name: string;
  policy_number: string;
  coverage_percent: string;
  is_active: boolean;
  created_at: string;
}

export interface MedicalBillLine {
  id: number;
  description: string;
  amount_cents: number;
}

export interface MedicalBill {
  id: number;
  number: string;
  patient: number;
  patient_name: string;
  admission: number | null;
  appointment: number | null;
  patient_insurance: number | null;
  subtotal_cents: number;
  insurance_covered_cents: number;
  patient_owed_cents: number;
  paid_amount_cents: number;
  status: "pending" | "partially_paid" | "paid";
  lines: MedicalBillLine[];
  created_at: string;
}

export interface BloodUnit {
  id: number;
  blood_type: string;
  volume_ml: number;
  collected_date: string;
  expiry_date: string;
  status: "available" | "reserved" | "used" | "expired" | "discarded";
  reserved_for: number | null;
  reserved_for_name: string;
  notes: string;
  created_at: string;
}

// --- Construction (Section N) ---

export interface ConstructionProject {
  id: number;
  number: string;
  name: string;
  client: number | null;
  client_name: string;
  site_address: string;
  site_manager: number | null;
  site_manager_name: string;
  start_date: string | null;
  end_date: string | null;
  budget_cents: number;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  notes: string;
  created_at: string;
}

export interface ConstructionCosting {
  budget_cents: number;
  estimated_cents: number;
  materials_cents: number;
  labor_cents: number;
  equipment_cents: number;
  subcontract_cents: number;
  site_expenses_cents: number;
  actual_cents: number;
  variance_cents: number;
}

export interface BOQItem {
  id: number;
  project: number;
  category: string;
  description: string;
  unit: string;
  quantity: string;
  unit_cost_cents: number;
  estimated_cost_cents: number;
  created_at: string;
}

export interface Contract {
  id: number;
  number: string;
  project: number;
  contract_type: "main" | "subcontract";
  customer: number | null;
  customer_name: string;
  supplier: number | null;
  supplier_name: string;
  scope_of_work: string;
  contract_value_cents: number;
  retention_percent: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "completed" | "terminated";
  created_at: string;
}

export interface SiteLog {
  id: number;
  project: number;
  log_date: string;
  percent_complete: number;
  work_summary: string;
  weather: string;
  logged_by: number | null;
  logged_by_name: string;
  created_at: string;
}

export interface MaterialIssue {
  id: number;
  project: number;
  item: number;
  item_name: string;
  warehouse: number;
  warehouse_name: string;
  quantity: number;
  unit_cost_cents: number;
  created_at: string;
}

export interface Equipment {
  id: number;
  name: string;
  equipment_type: string;
  status: "available" | "in_use" | "maintenance" | "retired";
  notes: string;
  created_at: string;
}

export interface EquipmentAssignment {
  id: number;
  equipment: number;
  equipment_name: string;
  project: number;
  project_name: string;
  start_date: string;
  end_date: string | null;
  daily_rate_cents: number;
  created_at: string;
}

export interface LaborAssignment {
  id: number;
  employee: number;
  employee_name: string;
  project: number;
  project_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
  daily_rate_cents: number;
  created_at: string;
}

export interface SiteExpense {
  id: number;
  project: number;
  category: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  created_at: string;
}

export interface ChangeOrder {
  id: number;
  number: string;
  project: number;
  project_name: string;
  description: string;
  amount_cents: number;
  requested_date: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface QualityInspection {
  id: number;
  project: number;
  inspected_by: number | null;
  inspected_by_name: string;
  inspection_date: string;
  result: "pass" | "fail" | "conditional";
  notes: string;
  created_at: string;
}

export interface SafetyIncident {
  id: number;
  project: number;
  incident_date: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  reported_by: number | null;
  reported_by_name: string;
  corrective_action: string;
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
  barcode: string;
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
  listReviewCycles: (employeeId?: number) =>
    request<ReviewCycle[]>(`/api/performance/review-cycles/${employeeId ? `?employee=${employeeId}` : ""}`),
  createReviewCycle: (data: { employee: number; review_period: string }) =>
    request<ReviewCycle>("/api/performance/review-cycles/", { method: "POST", body: JSON.stringify(data) }),
  closeReviewCycle: (id: number) =>
    request<ReviewCycle>(`/api/performance/review-cycles/${id}/close/`, { method: "POST" }),
  deleteReviewCycle: (id: number) =>
    request<void>(`/api/performance/review-cycles/${id}/`, { method: "DELETE" }),
  listPerformanceReviews: (employeeId?: number, cycleId?: number) =>
    request<PerformanceReview[]>(
      `/api/performance/reviews/${
        employeeId || cycleId
          ? `?${[employeeId ? `employee=${employeeId}` : "", cycleId ? `cycle=${cycleId}` : ""]
              .filter(Boolean)
              .join("&")}`
          : ""
      }`
    ),
  createPerformanceReview: (data: {
    employee: number;
    reviewer?: number | null;
    cycle?: number | null;
    rater_type?: PerformanceReview["rater_type"];
    review_period: string;
    comments?: string;
  }) => request<PerformanceReview>("/api/performance/reviews/", { method: "POST", body: JSON.stringify(data) }),
  updatePerformanceReview: (id: number, data: Partial<Pick<PerformanceReview, "rating" | "comments" | "reviewer" | "review_period" | "rater_type">>) =>
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

  // --- Fleet ---
  listVehicles: () => request<Vehicle[]>("/api/fleet/vehicles/"),
  createVehicle: (data: { registration_number: string; make?: string; model?: string; year?: number | null; status?: Vehicle["status"]; notes?: string }) =>
    request<Vehicle>("/api/fleet/vehicles/", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: number, data: Partial<Pick<Vehicle, "status" | "notes" | "make" | "model" | "year">>) =>
    request<Vehicle>(`/api/fleet/vehicles/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteVehicle: (id: number) => request<void>(`/api/fleet/vehicles/${id}/`, { method: "DELETE" }),
  listVehicleAssignments: (vehicleId?: number, employeeId?: number) =>
    request<VehicleAssignment[]>(
      `/api/fleet/vehicle-assignments/${
        vehicleId || employeeId
          ? `?${[vehicleId ? `vehicle=${vehicleId}` : "", employeeId ? `employee=${employeeId}` : ""]
              .filter(Boolean)
              .join("&")}`
          : ""
      }`
    ),
  createVehicleAssignment: (data: { vehicle: number; employee: number; start_date: string; notes?: string }) =>
    request<VehicleAssignment>("/api/fleet/vehicle-assignments/", { method: "POST", body: JSON.stringify(data) }),
  endVehicleAssignment: (id: number) =>
    request<VehicleAssignment>(`/api/fleet/vehicle-assignments/${id}/end/`, { method: "POST" }),
  deleteVehicleAssignment: (id: number) =>
    request<void>(`/api/fleet/vehicle-assignments/${id}/`, { method: "DELETE" }),

  // --- Manufacturing (Section I) ---
  listWorkCenters: () => request<WorkCenter[]>("/api/manufacturing/work-centers/"),
  createWorkCenter: (data: { name: string; code?: string; hourly_rate_cents?: number; is_active?: boolean }) =>
    request<WorkCenter>("/api/manufacturing/work-centers/", { method: "POST", body: JSON.stringify(data) }),
  updateWorkCenter: (id: number, data: Partial<Pick<WorkCenter, "name" | "code" | "hourly_rate_cents" | "is_active">>) =>
    request<WorkCenter>(`/api/manufacturing/work-centers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWorkCenter: (id: number) => request<void>(`/api/manufacturing/work-centers/${id}/`, { method: "DELETE" }),

  listMachines: () => request<Machine[]>("/api/manufacturing/machines/"),
  createMachine: (data: { work_center: number; name: string; code?: string; status?: Machine["status"]; notes?: string }) =>
    request<Machine>("/api/manufacturing/machines/", { method: "POST", body: JSON.stringify(data) }),
  updateMachine: (id: number, data: Partial<Pick<Machine, "work_center" | "name" | "code" | "status" | "notes">>) =>
    request<Machine>(`/api/manufacturing/machines/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMachine: (id: number) => request<void>(`/api/manufacturing/machines/${id}/`, { method: "DELETE" }),

  listMachineMaintenanceLogs: (machineId?: number) =>
    request<MachineMaintenanceLog[]>(
      `/api/manufacturing/machine-maintenance-logs/${machineId ? `?machine=${machineId}` : ""}`
    ),
  createMachineMaintenanceLog: (data: {
    machine: number;
    performed_at: string;
    description: string;
    cost_cents?: number;
    downtime_hours?: string | null;
  }) =>
    request<MachineMaintenanceLog>("/api/manufacturing/machine-maintenance-logs/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listBOMs: () => request<BillOfMaterial[]>("/api/manufacturing/boms/"),
  createBOM: (data: {
    output_item: number;
    name: string;
    is_active?: boolean;
    notes?: string;
    lines: { component_item: number; quantity_per_unit: number }[];
    byproducts?: { item: number; quantity_per_unit: number }[];
    operations?: { work_center: number; name: string; sequence?: number; duration_minutes?: number }[];
  }) => request<BillOfMaterial>("/api/manufacturing/boms/", { method: "POST", body: JSON.stringify(data) }),
  updateBOM: (
    id: number,
    data: Partial<{
      output_item: number;
      name: string;
      is_active: boolean;
      notes: string;
      lines: { component_item: number; quantity_per_unit: number }[];
      byproducts: { item: number; quantity_per_unit: number }[];
      operations: { work_center: number; name: string; sequence?: number; duration_minutes?: number }[];
    }>
  ) => request<BillOfMaterial>(`/api/manufacturing/boms/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBOM: (id: number) => request<void>(`/api/manufacturing/boms/${id}/`, { method: "DELETE" }),

  listProductionOrders: () => request<ProductionOrder[]>("/api/manufacturing/production-orders/"),
  getProductionOrder: (id: number) => request<ProductionOrder>(`/api/manufacturing/production-orders/${id}/`),
  createProductionOrder: (data: {
    bom: number;
    warehouse: number;
    quantity: number;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    notes?: string;
  }) => request<ProductionOrder>("/api/manufacturing/production-orders/", { method: "POST", body: JSON.stringify(data) }),
  startProductionOrder: (id: number) =>
    request<ProductionOrder>(`/api/manufacturing/production-orders/${id}/start/`, { method: "POST" }),
  cancelProductionOrder: (id: number) =>
    request<ProductionOrder>(`/api/manufacturing/production-orders/${id}/cancel/`, { method: "POST" }),
  completeProductionOrder: (id: number) =>
    request<ProductionOrder>(`/api/manufacturing/production-orders/${id}/complete/`, { method: "POST" }),
  listMaterialConsumptions: (productionOrderId: number) =>
    request<MaterialConsumption[]>(`/api/manufacturing/material-consumptions/?production_order=${productionOrderId}`),
  consumeMaterial: (id: number, data: { item: number; quantity: number }) =>
    request<MaterialConsumption>(`/api/manufacturing/production-orders/${id}/consume/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  produceOutput: (id: number, data: { quantity: number }) =>
    request<ProductionOrder>(`/api/manufacturing/production-orders/${id}/produce/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getShortageReport: () => request<ShortageReportRow[]>("/api/manufacturing/production-orders/shortage-report/"),

  listManufacturingWorkOrders: (productionOrderId?: number) =>
    request<ManufacturingWorkOrder[]>(
      `/api/manufacturing/work-orders/${productionOrderId ? `?production_order=${productionOrderId}` : ""}`
    ),
  startManufacturingWorkOrder: (id: number) =>
    request<ManufacturingWorkOrder>(`/api/manufacturing/work-orders/${id}/start/`, { method: "POST" }),
  completeManufacturingWorkOrder: (id: number, actualHours?: string) =>
    request<ManufacturingWorkOrder>(`/api/manufacturing/work-orders/${id}/complete/`, {
      method: "POST",
      body: JSON.stringify(actualHours ? { actual_hours: actualHours } : {}),
    }),

  listScrapEntries: (productionOrderId?: number) =>
    request<ScrapEntry[]>(
      `/api/manufacturing/scrap-entries/${productionOrderId ? `?production_order=${productionOrderId}` : ""}`
    ),
  createScrapEntry: (data: { production_order: number; item: number; quantity: number; reason?: string }) =>
    request<ScrapEntry>("/api/manufacturing/scrap-entries/", { method: "POST", body: JSON.stringify(data) }),

  listQualityChecks: (productionOrderId?: number) =>
    request<QualityCheck[]>(
      `/api/manufacturing/quality-checks/${productionOrderId ? `?production_order=${productionOrderId}` : ""}`
    ),
  createQualityCheck: (data: { production_order: number; result: QualityCheck["result"]; notes?: string }) =>
    request<QualityCheck>("/api/manufacturing/quality-checks/", { method: "POST", body: JSON.stringify(data) }),

  // --- Real Estate (Section K) ---
  listPropertyProjects: () => request<PropertyProject[]>("/api/realestate/projects/"),
  createPropertyProject: (data: Partial<PropertyProject>) =>
    request<PropertyProject>("/api/realestate/projects/", { method: "POST", body: JSON.stringify(data) }),
  updatePropertyProject: (id: number, data: Partial<PropertyProject>) =>
    request<PropertyProject>(`/api/realestate/projects/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePropertyProject: (id: number) => request<void>(`/api/realestate/projects/${id}/`, { method: "DELETE" }),

  listRealEstateBuildings: () => request<RealEstateBuilding[]>("/api/realestate/buildings/"),
  createRealEstateBuilding: (data: { project?: number | null; name: string; address?: string; floors_count?: number; notes?: string }) =>
    request<RealEstateBuilding>("/api/realestate/buildings/", { method: "POST", body: JSON.stringify(data) }),
  updateRealEstateBuilding: (id: number, data: Partial<Pick<RealEstateBuilding, "project" | "name" | "address" | "floors_count" | "notes">>) =>
    request<RealEstateBuilding>(`/api/realestate/buildings/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRealEstateBuilding: (id: number) => request<void>(`/api/realestate/buildings/${id}/`, { method: "DELETE" }),

  listUnitTypes: () => request<UnitType[]>("/api/realestate/unit-types/"),
  createUnitType: (data: Partial<UnitType>) =>
    request<UnitType>("/api/realestate/unit-types/", { method: "POST", body: JSON.stringify(data) }),
  deleteUnitType: (id: number) => request<void>(`/api/realestate/unit-types/${id}/`, { method: "DELETE" }),

  listPropertyUnits: (buildingId?: number) =>
    request<PropertyUnit[]>(`/api/realestate/units/${buildingId ? `?building=${buildingId}` : ""}`),
  createPropertyUnit: (data: {
    building: number;
    unit_type?: number | null;
    unit_number: string;
    floor?: number | null;
    notes?: string;
  }) => request<PropertyUnit>("/api/realestate/units/", { method: "POST", body: JSON.stringify(data) }),
  updatePropertyUnit: (
    id: number,
    data: Partial<Pick<PropertyUnit, "building" | "unit_type" | "unit_number" | "floor" | "status" | "notes">>
  ) => request<PropertyUnit>(`/api/realestate/units/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePropertyUnit: (id: number) => request<void>(`/api/realestate/units/${id}/`, { method: "DELETE" }),

  listPropertyListings: () => request<PropertyListing[]>("/api/realestate/listings/"),
  createPropertyListing: (data: {
    unit: number;
    listing_type: PropertyListing["listing_type"];
    price_cents: number;
    listed_date: string;
    description?: string;
  }) => request<PropertyListing>("/api/realestate/listings/", { method: "POST", body: JSON.stringify(data) }),
  updatePropertyListing: (id: number, data: Partial<Pick<PropertyListing, "status" | "price_cents" | "description">>) =>
    request<PropertyListing>(`/api/realestate/listings/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePropertyListing: (id: number) => request<void>(`/api/realestate/listings/${id}/`, { method: "DELETE" }),

  listSalesAgents: () => request<SalesAgent[]>("/api/realestate/sales-agents/"),
  createSalesAgent: (data: {
    employee?: number | null;
    name: string;
    phone?: string;
    email?: string;
    commission_rate_percent?: string;
  }) => request<SalesAgent>("/api/realestate/sales-agents/", { method: "POST", body: JSON.stringify(data) }),
  updateSalesAgent: (id: number, data: Partial<Pick<SalesAgent, "name" | "phone" | "email" | "commission_rate_percent" | "is_active">>) =>
    request<SalesAgent>(`/api/realestate/sales-agents/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSalesAgent: (id: number) => request<void>(`/api/realestate/sales-agents/${id}/`, { method: "DELETE" }),

  listPropertySales: () => request<PropertySale[]>("/api/realestate/sales/"),
  getPropertySale: (id: number) => request<PropertySale>(`/api/realestate/sales/${id}/`),
  createPropertySale: (data: {
    unit: number;
    buyer: number;
    agent?: number | null;
    sale_price_cents: number;
    down_payment_cents?: number;
    sale_date: string;
    notes?: string;
  }) => request<PropertySale>("/api/realestate/sales/", { method: "POST", body: JSON.stringify(data) }),
  generateInstallments: (saleId: number, data: { count: number; start_date: string }) =>
    request<PropertySale>(`/api/realestate/sales/${saleId}/generate_installments/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completePropertySale: (id: number) =>
    request<PropertySale>(`/api/realestate/sales/${id}/complete/`, { method: "POST" }),
  cancelPropertySale: (id: number) =>
    request<PropertySale>(`/api/realestate/sales/${id}/cancel/`, { method: "POST" }),
  recordInstallmentPayment: (id: number, paidDate?: string) =>
    request<PaymentInstallment>(`/api/realestate/installments/${id}/record_payment/`, {
      method: "POST",
      body: JSON.stringify(paidDate ? { paid_date: paidDate } : {}),
    }),
  listAgentCommissions: (params?: { sale?: number; agent?: number }) => {
    const qs = new URLSearchParams();
    if (params?.sale) qs.set("sale", String(params.sale));
    if (params?.agent) qs.set("agent", String(params.agent));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<AgentCommission[]>(`/api/realestate/commissions/${suffix}`);
  },
  markCommissionPaid: (id: number) =>
    request<AgentCommission>(`/api/realestate/commissions/${id}/mark_paid/`, { method: "POST" }),

  listLeaseContracts: () => request<LeaseContract[]>("/api/realestate/leases/"),
  getLeaseContract: (id: number) => request<LeaseContract>(`/api/realestate/leases/${id}/`),
  createLeaseContract: (data: {
    unit: number;
    tenant: number;
    start_date: string;
    end_date: string;
    monthly_rent_cents: number;
    deposit_cents?: number;
    notes?: string;
  }) => request<LeaseContract>("/api/realestate/leases/", { method: "POST", body: JSON.stringify(data) }),
  generateRentSchedule: (leaseId: number) =>
    request<LeaseContract>(`/api/realestate/leases/${leaseId}/generate_rent_schedule/`, { method: "POST" }),
  terminateLease: (id: number) =>
    request<LeaseContract>(`/api/realestate/leases/${id}/terminate/`, { method: "POST" }),
  recordRentPayment: (id: number, paidDate?: string) =>
    request<RentPayment>(`/api/realestate/rent-payments/${id}/record_payment/`, {
      method: "POST",
      body: JSON.stringify(paidDate ? { paid_date: paidDate } : {}),
    }),

  listPropertyMaintenanceRequests: (unitId?: number) =>
    request<PropertyMaintenanceRequest[]>(`/api/realestate/maintenance-requests/${unitId ? `?unit=${unitId}` : ""}`),
  createPropertyMaintenanceRequest: (data: {
    unit: number;
    title: string;
    description?: string;
    priority?: PropertyMaintenanceRequest["priority"];
  }) =>
    request<PropertyMaintenanceRequest>("/api/realestate/maintenance-requests/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resolvePropertyMaintenanceRequest: (id: number) =>
    request<PropertyMaintenanceRequest>(`/api/realestate/maintenance-requests/${id}/resolve/`, { method: "POST" }),

  listPropertyExpenses: (buildingId?: number) =>
    request<PropertyExpense[]>(`/api/realestate/expenses/${buildingId ? `?building=${buildingId}` : ""}`),
  createPropertyExpense: (data: {
    building: number;
    unit?: number | null;
    category: string;
    description?: string;
    amount_cents: number;
    expense_date: string;
  }) => request<PropertyExpense>("/api/realestate/expenses/", { method: "POST", body: JSON.stringify(data) }),

  // --- Retail (Section L) ---
  listRegisters: () => request<Register[]>("/api/retail/registers/"),
  createRegister: (data: { branch?: number | null; name: string; code?: string; is_active?: boolean }) =>
    request<Register>("/api/retail/registers/", { method: "POST", body: JSON.stringify(data) }),
  updateRegister: (id: number, data: Partial<Pick<Register, "branch" | "name" | "code" | "is_active">>) =>
    request<Register>(`/api/retail/registers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRegister: (id: number) => request<void>(`/api/retail/registers/${id}/`, { method: "DELETE" }),

  listCashierShifts: (params?: { register?: number; status?: CashierShift["status"] }) => {
    const qs = new URLSearchParams();
    if (params?.register) qs.set("register", String(params.register));
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<CashierShift[]>(`/api/retail/shifts/${suffix}`);
  },
  openCashierShift: (data: { register: number; opening_float_cents?: number }) =>
    request<CashierShift>("/api/retail/shifts/", { method: "POST", body: JSON.stringify(data) }),
  closeCashierShift: (id: number, closingAmountCents: number) =>
    request<CashierShift>(`/api/retail/shifts/${id}/close/`, {
      method: "POST",
      body: JSON.stringify({ closing_amount_cents: closingAmountCents }),
    }),

  listProductVariants: (itemId?: number) =>
    request<ProductVariant[]>(`/api/retail/variants/${itemId ? `?item=${itemId}` : ""}`),
  createProductVariant: (data: {
    item: number;
    name: string;
    sku?: string;
    barcode?: string;
    price_cents?: number | null;
  }) => request<ProductVariant>("/api/retail/variants/", { method: "POST", body: JSON.stringify(data) }),
  updateProductVariant: (
    id: number,
    data: Partial<Pick<ProductVariant, "name" | "sku" | "barcode" | "price_cents" | "is_active">>
  ) => request<ProductVariant>(`/api/retail/variants/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProductVariant: (id: number) => request<void>(`/api/retail/variants/${id}/`, { method: "DELETE" }),

  listRetailPromotions: () => request<RetailPromotion[]>("/api/retail/promotions/"),
  createRetailPromotion: (data: {
    name: string;
    code?: string;
    discount_type: RetailPromotion["discount_type"];
    discount_value: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active?: boolean;
  }) => request<RetailPromotion>("/api/retail/promotions/", { method: "POST", body: JSON.stringify(data) }),
  updateRetailPromotion: (id: number, data: Partial<Pick<RetailPromotion, "is_active" | "end_date">>) =>
    request<RetailPromotion>(`/api/retail/promotions/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRetailPromotion: (id: number) => request<void>(`/api/retail/promotions/${id}/`, { method: "DELETE" }),

  listRetailSales: (params?: { register?: number; shift?: number }) => {
    const qs = new URLSearchParams();
    if (params?.register) qs.set("register", String(params.register));
    if (params?.shift) qs.set("shift", String(params.shift));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<RetailSale[]>(`/api/retail/sales/${suffix}`);
  },
  getRetailSale: (id: number) => request<RetailSale>(`/api/retail/sales/${id}/`),
  checkoutRetailSale: (data: {
    register: number;
    shift: number;
    warehouse: number;
    customer?: number | null;
    promotion?: number | null;
    payment_method: RetailSale["payment_method"];
    lines: {
      item: number;
      variant?: number | null;
      quantity: number;
      unit_price_cents: number;
      discount_percent?: number;
    }[];
  }) => request<RetailSale>("/api/retail/sales/", { method: "POST", body: JSON.stringify(data) }),

  listGiftCards: () => request<GiftCard[]>("/api/retail/gift-cards/"),
  issueGiftCard: (data: {
    code: string;
    initial_balance_cents: number;
    issued_to?: number | null;
    issued_date: string;
  }) => request<GiftCard>("/api/retail/gift-cards/", { method: "POST", body: JSON.stringify(data) }),
  redeemGiftCard: (id: number, amountCents: number, saleId?: number) =>
    request<GiftCard>(`/api/retail/gift-cards/${id}/redeem/`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: amountCents, ...(saleId ? { sale: saleId } : {}) }),
    }),
  reloadGiftCard: (id: number, amountCents: number) =>
    request<GiftCard>(`/api/retail/gift-cards/${id}/reload/`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: amountCents }),
    }),
  listGiftCardTransactions: (giftCardId: number) =>
    request<GiftCardTransaction[]>(`/api/retail/gift-card-transactions/?gift_card=${giftCardId}`),

  listRetailReturns: (saleId?: number) =>
    request<RetailReturn[]>(`/api/retail/returns/${saleId ? `?sale=${saleId}` : ""}`),
  createRetailReturn: (data: {
    sale: number;
    reason?: string;
    lines: { sale_line: number; quantity: number }[];
  }) => request<RetailReturn>("/api/retail/returns/", { method: "POST", body: JSON.stringify(data) }),

  // --- Healthcare (Section M) ---
  listPatients: () => request<Patient[]>("/api/healthcare/patients/"),
  getPatient: (id: number) => request<Patient>(`/api/healthcare/patients/${id}/`),
  createPatient: (data: Partial<Patient>) =>
    request<Patient>("/api/healthcare/patients/", { method: "POST", body: JSON.stringify(data) }),
  updatePatient: (id: number, data: Partial<Patient>) =>
    request<Patient>(`/api/healthcare/patients/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePatient: (id: number) => request<void>(`/api/healthcare/patients/${id}/`, { method: "DELETE" }),

  listMedicalStaff: (role?: MedicalStaff["role"]) =>
    request<MedicalStaff[]>(`/api/healthcare/staff/${role ? `?role=${role}` : ""}`),
  createMedicalStaff: (data: {
    employee?: number | null;
    role: MedicalStaff["role"];
    name: string;
    specialization?: string;
    license_number?: string;
    phone?: string;
    email?: string;
  }) => request<MedicalStaff>("/api/healthcare/staff/", { method: "POST", body: JSON.stringify(data) }),
  updateMedicalStaff: (
    id: number,
    data: Partial<Pick<MedicalStaff, "name" | "specialization" | "license_number" | "phone" | "email" | "is_active">>
  ) => request<MedicalStaff>(`/api/healthcare/staff/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMedicalStaff: (id: number) => request<void>(`/api/healthcare/staff/${id}/`, { method: "DELETE" }),

  listAppointments: (patientId?: number) =>
    request<Appointment[]>(`/api/healthcare/appointments/${patientId ? `?patient=${patientId}` : ""}`),
  createAppointment: (data: {
    patient: number;
    staff: number;
    visit_type?: Appointment["visit_type"];
    scheduled_at: string;
    duration_minutes?: number;
    room?: string;
    reason?: string;
  }) => request<Appointment>("/api/healthcare/appointments/", { method: "POST", body: JSON.stringify(data) }),
  checkInAppointment: (id: number) =>
    request<Appointment>(`/api/healthcare/appointments/${id}/check_in/`, { method: "POST" }),
  completeAppointment: (id: number) =>
    request<Appointment>(`/api/healthcare/appointments/${id}/complete/`, { method: "POST" }),
  cancelAppointment: (id: number) =>
    request<Appointment>(`/api/healthcare/appointments/${id}/cancel/`, { method: "POST" }),
  noShowAppointment: (id: number) =>
    request<Appointment>(`/api/healthcare/appointments/${id}/no_show/`, { method: "POST" }),

  listMedicalRecords: (patientId?: number) =>
    request<MedicalRecord[]>(`/api/healthcare/medical-records/${patientId ? `?patient=${patientId}` : ""}`),
  createMedicalRecord: (data: {
    patient: number;
    appointment?: number | null;
    recorded_by: number;
    record_date: string;
    diagnosis?: string;
    notes?: string;
    blood_pressure?: string;
    temperature_celsius?: string | null;
    pulse_bpm?: number | null;
    weight_kg?: string | null;
  }) => request<MedicalRecord>("/api/healthcare/medical-records/", { method: "POST", body: JSON.stringify(data) }),

  listDiagnosticOrders: (patientId?: number) =>
    request<DiagnosticOrder[]>(`/api/healthcare/diagnostic-orders/${patientId ? `?patient=${patientId}` : ""}`),
  createDiagnosticOrder: (data: {
    patient: number;
    doctor: number;
    medical_record?: number | null;
    type: DiagnosticOrder["type"];
    test_name: string;
    ordered_date: string;
  }) => request<DiagnosticOrder>("/api/healthcare/diagnostic-orders/", { method: "POST", body: JSON.stringify(data) }),
  completeDiagnosticOrder: (id: number, resultText?: string) =>
    request<DiagnosticOrder>(`/api/healthcare/diagnostic-orders/${id}/complete/`, {
      method: "POST",
      body: JSON.stringify(resultText !== undefined ? { result_text: resultText } : {}),
    }),
  cancelDiagnosticOrder: (id: number) =>
    request<DiagnosticOrder>(`/api/healthcare/diagnostic-orders/${id}/cancel/`, { method: "POST" }),

  listPrescriptions: (patientId?: number) =>
    request<Prescription[]>(`/api/healthcare/prescriptions/${patientId ? `?patient=${patientId}` : ""}`),
  createPrescription: (data: {
    patient: number;
    doctor: number;
    medical_record?: number | null;
    prescribed_date: string;
    lines: { item: number; quantity: number; dosage_instructions?: string }[];
  }) => request<Prescription>("/api/healthcare/prescriptions/", { method: "POST", body: JSON.stringify(data) }),
  dispensePrescription: (id: number, warehouseId: number) =>
    request<Prescription>(`/api/healthcare/prescriptions/${id}/dispense/`, {
      method: "POST",
      body: JSON.stringify({ warehouse: warehouseId }),
    }),
  cancelPrescription: (id: number) =>
    request<Prescription>(`/api/healthcare/prescriptions/${id}/cancel/`, { method: "POST" }),

  listBeds: () => request<Bed[]>("/api/healthcare/beds/"),
  createBed: (data: { ward: string; bed_number: string }) =>
    request<Bed>("/api/healthcare/beds/", { method: "POST", body: JSON.stringify(data) }),
  updateBed: (id: number, data: Partial<Pick<Bed, "ward" | "bed_number" | "status">>) =>
    request<Bed>(`/api/healthcare/beds/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBed: (id: number) => request<void>(`/api/healthcare/beds/${id}/`, { method: "DELETE" }),

  listAdmissions: (patientId?: number) =>
    request<Admission[]>(`/api/healthcare/admissions/${patientId ? `?patient=${patientId}` : ""}`),
  createAdmission: (data: { patient: number; bed: number; admitting_doctor: number; reason?: string }) =>
    request<Admission>("/api/healthcare/admissions/", { method: "POST", body: JSON.stringify(data) }),
  dischargeAdmission: (id: number) =>
    request<Admission>(`/api/healthcare/admissions/${id}/discharge/`, { method: "POST" }),

  listInsuranceProviders: () => request<InsuranceProvider[]>("/api/healthcare/insurance-providers/"),
  createInsuranceProvider: (data: { name: string; contact_phone?: string; contact_email?: string }) =>
    request<InsuranceProvider>("/api/healthcare/insurance-providers/", { method: "POST", body: JSON.stringify(data) }),
  updateInsuranceProvider: (id: number, data: Partial<Pick<InsuranceProvider, "name" | "contact_phone" | "contact_email" | "is_active">>) =>
    request<InsuranceProvider>(`/api/healthcare/insurance-providers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInsuranceProvider: (id: number) => request<void>(`/api/healthcare/insurance-providers/${id}/`, { method: "DELETE" }),

  listPatientInsurances: (patientId?: number) =>
    request<PatientInsurance[]>(`/api/healthcare/patient-insurances/${patientId ? `?patient=${patientId}` : ""}`),
  createPatientInsurance: (data: { patient: number; provider: number; policy_number: string; coverage_percent?: string }) =>
    request<PatientInsurance>("/api/healthcare/patient-insurances/", { method: "POST", body: JSON.stringify(data) }),
  updatePatientInsurance: (id: number, data: Partial<Pick<PatientInsurance, "policy_number" | "coverage_percent" | "is_active">>) =>
    request<PatientInsurance>(`/api/healthcare/patient-insurances/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

  listMedicalBills: (patientId?: number) =>
    request<MedicalBill[]>(`/api/healthcare/bills/${patientId ? `?patient=${patientId}` : ""}`),
  getMedicalBill: (id: number) => request<MedicalBill>(`/api/healthcare/bills/${id}/`),
  createMedicalBill: (data: {
    patient: number;
    admission?: number | null;
    appointment?: number | null;
    patient_insurance?: number | null;
    lines: { description: string; amount_cents: number }[];
  }) => request<MedicalBill>("/api/healthcare/bills/", { method: "POST", body: JSON.stringify(data) }),
  recordMedicalBillPayment: (id: number, amountCents: number) =>
    request<MedicalBill>(`/api/healthcare/bills/${id}/record_payment/`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: amountCents }),
    }),

  listBloodUnits: (params?: { blood_type?: string; status?: BloodUnit["status"] }) => {
    const qs = new URLSearchParams();
    if (params?.blood_type) qs.set("blood_type", params.blood_type);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<BloodUnit[]>(`/api/healthcare/blood-units/${suffix}`);
  },
  createBloodUnit: (data: { blood_type: string; volume_ml?: number; collected_date: string; expiry_date: string; notes?: string }) =>
    request<BloodUnit>("/api/healthcare/blood-units/", { method: "POST", body: JSON.stringify(data) }),
  reserveBloodUnit: (id: number, patientId: number) =>
    request<BloodUnit>(`/api/healthcare/blood-units/${id}/reserve/`, {
      method: "POST",
      body: JSON.stringify({ patient: patientId }),
    }),
  useBloodUnit: (id: number) => request<BloodUnit>(`/api/healthcare/blood-units/${id}/use/`, { method: "POST" }),
  discardBloodUnit: (id: number, reason?: string) =>
    request<BloodUnit>(`/api/healthcare/blood-units/${id}/discard/`, {
      method: "POST",
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
    }),

  // --- Construction (Section N) ---
  listConstructionProjects: () => request<ConstructionProject[]>("/api/construction/projects/"),
  getConstructionProject: (id: number) => request<ConstructionProject>(`/api/construction/projects/${id}/`),
  createConstructionProject: (data: {
    name: string;
    client?: number | null;
    site_address?: string;
    site_manager?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: ConstructionProject["status"];
    notes?: string;
  }) => request<ConstructionProject>("/api/construction/projects/", { method: "POST", body: JSON.stringify(data) }),
  updateConstructionProject: (
    id: number,
    data: Partial<Pick<ConstructionProject, "name" | "client" | "site_address" | "site_manager" | "start_date" | "end_date" | "status" | "notes">>
  ) => request<ConstructionProject>(`/api/construction/projects/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteConstructionProject: (id: number) => request<void>(`/api/construction/projects/${id}/`, { method: "DELETE" }),
  getConstructionProjectCosting: (id: number) =>
    request<ConstructionCosting>(`/api/construction/projects/${id}/costing/`),

  listBOQItems: (projectId?: number) =>
    request<BOQItem[]>(`/api/construction/boq-items/${projectId ? `?project=${projectId}` : ""}`),
  createBOQItem: (data: {
    project: number;
    category?: string;
    description: string;
    unit?: string;
    quantity?: string;
    unit_cost_cents?: number;
  }) => request<BOQItem>("/api/construction/boq-items/", { method: "POST", body: JSON.stringify(data) }),
  updateBOQItem: (id: number, data: Partial<Pick<BOQItem, "category" | "description" | "unit" | "quantity" | "unit_cost_cents">>) =>
    request<BOQItem>(`/api/construction/boq-items/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBOQItem: (id: number) => request<void>(`/api/construction/boq-items/${id}/`, { method: "DELETE" }),

  listContracts: (projectId?: number) =>
    request<Contract[]>(`/api/construction/contracts/${projectId ? `?project=${projectId}` : ""}`),
  createContract: (data: {
    project: number;
    contract_type: Contract["contract_type"];
    customer?: number | null;
    supplier?: number | null;
    scope_of_work?: string;
    contract_value_cents?: number;
    retention_percent?: string;
    start_date?: string | null;
    end_date?: string | null;
    status?: Contract["status"];
  }) => request<Contract>("/api/construction/contracts/", { method: "POST", body: JSON.stringify(data) }),
  updateContract: (
    id: number,
    data: Partial<Pick<Contract, "scope_of_work" | "contract_value_cents" | "retention_percent" | "start_date" | "end_date" | "status">>
  ) => request<Contract>(`/api/construction/contracts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteContract: (id: number) => request<void>(`/api/construction/contracts/${id}/`, { method: "DELETE" }),

  listSiteLogs: (projectId?: number) =>
    request<SiteLog[]>(`/api/construction/site-logs/${projectId ? `?project=${projectId}` : ""}`),
  createSiteLog: (data: {
    project: number;
    log_date: string;
    percent_complete?: number;
    work_summary?: string;
    weather?: string;
    logged_by?: number | null;
  }) => request<SiteLog>("/api/construction/site-logs/", { method: "POST", body: JSON.stringify(data) }),

  listMaterialIssues: (projectId?: number) =>
    request<MaterialIssue[]>(`/api/construction/material-issues/${projectId ? `?project=${projectId}` : ""}`),
  createMaterialIssue: (data: { project: number; item: number; warehouse: number; quantity: number }) =>
    request<MaterialIssue>("/api/construction/material-issues/", { method: "POST", body: JSON.stringify(data) }),

  listEquipment: () => request<Equipment[]>("/api/construction/equipment/"),
  createEquipment: (data: { name: string; equipment_type?: string; notes?: string }) =>
    request<Equipment>("/api/construction/equipment/", { method: "POST", body: JSON.stringify(data) }),
  updateEquipment: (id: number, data: Partial<Pick<Equipment, "name" | "equipment_type" | "status" | "notes">>) =>
    request<Equipment>(`/api/construction/equipment/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEquipment: (id: number) => request<void>(`/api/construction/equipment/${id}/`, { method: "DELETE" }),

  listEquipmentAssignments: (params?: { project?: number; equipment?: number }) => {
    const qs = new URLSearchParams();
    if (params?.project) qs.set("project", String(params.project));
    if (params?.equipment) qs.set("equipment", String(params.equipment));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<EquipmentAssignment[]>(`/api/construction/equipment-assignments/${suffix}`);
  },
  createEquipmentAssignment: (data: { equipment: number; project: number; start_date: string; daily_rate_cents?: number }) =>
    request<EquipmentAssignment>("/api/construction/equipment-assignments/", { method: "POST", body: JSON.stringify(data) }),
  endEquipmentAssignment: (id: number) =>
    request<EquipmentAssignment>(`/api/construction/equipment-assignments/${id}/end/`, { method: "POST" }),

  listLaborAssignments: (projectId?: number) =>
    request<LaborAssignment[]>(`/api/construction/labor-assignments/${projectId ? `?project=${projectId}` : ""}`),
  createLaborAssignment: (data: { employee: number; project: number; role?: string; start_date: string; daily_rate_cents?: number }) =>
    request<LaborAssignment>("/api/construction/labor-assignments/", { method: "POST", body: JSON.stringify(data) }),
  endLaborAssignment: (id: number) =>
    request<LaborAssignment>(`/api/construction/labor-assignments/${id}/end/`, { method: "POST" }),

  listSiteExpenses: (projectId?: number) =>
    request<SiteExpense[]>(`/api/construction/site-expenses/${projectId ? `?project=${projectId}` : ""}`),
  createSiteExpense: (data: { project: number; category?: string; description?: string; amount_cents: number; expense_date: string }) =>
    request<SiteExpense>("/api/construction/site-expenses/", { method: "POST", body: JSON.stringify(data) }),

  listChangeOrders: (projectId?: number) =>
    request<ChangeOrder[]>(`/api/construction/change-orders/${projectId ? `?project=${projectId}` : ""}`),
  createChangeOrder: (data: { project: number; description: string; amount_cents: number; requested_date: string }) =>
    request<ChangeOrder>("/api/construction/change-orders/", { method: "POST", body: JSON.stringify(data) }),
  approveChangeOrder: (id: number) => request<ChangeOrder>(`/api/construction/change-orders/${id}/approve/`, { method: "POST" }),
  rejectChangeOrder: (id: number) => request<ChangeOrder>(`/api/construction/change-orders/${id}/reject/`, { method: "POST" }),

  listQualityInspections: (projectId?: number) =>
    request<QualityInspection[]>(`/api/construction/quality-inspections/${projectId ? `?project=${projectId}` : ""}`),
  createQualityInspection: (data: {
    project: number;
    inspected_by?: number | null;
    inspection_date: string;
    result: QualityInspection["result"];
    notes?: string;
  }) => request<QualityInspection>("/api/construction/quality-inspections/", { method: "POST", body: JSON.stringify(data) }),

  listSafetyIncidents: (projectId?: number) =>
    request<SafetyIncident[]>(`/api/construction/safety-incidents/${projectId ? `?project=${projectId}` : ""}`),
  createSafetyIncident: (data: {
    project: number;
    incident_date: string;
    description: string;
    severity?: SafetyIncident["severity"];
    reported_by?: number | null;
    corrective_action?: string;
  }) => request<SafetyIncident>("/api/construction/safety-incidents/", { method: "POST", body: JSON.stringify(data) }),
};
