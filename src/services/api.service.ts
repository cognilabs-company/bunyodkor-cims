/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Comprehensive API Service Layer
 * Generated from Swagger/OpenAPI specification
 *
 * This service provides type-safe API calls for ALL endpoints in the Bunyodkor CIMS API
 */

import { apiClient } from "@/lib/api-client";
import type {
  // Auth
  LoginRequest,
  AuthResponse,
  RegisterRequest,
  CurrentUserResponse,
  // Users
  UserRead,
  UserWithRoles,
  UserWithGroups,
  UserCreateRequest,
  UserUpdateRequest,
  UpdateUserRolesRequest,
  // Roles & Permissions
  RoleWithPermissions,
  PermissionRead,
  RoleCreateRequest,
  RoleUpdateRequest,
  // Students
  StudentRead,
  StudentCreateRequest,
  StudentUpdateRequest,
  StudentWithDebtInfo,
  UnpaidStudentInfo,
  StudentFullInfo,
  // Parents
  ParentRead,
  ParentCreateRequest,
  ParentUpdateRequest,
  // Groups
  GroupRead,
  GroupCreateRequest,
  GroupUpdateRequest,
  GroupedByYearResponse,
  // Contracts
  ContractRead,
  ContractCreateRequest,
  ContractUpdateRequest,
  ContractDatesUpdateRequest,
  // Transactions
  TransactionRead,
  ManualTransactionCreateRequest,
  AssignTransactionRequest,
  TransactionStatisticsRead,
  // Attendance
  AttendanceRead,
  AttendanceCreateRequest,
  AttendanceUpdateRequest,
  BulkAttendanceCreateRequest,
  // Sessions
  SessionRead,
  SessionCreateRequest,
  SessionBulkCreateRequest,
  // Gate
  GateLogRead,
  GateCallbackRequest,
  GateCallbackResponse,
  // Reports
  DashboardSummary,
  FinanceReport,
  GroupAttendanceReport,
  StudentAttendanceReport,
  DebtorItem,
  PayerItem,
  // Settings
  SystemSettingsRead,
  SystemSettingsUpdateRequest,
  // Public
  ContractInfoPublic,
  InitiatePaymentRequest,
  ImportResultResponse,
  // Waiting List
  WaitingListRead,
  WaitingListCreate,
  WaitingListUpdate,
  // Year Limits
  YearLimitRead,
  YearLimitUsage,
  YearLimitCreateRequest,
  YearLimitUpdateRequest,
  // Common
  ApiResponse,
  SessionUpdateRequest,
  GroupsStatisticsResponse,
  ContractWithStudentNameRead,
  TransactionWithNameRead,
  TerminatedStudentItem,
  TerminatedUnpaidReportItem,
} from "@/types/api";

// ============================================================================
// AUTHENTICATION SERVICES
// ============================================================================

export const authService = {
  /**
   * Login with phone/email and password
   * POST /auth/login
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/login", data);
    return response.data;
  },

  /**
   * Register new user
   * POST /auth/register
   */
  register: async (data: RegisterRequest): Promise<UserRead> => {
    const response = await apiClient.post<UserRead>("/auth/register", data);
    return response.data;
  },

  /**
   * Get current user info with permissions
   * GET /auth/me
   */
  getCurrentUser: async (): Promise<CurrentUserResponse> => {
    const response = await apiClient.get<CurrentUserResponse>("/auth/me");
    return response.data;
  },

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   */
  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};

// ============================================================================
// USER SERVICES
// ============================================================================

export interface GetUsersParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export const userService = {
  /**
   * Get paginated list of users
   * GET /users
   */
  getUsers: async (
    params?: GetUsersParams,
  ): Promise<ApiResponse<UserRead[]>> => {
    const response = await apiClient.get<ApiResponse<UserRead[]>>("/users", {
      params,
    });
    return response.data;
  },

  /**
   * Create new user (without roles - use updateUserRoles after)
   * POST /users
   */
  createUser: async (
    data: UserCreateRequest,
  ): Promise<ApiResponse<UserRead>> => {
    const response = await apiClient.post<ApiResponse<UserRead>>(
      "/users",
      data,
    );
    return response.data;
  },

  /**
   * Update user details
   * PATCH /users/{user_id}
   */
  updateUser: async (
    userId: number,
    data: UserUpdateRequest,
  ): Promise<ApiResponse<UserRead>> => {
    const response = await apiClient.patch<ApiResponse<UserRead>>(
      `/users/${userId}`,
      data,
    );
    return response.data;
  },

  /**
   * Update user roles (CRITICAL: This is how you assign roles to users!)
   * PATCH /users/{user_id}/roles
   */
  updateUserRoles: async (
    userId: number,
    data: UpdateUserRolesRequest,
  ): Promise<ApiResponse<UserWithRoles>> => {
    const response = await apiClient.patch<ApiResponse<UserWithRoles>>(
      `/users/${userId}/roles`,
      data,
    );
    return response.data;
  },

  /**
   * Get single user by ID
   * GET /users/{user_id}
   */
  getUser: async (userId: number): Promise<ApiResponse<UserRead>> => {
    const response = await apiClient.get<ApiResponse<UserRead>>(
      `/users/${userId}`,
    );
    return response.data;
  },

  /**
   * Get all coaches (users with Coach role)
   * GET /users/coaches
   */
  getCoaches: async (p0: {}): Promise<ApiResponse<UserWithGroups[]>> => {
    const response =
      await apiClient.get<ApiResponse<UserWithGroups[]>>("/users/coaches");
    return response.data;
  },

  /**
   * Delete user
   * DELETE /users/{user_id}
   */
  deleteUser: async (
    userId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/users/${userId}`);
    return response.data;
  },

  /**
   * Bulk delete users by IDs
   * POST /users/bulk-delete
   */
  bulkDeleteUsers: async (
    userIds: number[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/users/bulk-delete",
      userIds,
    );
    return response.data;
  },
};

// ============================================================================
// ROLE & PERMISSION SERVICES
// ============================================================================

export const roleService = {
  /**
   * Get all roles with their permissions
   * GET /roles
   */

  getRoles: async (p0?: {}): Promise<ApiResponse<RoleWithPermissions[]>> => {
    const response =
      await apiClient.get<ApiResponse<RoleWithPermissions[]>>("/roles");
    return response.data;
  },

  /**
   * Create new role with permissions
   * POST /roles
   */
  createRole: async (
    data: RoleCreateRequest,
  ): Promise<ApiResponse<RoleWithPermissions>> => {
    const response = await apiClient.post<ApiResponse<RoleWithPermissions>>(
      "/roles",
      data,
    );
    return response.data;
  },

  /**
   * Update existing role
   * PATCH /roles/{role_id}
   */
  updateRole: async (
    roleId: number,
    data: RoleUpdateRequest,
  ): Promise<ApiResponse<RoleWithPermissions>> => {
    const response = await apiClient.patch<ApiResponse<RoleWithPermissions>>(
      `/roles/${roleId}`,
      data,
    );
    return response.data;
  },

  /**
   * Get all available permissions
   * GET /roles/permissions
   */
  getPermissions: async (): Promise<ApiResponse<PermissionRead[]>> => {
    const response =
      await apiClient.get<ApiResponse<PermissionRead[]>>("/roles/permissions");
    return response.data;
  },

  /**
   * Delete role
   * DELETE /roles/{role_id}
   */
  deleteRole: async (
    roleId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/roles/${roleId}`);
    return response.data;
  },
};

// ============================================================================
// STUDENT SERVICES
// ============================================================================

export interface GetStudentsParams {
  search?: string;
  group_id?: number;
  status?: string;
  archive_year?: number;
  page?: number;
  page_size?: number;
}

export const studentService = {
  /**
   * Get paginated list of students with filters
   * GET /students
   */
  getStudents: async (
    params?: GetStudentsParams,
  ): Promise<ApiResponse<StudentRead[]>> => {
    const response = await apiClient.get<ApiResponse<StudentRead[]>>(
      "/students",
      { params },
    );
    return response.data;
  },

  /**
   * Create new student
   * POST /students
   */
  createStudent: async (
    data: StudentCreateRequest,
  ): Promise<ApiResponse<StudentRead>> => {
    const response = await apiClient.post<ApiResponse<StudentRead>>(
      "/students",
      data,
    );
    return response.data;
  },

  /**
   * Get single student
   * GET /students/{student_id}
   */
  getStudent: async (studentId: number): Promise<ApiResponse<StudentRead>> => {
    const response = await apiClient.get<ApiResponse<StudentRead>>(
      `/students/${studentId}`,
    );
    return response.data;
  },

  /**
   * Update student
   * PATCH /students/{student_id}
   */
  updateStudent: async (
    studentId: number,
    data: StudentUpdateRequest,
  ): Promise<ApiResponse<StudentRead>> => {
    const response = await apiClient.patch<ApiResponse<StudentRead>>(
      `/students/${studentId}`,
      data,
    );
    return response.data;
  },

  /**
   * Transfer a student (and their active contract) to another group in place.
   * Nothing is duplicated: payments, attendance, gate logs, parents and debt
   * stay attached, and the contract number does NOT change.
   * POST /students/{student_id}/transfer
   *
   * Errors surface `detail` to the caller (global toast is suppressed):
   *  400 already in group / no active contract / target group not ACTIVE
   *  404 student or target group not found
   *  409 more than one active contract (anomaly) / target group full
   *  403 read-only account
   */
  transferStudent: async (
    studentId: number,
    data: { target_group_id: number; reason?: string },
  ): Promise<
    ApiResponse<{
      student_id: number;
      contract_id: number;
      from_group_id: number;
      to_group_id: number;
      contract_number: string;
      birth_year: number;
      message: string;
    }>
  > => {
    const response = await apiClient.post(
      `/students/${studentId}/transfer`,
      data,
      { suppressGlobalErrorToast: true } as object,
    );
    return response.data;
  },

  /**
   * Get student contracts
   * GET /students/{student_id}/contracts
   */
  getStudentContracts: async (
    studentId: number,
  ): Promise<ApiResponse<ContractRead[]>> => {
    const response = await apiClient.get<ApiResponse<ContractRead[]>>(
      `/students/${studentId}/contracts`,
    );
    return response.data;
  },

  /**
   * Get student transactions
   * GET /students/{student_id}/transactions
   */
  getStudentTransactions: async (
    studentId: number,
  ): Promise<ApiResponse<TransactionRead[]>> => {
    const response = await apiClient.get<ApiResponse<TransactionRead[]>>(
      `/students/${studentId}/transactions`,
    );
    return response.data;
  },

  /**
   * Get student attendance records
   * GET /students/{student_id}/attendance
   */
  getStudentAttendance: async (
    studentId: number,
  ): Promise<ApiResponse<AttendanceRead[]>> => {
    const response = await apiClient.get<ApiResponse<AttendanceRead[]>>(
      `/students/${studentId}/attendance`,
    );
    return response.data;
  },

  /**
   * Get student gate logs
   * GET /students/{student_id}/gatelogs
   */
  getStudentGateLogs: async (
    studentId: number,
  ): Promise<ApiResponse<GateLogRead[]>> => {
    const response = await apiClient.get<ApiResponse<GateLogRead[]>>(
      `/students/${studentId}/gatelogs`,
    );
    return response.data;
  },

  /**
   * Search students by name, contract number, phone, or parent email
   * GET /students/search
   */
  searchStudents: async (
    query: string,
    params?: { page?: number; page_size?: number },
  ): Promise<ApiResponse<StudentRead[]>> => {
    const response = await apiClient.get<ApiResponse<StudentRead[]>>(
      "/students/search",
      {
        params: { query, ...params },
      },
    );
    return response.data;
  },

  /**
   * Get unpaid students for a specific month or date range
   * GET /students/unpaid
   * Supports multiple filter options:
   * - year + month: Single month
   * - year + months: Multiple months (comma-separated)
   * - from_date + to_date: Date range
   * - group_id: Filter by group
   */
  getUnpaidStudents: async (params?: {
    year?: number;
    month?: number;
    months?: string;
    from_date?: string;
    to_date?: string;
    group_id?: number;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<UnpaidStudentInfo[]>> => {
    const response = await apiClient.get<ApiResponse<UnpaidStudentInfo[]>>(
      "/students/unpaid",
      { params },
    );
    return response.data;
  },

  /**
   * Get complete student information including parents, contracts, group, coach, transactions, and attendance
   * GET /students/fullinfo/{student_id}
   */
  getStudentFullInfo: async (
    studentId: number,
  ): Promise<ApiResponse<StudentFullInfo>> => {
    const response = await apiClient.get<ApiResponse<StudentFullInfo>>(
      `/students/fullinfo/${studentId}`,
    );
    return response.data;
  },

  /**
   * Delete student
   * DELETE /students/{student_id}
   */
  deleteStudent: async (
    studentId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/students/${studentId}`);
    return response.data;
  },

  /**
   * Hard delete student (PERMANENT DELETION)
   * DELETE /students/{student_id}/hard-delete
   * WARNING: This action is irreversible!
   */
  hardDeleteStudent: async (
    studentId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/students/${studentId}/hard-delete`);
    return response.data;
  },

  /**
   * Bulk delete students by IDs
   * POST /students/bulk-delete
   */
  bulkDeleteStudents: async (
    studentIds: number[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/students/bulk-delete",
      studentIds,
    );
    return response.data;
  },

  /**
   * Create student with contract and all documents in ONE operation
   * POST /students/create-with-contract
   */
  /**
   * Create student with contract and generate PDF
   * POST /students/create-with-contract
   * Backend returns: { pdf_url: string }
   */
  /**
   * Create student with contract and generate PDF
   * POST /students/create-with-contract
   * Backend returns: { pdf_url: string }
   */
  createStudentWithContract: async (
    formData: FormData,
  ): Promise<{ pdf_url: string }> => {
    const response = await apiClient.post<{ pdf_url: string }>(
      "/students/create-with-contract",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      },
    );

    return response.data;
  },

  /**
   * Export unpaid students data to Excel
   * GET /students/unpaid/export
   */
  exportUnpaidStudents: async (params?: {
    year?: number;
    month?: number;
    months?: string;
    from_date?: string;
    to_date?: string;
    group_id?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>("/students/unpaid/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Export comprehensive student data to Excel
   * GET /students/comprehensive-export
   */
  exportComprehensiveStudentData: async (params?: {
    from_date?: string;
    to_date?: string;
    group_id?: number;
    status?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>(
      "/students/comprehensive-export",
      {
        params,
        responseType: "blob",
      },
    );
    return response.data;
  },
};

// ============================================================================
// PARENT SERVICES
// ============================================================================

export interface GetParentsParams {
  student_id?: number;
  page?: number;
  page_size?: number;
}

export const parentService = {
  /**
   * Get paginated list of parents with filters
   * GET /parents
   */
  getParents: async (
    params?: GetParentsParams,
  ): Promise<ApiResponse<ParentRead[]>> => {
    const response = await apiClient.get<ApiResponse<ParentRead[]>>(
      "/parents",
      { params },
    );
    return response.data;
  },

  /**
   * Create new parent
   * POST /parents
   */
  createParent: async (
    data: ParentCreateRequest,
  ): Promise<ApiResponse<ParentRead>> => {
    const response = await apiClient.post<ApiResponse<ParentRead>>(
      "/parents",
      data,
    );
    return response.data;
  },

  /**
   * Get single parent
   * GET /parents/{parent_id}
   */
  getParent: async (parentId: number): Promise<ApiResponse<ParentRead>> => {
    const response = await apiClient.get<ApiResponse<ParentRead>>(
      `/parents/${parentId}`,
    );
    return response.data;
  },

  /**
   * Update parent
   * PATCH /parents/{parent_id}
   */
  updateParent: async (
    parentId: number,
    data: ParentUpdateRequest,
  ): Promise<ApiResponse<ParentRead>> => {
    const response = await apiClient.patch<ApiResponse<ParentRead>>(
      `/parents/${parentId}`,
      data,
    );
    return response.data;
  },

  /**
   * Delete parent
   * DELETE /parents/{parent_id}
   */
  deleteParent: async (
    parentId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/parents/${parentId}`);
    return response.data;
  },
};

// ============================================================================
// GROUP SERVICES
// ============================================================================

export interface GetGroupsParams {
  page?: number;
  page_size?: number;
  birth_year?: number;
  search?: string;
}

export const groupService = {
  /**
   * Get paginated list of groups
   * GET /groups
   */
  getGroups: async (
    params?: GetGroupsParams,
  ): Promise<ApiResponse<GroupRead[]>> => {
    const response = await apiClient.get<ApiResponse<GroupRead[]>>("/groups", {
      params,
    });
    return response.data;
  },

  /**
   * Create new group
   * POST /groups
   */
  createGroup: async (
    data: GroupCreateRequest,
  ): Promise<ApiResponse<GroupRead>> => {
    const response = await apiClient.post<ApiResponse<GroupRead>>(
      "/groups",
      data,
    );
    return response.data;
  },

  /**
   * Get single group
   * GET /groups/{group_id}
   */
  getGroup: async (groupId: number): Promise<ApiResponse<GroupRead>> => {
    const response = await apiClient.get<ApiResponse<GroupRead>>(
      `/groups/${groupId}`,
    );
    return response.data;
  },

  /**
   * Update group
   * PATCH /groups/{group_id}
   */
  updateGroup: async (
    groupId: number,
    data: GroupUpdateRequest,
  ): Promise<ApiResponse<GroupRead>> => {
    const response = await apiClient.patch<ApiResponse<GroupRead>>(
      `/groups/${groupId}`,
      data,
    );
    return response.data;
  },

  /**
   * Get students in a group
   * GET /groups/{group_id}/students
   */
  getGroupStudents: async (
    groupId: number,
  ): Promise<ApiResponse<StudentRead[]>> => {
    const response = await apiClient.get<ApiResponse<StudentRead[]>>(
      `/groups/${groupId}/students`,
    );
    return response.data;
  },

  /**
   * Get contracts for a specific group
   * GET /groups/{group_id}/contracts
   */
  getGroupContracts: async (
    groupId: number,
    params?: { status?: string; page?: number; page_size?: number },
  ): Promise<ApiResponse<ContractRead[]>> => {
    const response = await apiClient.get<ApiResponse<ContractRead[]>>(
      `/groups/${groupId}/contracts`,
      { params },
    );
    return response.data;
  },

  /**
   * Delete group
   * DELETE /groups/{group_id}
   */
  deleteGroup: async (
    groupId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/groups/${groupId}`);
    return response.data;
  },

  /**
   * Bulk delete groups by IDs
   * POST /groups/bulk-delete
   */
  bulkDeleteGroups: async (
    groupIds: number[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/groups/bulk-delete",
      groupIds,
    );
    return response.data;
  },

  /**
   * Get detailed capacity information for a group
   * GET /groups/{group_id}/capacity
   */
  getGroupCapacity: async (
    groupId: number,
    params?: { archive_year?: number },
  ): Promise<
    ApiResponse<{
      group_id: number;
      group_name: string;
      capacity: number;
      active_contracts: number;
      available_slots: number;
      waiting_list_count: number;
      by_birth_year: Record<string, { used: number; available: number }>;
    }>
  > => {
    const response = await apiClient.get(`/groups/${groupId}/capacity`, {
      params,
    });
    return response.data;
  },

  /**
   * Get all groups organized by birth year with statistics for each year
   * GET /groups/grouped-by-year
   */
  getGroupsGroupedByYear: async (params?: {
    archive_year?: number;
    status?: string;
    include_archived?: boolean;
  }): Promise<GroupedByYearResponse> => {
    const response = await apiClient.get<GroupedByYearResponse>(
      "/groups/grouped-by-year",
      { params },
    );
    return response.data;
  },

  /**
   * Get overall statistics for all groups.
   * GET /groups/statistics
   */
  getGroupsStatistics: async (): Promise<
    ApiResponse<GroupsStatisticsResponse>
  > => {
    const response =
      await apiClient.get<ApiResponse<GroupsStatisticsResponse>>(
        "/groups/statistics",
      );
    return response.data;
  },
};

// ============================================================================
// CONTRACT SERVICES
// ============================================================================

/**
 * Collects every row of a paginated list endpoint.
 *
 * Fewer, larger pages are much faster than many small ones, so it asks for
 * 1000 rows a page first and steps down to 100, then 20, only if the endpoint
 * rejects the size (422 — logged, not toasted, by the response interceptor).
 * Remaining pages go out six at a time: the browser's per-host limit, so none
 * sit queued, while the API is never flooded.
 *
 * `onProgress(loaded, total)` fires after every page, for a progress readout.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<ApiResponse<T[]>>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<T[]> {
  const PAGE_SIZES = [1000, 100, 20];
  const CONCURRENCY = 6;

  let pageSize = PAGE_SIZES[0];
  let first: ApiResponse<T[]> | undefined;

  for (const size of PAGE_SIZES) {
    try {
      pageSize = size;
      first = await fetchPage(1, size);
      break;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      const isLastSize = size === PAGE_SIZES[PAGE_SIZES.length - 1];
      if (status !== 422 || isLastSize) throw error;
    }
  }

  const rows = [...(first?.data || [])];
  const totalPages = first?.meta?.total_pages ?? 1;
  const total = first?.meta?.total ?? rows.length;
  onProgress?.(rows.length, total);

  for (let start = 2; start <= totalPages; start += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, totalPages - start + 1) },
      (_, i) => fetchPage(start + i, pageSize),
    );
    for (const response of await Promise.all(batch)) {
      rows.push(...(response.data || []));
    }
    onProgress?.(rows.length, total);
  }

  return rows;
}

export interface GetContractsParams {
  archive_year?: number;
  include_archived?: boolean;
  status?: string;
  student_id?: number;
  group_id?: number;
  contract_id?: number;
  contract_number?: string;
  page?: number;
  page_size?: number;
}

export interface GetContractsWithStudentNameParams {
  archive_year?: number;
  include_archived?: boolean;
  status?: string;
  student_id?: number;
  group_id?: number;
  contract_number?: string;
  page?: number;
  page_size?: number;
}

export interface GetTerminatedContractsParams {
  archive_year?: number;
  group_id?: number;
  search?: string;
  terminated_from?: string;
  terminated_to?: string;
  page?: number;
  page_size?: number;
}

export const contractService = {
  /**
   * Get all contracts with student full name with optional filters
   * GET /contracts/withname
   */
  getContractsWithStudentName: async (
    params?: GetContractsWithStudentNameParams,
  ): Promise<ApiResponse<ContractWithStudentNameRead[]>> => {
    const response = await apiClient.get<
      ApiResponse<ContractWithStudentNameRead[]>
    >("/contracts/withname", { params });
    return response.data;
  },

  /**
   * Every contract matching the filters, across all pages, with the student's
   * name on each row.
   *
   * The list screen sorts by birth year and searches by name, both of which
   * must see the whole filtered set: sorting or searching one server page of
   * ten would give wrong results.
   *
   * Only `/contracts/withname` is read. Rows may lack `student_id`; the screen
   * looks it up for the one contract a user clicks (`getContract`), instead of
   * loading the entire list a second time from `/contracts` just to fill it in.
   */
  getAllContractsWithStudentName: async (
    params: Omit<GetContractsWithStudentNameParams, "page" | "page_size">,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<ContractWithStudentNameRead[]> =>
    fetchAllPages(
      (page, page_size) =>
        contractService.getContractsWithStudentName({
          ...params,
          page,
          page_size,
        }),
      onProgress,
    ),

  /**
   * Get all contracts with optional filters
   * GET /contracts
   */
  getContracts: async (
    params?: GetContractsParams,
  ): Promise<ApiResponse<ContractRead[]>> => {
    const response = await apiClient.get<ApiResponse<ContractRead[]>>(
      "/contracts",
      { params },
    );
    return response.data;
  },

  /**
   * Get terminated students with payment details
   * GET /contracts/terminated-students
   */
  getTerminatedStudents: async (
    params?: GetTerminatedContractsParams,
  ): Promise<ApiResponse<TerminatedStudentItem[]>> => {
    const response = await apiClient.get<ApiResponse<TerminatedStudentItem[]>>(
      "/contracts/terminated-students",
      { params },
    );
    return response.data;
  },

  /**
   * Get terminated contracts unpaid report
   * GET /contracts/terminated-unpaid-report
   */
  getTerminatedUnpaidReport: async (
    params?: GetTerminatedContractsParams,
  ): Promise<ApiResponse<TerminatedUnpaidReportItem[]>> => {
    const response = await apiClient.get<
      ApiResponse<TerminatedUnpaidReportItem[]>
    >("/contracts/terminated-unpaid-report", { params });
    return response.data;
  },

  /**
   * Export terminated contracts unpaid report
   * GET /contracts/terminated-unpaid-report/export
   */
  exportTerminatedUnpaidReport: async (params?: {
    archive_year?: number;
    group_id?: number;
    search?: string;
    terminated_from?: string;
    terminated_to?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>(
      "/contracts/terminated-unpaid-report/export",
      {
        params,
        responseType: "blob",
      },
    );
    return response.data;
  },

  /**
   * Create new contract
   * POST /contracts
   */
  createContract: async (
    data: ContractCreateRequest,
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.post<ApiResponse<ContractRead>>(
      "/contracts",
      data,
    );
    return response.data;
  },

  /**
   * Get single contract
   * GET /contracts/{contract_id}
   */
  getContract: async (
    contractId: number,
    _number: string,
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.get<ApiResponse<ContractRead>>(
      `/contracts/${contractId}`,
    );
    return response.data;
  },

  /**
   * Update contract
   * PATCH /contracts/{contract_id}
   */
  updateContract: async (
    contractId: number,
    data: ContractUpdateRequest,
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.patch<ApiResponse<ContractRead>>(
      `/contracts/${contractId}`,
      data,
    );
    return response.data;
  },

  /**
   * Update only contract start/end dates
   * PATCH /contracts/{contract_id}/dates
   */
  updateContractDates: async (
    contractId: number,
    data: ContractDatesUpdateRequest,
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.patch<ApiResponse<ContractRead>>(
      `/contracts/${contractId}/dates`,
      data,
    );
    return response.data;
  },

  /**
   * Update only the monthly fee for a contract
   * PATCH /contracts/{contract_id}/monthly-fee
   */
  updateContractMonthlyFee: async (
    contractId: number,
    data: { monthly_fee: number },
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.patch<ApiResponse<ContractRead>>(
      `/contracts/${contractId}/monthly-fee`,
      data,
    );
    return response.data;
  },

  /**
   * Delete contract
   * DELETE /contracts/{contract_id}
   */
  deleteContract: async (
    contractId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/contracts/${contractId}`);
    return response.data;
  },

  /**
   * Terminate contract with reason
   * POST /contracts/{contract_id}/terminate
   */
  terminateContract: async (
    contractId: number,
    data: {
      termination_reason: string;
      terminated_at: string;
    },
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.post<ApiResponse<ContractRead>>(
      `/contracts/${contractId}/terminate`,
      data,
    );
    return response.data;
  },

  /**
   * Get valid payment months for a contract
   * GET /contracts/payment-months/{contract_number}
   */
  getContractPaymentMonths: async (
    contractNumber: string,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
      `/contracts/payment-months/${contractNumber}`,
    );
    return response.data;
  },

  /**
   * Bulk delete contracts by IDs
   * POST /contracts/bulk-delete
   */
  bulkDeleteContracts: async (
    contractIds: number[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/contracts/bulk-delete",
      contractIds,
    );
    return response.data;
  },

  /**
   * Create contract with file uploads
   * POST /contracts/create-with-files
   */
  createContractWithFiles: async (
    formData: FormData,
  ): Promise<ApiResponse<ContractRead>> => {
    const response = await apiClient.post<ApiResponse<ContractRead>>(
      "/contracts/create-with-files",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  /**
   * Update only the final PDF of an existing contract
   * PATCH /contracts/{contract_id}/update-pdf
   */
  updateContractPdf: async (
    contractId: number,
    formData: FormData,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.patch<
      ApiResponse<Record<string, unknown>>
    >(`/contracts/${contractId}/update-pdf`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * @deprecated Numbers are now a never-reused running serial; there are no
   * reusable "gaps" to pick from. This endpoint is marked deprecated in OpenAPI
   * and always returns empty gap fields. Use {@link getNextAvailableNumber}.
   *
   * Get all available contract numbers for a group and birth year
   * GET /contracts/available-numbers/{group_id}/{birth_year}
   */
  getAvailableContractNumbers: async (
    groupId: number,
    birthYear: number,
  ): Promise<
    ApiResponse<{
      group_id: number;
      group_name: string;
      group_capacity: number;
      birth_year: number;
      available_numbers: number[];
      total_available: number;
      total_used: number;
      is_full: boolean;
    }>
  > => {
    const response = await apiClient.get(
      `/contracts/available-numbers/${groupId}/${birthYear}`,
      { suppressGlobalErrorToast: true } as object,
    );
    return response.data;
  },

  /**
   * Get the next (and only valid) contract number for a group. Numbers are a
   * never-reused running serial, so there is no longer a choice to make — the
   * returned `contract_number` is the one to use. `is_full` is a plain headcount
   * of ACTIVE contracts vs `group_capacity` and is UNRELATED to numbering: a
   * full group still returns a valid `next_number`, so never infer fullness
   * from the number.
   * GET /contracts/next-available/{group_id}
   */
  getNextAvailableNumber: async (
    groupId: number,
    year?: number,
  ): Promise<
    ApiResponse<{
      /** New canonical field. `next_available` kept for backward-compat. */
      next_number?: number;
      next_available?: number;
      contract_number: string;
      message?: string;
      is_full: boolean;
      group_name?: string;
      group_identifier?: string;
      birth_year: number;
      group_capacity?: number;
      total_used?: number;
    }>
  > => {
    const url = year
      ? `/contracts/next-available/${groupId}/${year}`
      : `/contracts/next-available/${groupId}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Get contract PDF URL by year and contract number
   * GET /contracts/{year}/{contract_number}/pdf
   */
  getContractPdfUrl: async (
    year: number,
    contractNumber: string,
  ): Promise<string> => {
    const response = await apiClient.get<string>(
      `/contracts/${year}/${contractNumber}/pdf`,
    );
    return response.data;
  },

  /**
   * View Contract Pdf
   * GET /contracts/{contract_id}/pdf
   */
  viewContractPdf: async (contractId: number): Promise<Blob> => {
    const response = await apiClient.get(`/contracts/${contractId}/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Terminated kontraktdan yangi student + yangi kontrakt yaratadi.
   * POST /contracts/clone-from-terminated
   */
  cloneFromTerminated: async (data: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      "/contracts/clone-from-terminated",
      data,
    );
    return response.data;
  },
};

// ============================================================================
// TRANSACTION SERVICES
// ============================================================================

export interface GetTransactionsParams {
  from_date?: string;
  to_date?: string;
  status?: string;
  source?: string;
  student_id?: number;
  page?: number;
  page_size?: number;
}

export interface GetTransactionsWithNameParams {
  payment_year?: number;
  from_date?: string;
  to_date?: string;
  status?: string;
  source?: string;
  student_id?: number;
  page?: number;
  page_size?: number;
  search?: string;
}

export interface GetTransactionStatisticsParams {
  from_date?: string;
  to_date?: string;
  group_id?: number;
  status?: string;
}

export interface RequestOptions {
  suppressGlobalErrorToast?: boolean;
}

export const transactionService = {
  /**
   * Get paginated list of transactions with student names
   * GET /transactions/withname
   */
  getTransactionsWithName: async (
    params?: GetTransactionsWithNameParams,
  ): Promise<ApiResponse<TransactionWithNameRead[]>> => {
    const response = await apiClient.get<
      ApiResponse<TransactionWithNameRead[]>
    >("/transactions/withname", { params });
    return response.data;
  },

  /**
   * Get transaction statistics
   * GET /transactions/transactionstatistics
   */
  getTransactionStatistics: async (
    params?: GetTransactionStatisticsParams,
  ): Promise<ApiResponse<TransactionStatisticsRead>> => {
    const response = await apiClient.get<ApiResponse<TransactionStatisticsRead>>(
      "/transactions/transactionstatistics",
      { params },
    );
    return response.data;
  },

  /**
   * Get paginated list of transactions with filters
   * GET /transactions
   */
  getTransactions: async (
    params?: GetTransactionsParams,
  ): Promise<ApiResponse<TransactionRead[]>> => {
    const response = await apiClient.get<ApiResponse<TransactionRead[]>>(
      "/transactions",
      { params },
    );
    return response.data;
  },

  /**
   * Get unassigned transactions
   * GET /transactions/unassigned
   */
  getUnassignedTransactions: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<TransactionRead[]>> => {
    const response = await apiClient.get<ApiResponse<TransactionRead[]>>(
      "/transactions/unassigned",
      { params },
    );
    return response.data;
  },

  /**
   * Create manual transaction
   * POST /transactions/manual
   */
  createManualTransaction: async (
    data: ManualTransactionCreateRequest,
    options?: RequestOptions,
  ): Promise<ApiResponse<TransactionRead>> => {
    const requestConfig = {
      suppressGlobalErrorToast: options?.suppressGlobalErrorToast,
    };

    const response = await apiClient.post<ApiResponse<TransactionRead>>(
      "/transactions/manual",
      data,
      requestConfig,
    );
    return response.data;
  },

  /**
   * Create manual transaction with optional proof file
   * POST /transactions/manual/with-proof
   */
  createManualTransactionWithProof: async (
    formData: FormData,
    options?: RequestOptions,
  ): Promise<ApiResponse<TransactionRead>> => {
    const requestConfig = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      suppressGlobalErrorToast: options?.suppressGlobalErrorToast,
    };

    const response = await apiClient.post<ApiResponse<TransactionRead>>(
      "/transactions/manual/with-proof",
      formData,
      requestConfig,
    );
    return response.data;
  },

  /**
   * Assign transaction to student and contract
   * PATCH /transactions/{transaction_id}/assign
   */
  assignTransaction: async (
    transactionId: number,
    data: AssignTransactionRequest,
  ): Promise<ApiResponse<TransactionRead>> => {
    const response = await apiClient.patch<ApiResponse<TransactionRead>>(
      `/transactions/${transactionId}/assign`,
      data,
    );
    return response.data;
  },

  /**
   * Get single transaction
   * GET /transactions/{transaction_id}
   */
  getTransaction: async (
    transactionId: number,
  ): Promise<ApiResponse<TransactionRead>> => {
    const response = await apiClient.get<ApiResponse<TransactionRead>>(
      `/transactions/${transactionId}`,
    );
    return response.data;
  },

  /**
   * Cancel transaction
   * PATCH /transactions/{transaction_id}/cancel
   */
  cancelTransaction: async (
    transactionId: number,
  ): Promise<ApiResponse<TransactionRead>> => {
    const response = await apiClient.patch<ApiResponse<TransactionRead>>(
      `/transactions/${transactionId}/cancel`,
    );
    return response.data;
  },

  /**
   * Delete transaction
   * DELETE /transactions/{transaction_id}
   */
  deleteTransaction: async (
    transactionId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/transactions/${transactionId}`);
    return response.data;
  },

  /**
   * Bulk delete transactions by IDs
   * POST /transactions/bulk-delete
   */
  bulkDeleteTransactions: async (
    transactionIds: number[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/transactions/bulk-delete",
      transactionIds,
    );
    return response.data;
  },
};

// ============================================================================
// COACH SERVICES
// ============================================================================

export const coachService = {
  /**
   * Get coach's groups
   * GET /coach/groups
   */
  getCoachGroups: async (): Promise<ApiResponse<GroupRead[]>> => {
    const response =
      await apiClient.get<ApiResponse<GroupRead[]>>("/coach/groups");
    return response.data;
  },

  /**
   * Get coach's sessions
   * GET /coach/sessions
   */
  getCoachSessions: async (params?: {
    date?: string;
    group_id?: number;
  }): Promise<ApiResponse<SessionRead[]>> => {
    const response = await apiClient.get<ApiResponse<SessionRead[]>>(
      "/coach/sessions",
      { params },
    );
    return response.data;
  },

  /**
   * Get session students with debt info
   * GET /coach/sessions/{session_id}/students-with-debt-info
   */
  getSessionStudentsWithDebt: async (
    sessionId: number,
  ): Promise<ApiResponse<StudentWithDebtInfo[]>> => {
    const response = await apiClient.get<ApiResponse<StudentWithDebtInfo[]>>(
      `/coach/sessions/${sessionId}/students-with-debt-info`,
    );
    return response.data;
  },

  /**
   * Mark attendance for session
   * POST /coach/sessions/{session_id}/attendance
   */
  markAttendance: async (
    sessionId: number,
    data: AttendanceCreateRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      `/coach/sessions/${sessionId}/attendance`,
      data,
    );
    return response.data;
  },

  /**
   * Mark bulk attendance for multiple students in a session
   * POST /coach/sessions/{session_id}/bulk-attendance
   */
  bulkAttendance: async (
    data: BulkAttendanceCreateRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      `/coach/sessions/${data.session_id}/bulk-attendance`,
      data,
    );
    return response.data;
  },

  /**
   * Get session details with all attendance records
   * GET /coach/sessions/{session_id}
   */
  getSessionDetails: async (
    sessionId: number,
  ): Promise<ApiResponse<SessionRead & { attendances: AttendanceRead[] }>> => {
    const response = await apiClient.get(`/coach/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get group attendance statistics
   * GET /coach/groups/{group_id}/attendance-stats
   */
  getGroupAttendanceStats: async (
    groupId: number,
    params?: {
      from_date?: string;
      to_date?: string;
    },
  ): Promise<
    ApiResponse<{
      total_sessions: number;
      present_count: number;
      absent_count: number;
      late_count: number;
      attendance_rate: number;
    }>
  > => {
    const response = await apiClient.get(
      `/coach/groups/${groupId}/attendance-stats`,
      { params },
    );
    return response.data;
  },

  /**
   * Get student attendance statistics
   * GET /coach/students/{student_id}/attendance-stats
   */
  getStudentAttendanceStats: async (
    studentId: number,
    params?: {
      from_date?: string;
      to_date?: string;
    },
  ): Promise<
    ApiResponse<{
      total_sessions: number;
      present_count: number;
      absent_count: number;
      late_count: number;
      attendance_rate: number;
    }>
  > => {
    const response = await apiClient.get(
      `/coach/students/${studentId}/attendance-stats`,
      { params },
    );
    return response.data;
  },

  /**
   * Get all attendances created by the coach (read-only)
   * GET /coach/my-attendances
   */
  getMyAttendances: async (params?: {
    from_date?: string;
    to_date?: string;
    group_id?: number;
    student_id?: number;
  }): Promise<ApiResponse<AttendanceRead[]>> => {
    const response = await apiClient.get<ApiResponse<AttendanceRead[]>>(
      "/coach/my-attendances",
      { params },
    );
    return response.data;
  },

  /**
   * Upload konspekt document to S3 and update session
   * POST /coach/sessions/{session_id}/upload-konspekt
   */
  uploadKonspekt: async (
    sessionId: number,
    formData: FormData,
  ): Promise<ApiResponse<SessionRead>> => {
    const response = await apiClient.post<ApiResponse<SessionRead>>(
      `/coach/sessions/${sessionId}/upload-konspekt`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },
};

// ============================================================================
// HEAD COACH SERVICES
// ============================================================================

export const headCoachService = {
  /**
   * Get all active groups (exclude deleted)
   * GET /head-coach/groups
   */
  getAllGroups: async (params?: {
    birth_year?: number;
  }): Promise<ApiResponse<GroupRead[]>> => {
    const response = await apiClient.get<ApiResponse<GroupRead[]>>(
      "/head-coach/groups",
      { params },
    );
    return response.data;
  },

  /**
   * Create a new training session for any group
   * POST /head-coach/sessions
   */
  createSession: async (
    data: SessionCreateRequest,
  ): Promise<ApiResponse<SessionRead>> => {
    const response = await apiClient.post<ApiResponse<SessionRead>>(
      "/head-coach/sessions",
      data,
    );
    return response.data;
  },

  /**
   * Get all training sessions with optional filters
   * GET /head-coach/sessions
   */
  getAllSessions: async (params?: {
    date?: string;
    from_date?: string;
    to_date?: string;
    group_id?: number;
  }): Promise<ApiResponse<SessionRead[]>> => {
    const response = await apiClient.get<ApiResponse<SessionRead[]>>(
      "/head-coach/sessions",
      { params },
    );
    return response.data;
  },

  /**
   * Create multiple training sessions in one request
   * POST /head-coach/sessions/bulk
   */
  createSessionsBulk: async (
    data: SessionBulkCreateRequest,
  ): Promise<ApiResponse<SessionRead[]>> => {
    const response = await apiClient.post<ApiResponse<SessionRead[]>>(
      "/head-coach/sessions/bulk",
      data,
    );
    return response.data;
  },

  /**
   * Get session details with all attendance records
   * GET /head-coach/sessions/{session_id}
   */
  getSessionDetails: async (
    sessionId: number,
  ): Promise<ApiResponse<SessionRead & { attendances: AttendanceRead[] }>> => {
    const response = await apiClient.get(`/head-coach/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Update training session
   * PUT /head-coach/sessions/{session_id}
   */
  updateSession: async (
    sessionId: number,
    data: SessionUpdateRequest,
  ): Promise<ApiResponse<SessionRead>> => {
    const response = await apiClient.put<ApiResponse<SessionRead>>(
      `/head-coach/sessions/${sessionId}`,
      data,
    );
    return response.data;
  },

  /**
   * Delete training session
   * DELETE /head-coach/sessions/{session_id}
   */
  deleteSession: async (
    sessionId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete<
      ApiResponse<Record<string, unknown>>
    >(`/head-coach/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get head coach statistics
   * GET /head-coach/stats
   */
  // getHeadCoachStats: async (): Promise<ApiResponse<HeadCoachStats>> => {
  //   const response = await apiClient.get<ApiResponse<HeadCoachStats>>(
  //     "/head-coach/stats"
  //   );
  //   return response.data;
  // },
};

// ============================================================================
// ATTENDANCE SERVICES
// ============================================================================

export interface GetAllAttendancesParams {
  from_date?: string;
  to_date?: string;
  group_id?: number;
  student_id?: number;
  page?: number;
  page_size?: number;
}

export const attendanceService = {
  /**
   * Get all student attendances with filters
   * GET /students/attendances/all
   */
  getAllAttendances: async (
    params?: GetAllAttendancesParams,
  ): Promise<ApiResponse<AttendanceRead[]>> => {
    const response = await apiClient.get<ApiResponse<AttendanceRead[]>>(
      "/students/attendances/all",
      { params },
    );
    return response.data;
  },
};

// ============================================================================
// SESSION SERVICES
// ============================================================================

export interface GetSessionsParams {
  group_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

export const sessionService = {
  /**
   * Get paginated list of sessions with filters
   * GET /sessions
   */
  getSessions: async (
    params?: GetSessionsParams,
  ): Promise<ApiResponse<SessionRead[]>> => {
    const response = await apiClient.get<ApiResponse<SessionRead[]>>(
      "/sessions",
      { params },
    );
    return response.data;
  },

  /**
   * Update attendance for a specific session
   * PATCH /sessions/{session_id}/attendance
   */
  updateSessionAttendance: async (
    sessionId: number,
    data: AttendanceUpdateRequest[],
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.patch<
      ApiResponse<Record<string, unknown>>
    >(`/sessions/${sessionId}/attendance`, data);
    return response.data;
  },
};

// ============================================================================
// GATE SERVICES
// ============================================================================

export interface GetGateLogsParams {
  from_date?: string;
  to_date?: string;
  student_id?: number;
  allowed?: boolean;
  page?: number;
  page_size?: number;
}

export const gateService = {
  /**
   * Gate callback (face recognition)
   * POST /gate/callback
   */
  gateCallback: async (
    data: GateCallbackRequest,
  ): Promise<GateCallbackResponse> => {
    const response = await apiClient.post<GateCallbackResponse>(
      "/gate/callback",
      data,
    );
    return response.data;
  },

  /**
   * Get gate logs with filters
   * GET /gate/logs
   */
  getGateLogs: async (
    params?: GetGateLogsParams,
  ): Promise<ApiResponse<GateLogRead[]>> => {
    const response = await apiClient.get<ApiResponse<GateLogRead[]>>(
      "/gate/logs",
      { params },
    );
    return response.data;
  },
};

// ============================================================================
// REPORT SERVICES
// ============================================================================

export const reportService = {
  /**
   * Get dashboard summary statistics
   * GET /reports/dashboard/summary
   */
  getDashboardSummary: async (): Promise<ApiResponse<DashboardSummary>> => {
    const response = await apiClient.get<ApiResponse<DashboardSummary>>(
      "/reports/dashboard/summary",
    );
    return response.data;
  },

  /**
   * Get finance report for date range
   * GET /reports/finance
   */
  getFinanceReport: async (params: {
    from_date: string;
    to_date: string;
  }): Promise<ApiResponse<FinanceReport>> => {
    const response = await apiClient.get<ApiResponse<FinanceReport>>(
      "/reports/finance",
      {
        params,
      },
    );
    return response.data;
  },

  /**
   * Get group attendance reports
   * GET /reports/attendance/groups
   */
  getGroupAttendanceReports: async (): Promise<
    ApiResponse<GroupAttendanceReport[]>
  > => {
    const response = await apiClient.get<ApiResponse<GroupAttendanceReport[]>>(
      "/reports/attendance/groups",
    );
    return response.data;
  },

  /**
   * Get student attendance report
   * GET /reports/attendance/students/{student_id}
   */
  getStudentAttendanceReport: async (
    studentId: number,
  ): Promise<ApiResponse<StudentAttendanceReport>> => {
    const response = await apiClient.get<ApiResponse<StudentAttendanceReport>>(
      `/reports/attendance/students/${studentId}`,
    );
    return response.data;
  },

  /**
   * Get debtors report
   * GET /reports/debtors
   */
  getDebtorsReport: async (params?: {
      group_id?: number;
      min_debt_amount?: number;
      year?: number;
      month?: number;
      page?: number;
      page_size?: number;
    }): Promise<ApiResponse<DebtorItem[]>> => {
    const response = await apiClient.get<ApiResponse<DebtorItem[]>>(
      "/reports/debtors",
      { params },
    );
    return response.data;
  },
  /**
   * Get payers report
   * GET /reports/payers
   */
  getPayers: async (params?: {
      payment_year?: number;
      payment_month?: number;
      group_id?: number;
      min_paid_amount?: number;
      from_date?: string;
    to_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<PayerItem[]>> => {
    const response = await apiClient.get<ApiResponse<PayerItem[]>>(
      "/reports/payers",
      { params },
    );
    return response.data;
  },

  /**
   * Export the payers report (same filters as `getPayers`) to Excel.
   * GET /reports/payers/export
   *
   * Restored: commit 81b7240 replaced this with `exportPaymentsExcel`, but the
   * Payers report still calls it, so its Export button threw
   * "exportPayersReport is not a function".
   */
  exportPayersReport: async (params?: {
    payment_year?: number;
    payment_month?: number;
    group_id?: number;
    min_paid_amount?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>("/reports/payers/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Export Debtors Report
   * GET /reports/debtors/export
   */
  exportDebtorsReport: async (params?: {
    group_id?: number;
    min_debt_amount?: number;
    year?: number;
    month?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>("/reports/debtors/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Export grouped debtors Excel for management statistics
   * GET /reports/debtors/grouped-excel
   */
  exportGroupedDebtorsExcel: async (params: {
    year: number;
    month: number;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>(
      "/reports/debtors/grouped-excel",
      {
        params,
        responseType: "blob",
      },
    );
    return response.data;
  },

  /**
   * Export Payments Excel
   * GET /reports/payments-excel
   */
  exportPaymentsExcel: async (params?: {
    archive_year?: number;
    group_id?: number;
    birth_year?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get<Blob>("/reports/payments-excel", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Terminated kontraktlar statistikasi.
   * GET /reports/terminated-summary
   */
  getTerminatedSummary: async (params?: {
    archive_year?: number;
    group_id?: number;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      "/reports/terminated-summary",
      { params },
    );
    return response.data;
  },

  /**
   * Terminated kontraktdan klonlash uchun mavjud raqamlarni ko'rsatadi.
   * GET /contracts/clone-available/{terminated_contract_id}
   */
  getCloneAvailableInfo: async (
    terminatedContractId: number,
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/contracts/clone-available/${terminatedContractId}`,
    );
    return response.data;
  },
};

// ============================================================================
// SETTINGS SERVICES
// ============================================================================

export const settingsService = {
  /**
   * Get system settings
   * GET /settings/system
   */
  getSystemSettings: async (): Promise<ApiResponse<SystemSettingsRead[]>> => {
    const response =
      await apiClient.get<ApiResponse<SystemSettingsRead[]>>(
        "/settings/system",
      );
    return response.data;
  },

  /**
   * Update system settings
   * PATCH /settings/system
   */
  updateSystemSettings: async (
    data: SystemSettingsUpdateRequest,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.patch<
      ApiResponse<Record<string, unknown>>
    >("/settings/system", data);
    return response.data;
  },
};

// ============================================================================
// PUBLIC SERVICES (No authentication required)
// ============================================================================

export const publicService = {
  /**
   * Get public contract info
   * GET /public/contracts/{contract_number}
   */
  getContractInfo: async (
    contractNumber: string,
  ): Promise<ContractInfoPublic> => {
    const response = await apiClient.get<ContractInfoPublic>(
      `/public/contracts/${contractNumber}`,
    );
    return response.data;
  },

  /**
   * Initiate Payme payment
   * POST /public/payments/payme
   */
  initiatePaymePayment: async (
    data: InitiatePaymentRequest,
  ): Promise<string> => {
    const response = await apiClient.post<string>(
      "/public/payments/payme",
      data,
    );
    return response.data;
  },

  /**
   * Initiate Click payment
   * POST /public/payments/click
   */
  initiateClickPayment: async (
    data: InitiatePaymentRequest,
  ): Promise<string> => {
    const response = await apiClient.post<string>(
      "/public/payments/click",
      data,
    );
    return response.data;
  },
};

// ============================================================================
// IMPORT SERVICES
// ============================================================================

export const importService = {
  /**
   * Import students from Excel file
   * POST /import/students
   */
  importStudents: async (
    file: File,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/import/students",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  /**
   * Get import result
   * GET /import/students/result
   */
  getImportResult: async (): Promise<ApiResponse<ImportResultResponse>> => {
    const response = await apiClient.get<ApiResponse<ImportResultResponse>>(
      "/import/students/result",
    );
    return response.data;
  },

  /**
   * Import payments from Excel file
   * POST /import/payments
   */
  importPayments: async (
    file: File,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/import/payments",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },
};

// ============================================================================
// WAITING LIST SERVICES
// ============================================================================

export const waitingListService = {
  /**
   * Get waiting list entries
   * GET /waiting-list
   */
  getWaitingList: async (params?: {
    group_id?: number;
    student_id?: number;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<WaitingListRead[]>> => {
    const response = await apiClient.get("/waiting-list", { params });
    return response.data;
  },

  /**
   * Add student to waiting list
   * POST /waiting-list
   */
  addToWaitingList: async (
    data: WaitingListCreate,
  ): Promise<ApiResponse<WaitingListRead>> => {
    const response = await apiClient.post("/waiting-list", data);
    return response.data;
  },

  /**
   * Get waiting list entry
   * GET /waiting-list/{waiting_id}
   */
  getWaitingListEntry: async (
    waitingId: number,
  ): Promise<ApiResponse<WaitingListRead>> => {
    const response = await apiClient.get(`/waiting-list/${waitingId}`);
    return response.data;
  },

  /**
   * Update waiting list entry
   * PATCH /waiting-list/{waiting_id}
   */
  updateWaitingListEntry: async (
    waitingId: number,
    data: WaitingListUpdate,
  ): Promise<ApiResponse<WaitingListRead>> => {
    const response = await apiClient.patch(`/waiting-list/${waitingId}`, data);
    return response.data;
  },

  /**
   * Remove from waiting list
   * DELETE /waiting-list/{waiting_id}
   */
  removeFromWaitingList: async (
    waitingId: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.delete(`/waiting-list/${waitingId}`);
    return response.data;
  },

  /**
   * Get next student in queue for a group
   * GET /waiting-list/group/{group_id}/next
   */
  getNextInQueue: async (
    groupId: number,
  ): Promise<ApiResponse<WaitingListRead | null>> => {
    const response = await apiClient.get(`/waiting-list/group/${groupId}/next`);
    return response.data;
  },
};

// ============================================================================
// ARCHIVE SERVICES
// ============================================================================

export const archiveService = {
  /**
   * Archive all data for a specific year
   * POST /archive/year/{year}
   */
  archiveYear: async (
    year: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post(`/archive/year/${year}`);
    return response.data;
  },

  /**
   * Unarchive all data for a specific year
   * POST /archive/unarchive/year/{year}
   */
  unarchiveYear: async (
    year: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.post(`/archive/unarchive/year/${year}`);
    return response.data;
  },

  /**
   * Get archive statistics for a year
   * GET /archive/stats/{year}
   */
  getArchiveStats: async (
    year: number,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.get(`/archive/stats/${year}`);
    return response.data;
  },

  /**
   * Get terminated contracts for a specific year
   * GET /archive/terminated-contracts/{year}
   */
  getTerminatedContracts: async (
    year: number,
  ): Promise<ApiResponse<ContractRead[]>> => {
    const response = await apiClient.get<ApiResponse<ContractRead[]>>(
      `/archive/terminated-contracts/${year}`,
    );
    return response.data;
  },
};

// ============================================================================
// BACKUP SERVICES
// ============================================================================

export const backupService = {
  /**
   * Trigger manual database backup
   * POST /backup/manual
   */
  triggerManualBackup: async (): Promise<
    ApiResponse<Record<string, unknown>>
  > => {
    const response = await apiClient.post("/backup/manual");
    return response.data;
  },

  /**
   * Get backup configuration status
   * GET /backup/status
   */
  getBackupStatus: async (): Promise<ApiResponse<Record<string, unknown>>> => {
    const response = await apiClient.get("/backup/status");
    return response.data;
  },
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

export const healthService = {
  /**
   * Health check endpoint
   * GET /health
   */
  healthCheck: async (): Promise<unknown> => {
    const response = await apiClient.get("/health");
    return response.data;
  },
};

// ============================================================================
// YEAR LIMIT SERVICES (per-birth-year enrolment limit)
// ============================================================================
//
// Enrolment is capped per BIRTH YEAR, not per group: a year may have any number
// of groups/coaches, but the sum of active contracts across all of them cannot
// exceed the year's limit. A year with no limit row is unlimited. Group
// `capacity` is display-only and no longer blocks anything.
//
// Read requires `groups:view`, write requires `groups:edit`.

export const yearLimitService = {
  /**
   * List every configured year limit (no usage counters)
   * GET /year-limits
   */
  getYearLimits: async (): Promise<ApiResponse<YearLimitRead[]>> => {
    const response =
      await apiClient.get<ApiResponse<YearLimitRead[]>>("/year-limits");
    return response.data;
  },

  /**
   * List every configured year limit together with its live usage
   * GET /year-limits/usage
   */
  getYearLimitsUsage: async (): Promise<ApiResponse<YearLimitUsage[]>> => {
    const response = await apiClient.get<ApiResponse<YearLimitUsage[]>>(
      "/year-limits/usage",
    );
    return response.data;
  },

  /**
   * Limit + usage for a single birth year.
   * Safe to call unconditionally: a year with no limit returns
   * `has_limit: false` / `max_students: null` instead of a 404.
   * GET /year-limits/{birth_year}
   */
  getYearLimit: async (
    birthYear: number,
  ): Promise<ApiResponse<YearLimitUsage>> => {
    const response = await apiClient.get<ApiResponse<YearLimitUsage>>(
      `/year-limits/${birthYear}`,
    );
    return response.data;
  },

  /**
   * Create a limit for a year that has none (409 if one already exists)
   * POST /year-limits
   */
  createYearLimit: async (
    data: YearLimitCreateRequest,
  ): Promise<ApiResponse<YearLimitRead>> => {
    const response = await apiClient.post<ApiResponse<YearLimitRead>>(
      "/year-limits",
      data,
    );
    return response.data;
  },

  /**
   * Change an existing limit (404 if the year has none)
   * PATCH /year-limits/{birth_year}
   */
  updateYearLimit: async (
    birthYear: number,
    data: YearLimitUpdateRequest,
  ): Promise<ApiResponse<YearLimitRead>> => {
    const response = await apiClient.patch<ApiResponse<YearLimitRead>>(
      `/year-limits/${birthYear}`,
      data,
    );
    return response.data;
  },

  /**
   * Set a year's limit whatever its current state — create it if the year has
   * none, update it if it already has one.
   *
   * The two endpoints are not interchangeable: POST on a year that already has
   * a limit answers 409, PATCH on a year that has none answers 404. So read the
   * year first and pick the right one, and if the year gains a limit between
   * that read and the write (another admin, a second tab), fall through to the
   * update the caller meant rather than surfacing the 409.
   *
   * Errors reach the caller as `detail` (global toast suppressed) so the form
   * can show them in place.
   */
  setYearLimit: async (
    birthYear: number,
    maxStudents: number,
  ): Promise<ApiResponse<YearLimitRead>> => {
    const patch = async () => {
      const response = await apiClient.patch<ApiResponse<YearLimitRead>>(
        `/year-limits/${birthYear}`,
        { max_students: maxStudents },
        { suppressGlobalErrorToast: true } as object,
      );
      return response.data;
    };

    const current = await apiClient.get<ApiResponse<YearLimitUsage>>(
      `/year-limits/${birthYear}`,
      { suppressGlobalErrorToast: true } as object,
    );

    if (current.data.data.has_limit) return patch();

    try {
      const response = await apiClient.post<ApiResponse<YearLimitRead>>(
        "/year-limits",
        { birth_year: birthYear, max_students: maxStudents },
        { suppressGlobalErrorToast: true } as object,
      );
      return response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) return patch();
      throw error;
    }
  },

  /**
   * Remove the limit — the year becomes unlimited again
   * DELETE /year-limits/{birth_year}
   */
  deleteYearLimit: async (
    birthYear: number,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/year-limits/${birthYear}`,
    );
    return response.data;
  },
};
