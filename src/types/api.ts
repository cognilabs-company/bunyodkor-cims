/* eslint-disable @typescript-eslint/no-explicit-any */
// Generated from Swagger/OpenAPI specification
// DO NOT EDIT MANUALLY - This file is auto-generated

import type { ReactNode } from "react";

// ============================================================================
// Common Types
// ============================================================================

export interface ApiMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  pdf_url?: string | null;
  data: T;
  meta: ApiMeta | null;
}

export interface ValidationError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  phone_or_email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  phone: string;
  email: string;
  full_name: string;
  password: string;
}

export interface CurrentUserResponse {
  user: UserWithRoles;
  permissions: string[];
  /**
   * True when the account's role is flagged read-only (e.g. CEO). The backend
   * refuses every non-GET request from such accounts. Branch UI write-controls
   * on this flag, NOT on the permissions array (which intentionally still
   * contains write permissions so the account can open every screen).
   */
  is_read_only?: boolean;
}

// ============================================================================
// User Types
// ============================================================================

export type UserStatus = "active" | "inactive";

export interface UserBase {
  phone: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  status: UserStatus;
}

export interface UserRead extends UserBase {
  [x: string]: undefined;
  role_id: null;
  role_id: null;
  id: number;
  created_at: string;
  roles: RoleRead[];
}

export interface UserWithRoles extends UserBase {
  id: number;
  created_at: string;
  roles: RoleWithPermissions[];
}

export interface UserWithGroups extends UserBase {
  id: number;
  created_at: string;
  groups: GroupRead[];
}

export interface UserCreateRequest {
  phone: string;
  email: string;
  full_name: string;
  password: string;
  is_super_admin?: boolean;
  status?: UserStatus;
}

export interface UserUpdateRequest {
  phone?: string;
  email?: string;
  full_name?: string;
  password?: string;
  status?: UserStatus;
}

export interface UpdateUserRolesRequest {
  role_ids: number[];
}

// ============================================================================
// Role & Permission Types
// ============================================================================

export interface PermissionRead {
  id: number;
  code: string;
  description: string;
  created_at: string;
}

export interface RoleRead {
  id: number;
  name: string;
  description: string;
  /**
   * Read-only role marker. Returned by GET /roles and inside /auth/me. NOT
   * accepted by RoleCreate/RoleUpdate — display it as a read-only indicator,
   * never a form control.
   */
  is_read_only?: boolean;
  created_at: string;
}

export interface RoleWithPermissions extends RoleRead {
  permissions: PermissionRead[];
}

export interface RoleCreateRequest {
  name: string;
  description: string;
  permission_ids: number[];
}

export interface RoleUpdateRequest {
  name?: string;
  description?: string;
  permission_ids?: number[];
}

// ============================================================================
// Student Types
// ============================================================================

export type StudentStatus = "active" | "graduated" | "dropped" | "suspended";

export interface StudentRead {
  [x: string]: ReactNode;
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  photo_url: string | null;
  face_id: string | null;
  status: StudentStatus;
  group_id: number | null;
  created_at: string;
}

export interface StudentCreateRequest {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  photo_url?: string | null;
  face_id?: string | null;
  status?: StudentStatus;
  group_id?: number | null;
}

export interface StudentUpdateRequest {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  phone?: string;
  address?: string;
  photo_url?: string | null;
  face_id?: string | null;
  status?: StudentStatus;
  group_id?: number | null;
}

export interface StudentWithDebtInfo {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  has_debt: boolean;
  debt_amount: number;
  debt_warning: string | null;
}

export interface UnpaidStudentInfo {
  year: number;
  months: string;
  month: number;
  from_date: string;
  to_date: string;
  student: StudentRead;
  total_expected: number;
  total_paid: number;
  debt_amount: number;
  group_name: string;
  active_contracts_count: number;
}

export interface StudentFullInfo {
  student: StudentRead;
  parents: ParentRead[];
  contracts: ContractRead[];
  group: GroupRead | null;
  coach: UserRead | null;
  transactions: TransactionRead[];
  attendances: AttendanceRead[];
}

// ============================================================================
// Parent Types
// ============================================================================

export interface ParentRead {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  relationship_type: string;
  student_id: number;
  created_at: string;
}

export interface ParentCreateRequest {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  relationship_type: string;
  student_id: number;
}

export interface ParentUpdateRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  relationship_type?: string;
}

// ============================================================================
// Group Types
// ============================================================================

export interface GroupRead {
  current_student_count: number;
  id: number;
  name: string;
  identifier: string;
  birth_year: number;
  description: string;
  schedule_days: string;
  schedule_time: string;
  capacity: number;
  coach_id: number;
  coach_first_name?: string | null;
  coach_last_name?: string | null;
  created_at: string;
  active_students_count: number;
  waiting_list_count: number;
  /**
   * Always `false`: group capacity no longer limits enrolment or transfers.
   * Never block a group on `capacity` / `active_students_count` — the only
   * enrolment cap is the birth-year limit (`/year-limits`).
   */
  is_full?: boolean;
}

export interface GroupCreateRequest {
  name: string;
  identifier: string;
  birth_year: number;
  description: string;
  schedule_days: string;
  schedule_time: string;
  capacity: number;
  coach_id: number;
}

export interface GroupUpdateRequest {
  name?: string;
  identifier?: string;
  birth_year?: number;
  description?: string;
  schedule_days?: string;
  schedule_time?: string;
  capacity?: number;
  coach_id?: number;
}

export interface GroupCapacityInfo {
  group_id: number;
  group_name: string;
  capacity: number;
  active_contracts: number;
  /** Display only. Can be negative when a group runs over its capacity. */
  available_slots: number;
  /** Always `false` — capacity is display-only. */
  is_full?: boolean;
  waiting_list_count: number;
  by_birth_year: Record<string, { used: number; available: number }>;
}

export interface GroupsByBirthYear {
  birth_year: number;
  groups: GroupRead[];
  total_groups: number;
}

export interface GroupedByYearResponse {
  data: GroupsByBirthYear[];
  total_birth_years: number;
}

// ============================================================================
// Contract Types
// ============================================================================

export type ContractStatus =
  | "active"
  | "expired"
  | "deleted"
  | "terminated"
  | "archived";

export interface TerminatedByUser {
  id: number;
  full_name: string;
}

export interface ContractWithStudentNameRead extends ContractRead {
  student_full_name: string;
}

export interface ContractRead {
  id: number;
  contract_number: string;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  status: ContractStatus;
  student_id: number;
  group_id: number;
  birth_year: number;
  sequence_number: number;
  passport_copy_url: string | null;
  form_086_url: string | null;
  heart_checkup_url: string | null;
  birth_certificate_url: string | null;
  contract_images_urls: string | null;
  final_pdf_url: string | null;
   
  custom_fields: any | null;
  terminated_at: string | null;
  terminated_by_user_id: number | null;
  termination_reason: string | null;
  terminated_by: TerminatedByUser | null;
  created_at: string;
}

export interface ContractCreateRequest {
  contract_number: string;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  status?: ContractStatus;
  student_id: number;
}
export type ContractCreate = ContractCreateRequest;
export interface ContractUpdateRequest {
  start_date?: string;
  end_date?: string;
  monthly_fee?: number;
  status?: ContractStatus;
   
  custom_fields?: any;
}
export type ContractUpdate = ContractUpdateRequest;
export interface ContractDatesUpdateRequest {
  start_date?: string;
  end_date?: string;
}
export interface MonthlyFeeUpdateRequest {
  monthly_fee: number;
}

export interface ContractTerminateRequest {
  termination_reason: string;
  terminated_at: string;
}

export interface SuccessfulPaymentItem {
  transaction_id: number;
  amount: number;
  source: TransactionSource;
  paid_at: string;
  payment_year: number;
  payment_months: number[];
}

export interface TerminatedStudentItem {
  contract_id: number;
  contract_number: string;
  original_contract_number: string | null;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  contract_status: ContractStatus | string;
  student_id: number;
  student_first_name: string;
  student_last_name: string;
  student_phone: string | null;
  student_group_id: number | null;
  student_group_name: string | null;
  student_group_identifier: string | null;
  terminated_at: string;
  termination_reason: string | null;
  terminated_by_user_id: number | null;
  terminated_by_full_name: string | null;
  successful_payments_count: number;
  successful_payments_total: number;
  successful_payments: SuccessfulPaymentItem[];
}

export interface TerminatedUnpaidReportItem {
  contract_id: number;
  contract_number: string;
  original_contract_number: string | null;
  student_id: number;
  student_first_name: string;
  student_last_name: string;
  student_phone: string | null;
  contract_group_id: number | null;
  contract_group_name: string | null;
  contract_group_identifier: string | null;
  current_student_group_id: number | null;
  current_student_group_name: string | null;
  contract_start_date: string;
  contract_end_date: string;
  terminated_at: string;
  effective_end_date: string;
  terminated_by_user_id: number | null;
  terminated_by_full_name: string | null;
  termination_reason: string | null;
  monthly_fee: number;
  paid_months: string[];
  unpaid_months: string[];
  expected_months_count: number;
  paid_months_count: number;
  unpaid_months_count: number;
  total_expected: number;
  total_paid: number;
  debt_amount: number;
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionSource = "payme" | "click" | "bank" | "cash" | "manual";
export type SettlementType = "payment" | "waiver_spravka";
export type TransactionStatus =
  | "pending"
  | "success"
  | "failed"
  | "cancelled"
  | "unassigned";

export interface TransactionRead {
  id: number;
  external_id: string | null;
  amount: number;
  source: TransactionSource;
  status: TransactionStatus;
  paid_at: string;
  comment: string | null;
  settlement_type?: SettlementType | string | null;
  settlement_document_url?: string | null;
  payment_year: number | null;
  payment_months: number[];
  student_id: number | null;
  contract_id: number | null;
  created_by_user_id: number | null;
  created_at: string;
}

export interface TransactionWithNameRead extends TransactionRead {
  description: string;
  updated_at: any;
  student_full_name: string;
}

export interface TransactionStatisticsRead {
  from_date: string;
  to_date: string;
  total_paid: number;
  successful_transactions: number;
  click_transactions: number;
  payme_transactions: number;
  bank_transactions: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TransactionWithNamePaginatedRead extends ApiResponse<
  TransactionWithNameRead[]
> {}

export interface ManualTransactionCreateRequest {
  amount: number;
  source: TransactionSource;
  contract_number: string;
  payment_year: number;
  payment_months: number[];
  comment?: string | null;
  paid_at?: string;
}

export interface AssignTransactionRequest {
  student_id: number;
  contract_id: number;
}

// ============================================================================
// Attendance Types
// ============================================================================

export type AttendanceStatus = "present" | "absent" | "late";

export interface AttendanceRead {
  id: number;
  status: AttendanceStatus;
  comment: string | null;
  session_id: number;
  student_id: number;
  marked_by_user_id: number;
  created_at: string;
}

export interface AttendanceCreateRequest {
  student_id: number;
  status: AttendanceStatus;
  comment?: string | null;
}

export interface AttendanceUpdateRequest {
  status: AttendanceStatus;
  comment?: string | null;
}

export interface BulkAttendanceCreateRequest {
  session_id: number;
  attendances: AttendanceCreateRequest[];
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionRead {
  [x: string]: any;
  location: any;
  id: number;
  session_date: string;
  topic: string;
  start_time: string;
  end_time: string;
  station: string;
  description?: string;
  konspekt_url?: string;
  group_id: number;
  created_by_user_id: number;
  created_at: string;
}

export interface SessionWithAttendances extends SessionRead {
  attendances: AttendanceRead[];
}

export interface SessionCreateRequest {
  session_date: string;
  topic: string;
  start_time: string;
  end_time: string;
  station: string;
  description?: string;
  group_id: number;
}

export interface SessionUpdateRequest {
  session_date?: string;
  topic?: string;
  start_time?: string;
  end_time?: string;
  station?: string;
  description?: string;
  group_id?: number;
}

export interface SessionBulkCreateRequest {
  sessions: SessionCreateRequest[];
}

// ============================================================================
// Head Coach Types
// ============================================================================

export interface ByBirthYearStatistics {
  birth_year: number;
  total_groups: number;
  total_capacity: number;
  total_used: number;
  total_available: number;
}

export interface GroupsStatisticsResponse {
  total_groups: number;
  total_capacity: number;
  total_used: number;
  total_available: number;
  filled_groups_count: number;
  by_birth_year: ByBirthYearStatistics[];
}

export interface HeadCoachStats {
  active_groups_count: number;
  active_students_count: number;
  today_sessions_count: number;
  this_month_attendance_percentage: number;
}

// ============================================================================
// Gate Types
// ============================================================================

export interface GateLogRead {
  id: number;
  allowed: boolean;
  reason: string | null;
  gate_timestamp: string;
  student_id: number;
  created_at: string;
}

export interface GateCallbackRequest {
  student_id: number;
  face_id: string;
}

export interface GateCallbackResponse {
  allowed: boolean;
  reason: string | null;
  student_id: number;
}

// ============================================================================
// Report Types
// ============================================================================

export interface DashboardSummary {
  today_revenue: number;
  active_students: number;
  total_debtors: number;
  today_sessions: number;
  last_7_days: DashboardSummaryPeriod;
  last_30_days: DashboardSummaryPeriod;
  last_90_days: DashboardSummaryPeriod;
}

export interface DashboardSummarySourceBreakdown {
  source: string;
  amount: number;
  transaction_count: number;
}

export interface DashboardSummaryTrendItem {
  date: string;
  inflow: number;
  outflow: number;
  net_amount: number;
  payme: number;
  click: number;
  other: number;
}

export interface DashboardSummaryPeriod {
  from_date: string;
  to_date: string;
  total_inflow: number;
  total_outflow: number;
  net_amount: number;
  successful_transactions: number;
  source_breakdown: DashboardSummarySourceBreakdown[];
  trend: DashboardSummaryTrendItem[];
}

export interface FinanceReportBreakdown {
  source: string;
  total_amount: number;
  transaction_count: number;
}

export interface FinanceReport {
  from_date: string;
  to_date: string;
  total_revenue: number;
  breakdown: FinanceReportBreakdown[];
}

export interface GroupAttendanceReport {
  group_id: number;
  group_name: string;
  total_sessions: number;
  total_students: number;
  attendance_percentage: number;
}

export interface StudentAttendanceReport {
  student_id: number;
  student_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;
}

export interface DebtorItem {
  student_id: number;
  student_name: string;
  contract_number: string;
  debt_amount: number;
  group_name: string;
  primary_phone?: string;
  father_phone?: string;
  mother_phone?: string;
  overdue_months?: Array<{
    year?: number;
    month?: number;
    amount?: number;
    label?: string;
  }>;
  overdue_months_count?: number;
}

export interface PayerItem {
  student_id: number;
  student_name: string;
  contract_number: string;
  group_name: string;
  payment_year: number;
  payment_months: number[];
  total_paid: number;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface SystemSettingsRead {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
}

export interface SystemSettingsUpdateRequest {
  [key: string]: string;
}

// ============================================================================
// Public Types
// ============================================================================

export interface ContractInfoPublic {
  contract_number: string;
  student_first_name: string;
  student_last_name: string;
  monthly_fee: number;
  start_date: string;
  end_date: string;
  current_debt: number;
  last_payment_date: string | null;
}

export interface InitiatePaymentRequest {
  contract_number: string;
  amount: number;
}

// ============================================================================
// Import Types
// ============================================================================

export interface ImportResultResponse {
  message: string;
  success_count: number;
  error_count: number;
}

// ============================================================================
// Waiting List Types
// ============================================================================

export interface WaitingListRead {
  id: number;
  student_first_name: string;
  student_last_name: string;
  birth_year: number;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  group_id: number;
  priority: number;
  notes: string | null;
  added_by_user_id: number;
  created_at: string;
}

export interface WaitingListCreate {
  student_first_name: string;
  student_last_name: string;
  birth_year: number;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  group_id: number;
  priority: number;
  notes?: string;
}

export interface WaitingListUpdate {
  student_first_name?: string;
  student_last_name?: string;
  birth_year?: number;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  group_id?: number;
  priority?: number;
  notes?: string;
}

// ============================================================================
// Year Limit Types (per-birth-year enrolment limit)
// ============================================================================

/**
 * A configured limit row. A birth year with no row is unlimited.
 */
export interface YearLimitRead {
  id: number;
  birth_year: number;
  max_students: number;
  created_at: string;
  updated_at: string;
}

export interface YearLimitCreateRequest {
  birth_year: number;
  max_students: number;
}

export interface YearLimitUpdateRequest {
  max_students: number;
}

/**
 * Limit + live usage for one birth year. Returned for ANY year, including years
 * with no configured limit (`has_limit: false`, `max_students: null`).
 * `current_count` is the number of active contracts of that birth year across
 * every group in the current archive year.
 */
export interface YearLimitUsage {
  birth_year: number;
  max_students: number | null;
  current_count: number;
  remaining: number | null;
  is_full: boolean;
  has_limit: boolean;
}
