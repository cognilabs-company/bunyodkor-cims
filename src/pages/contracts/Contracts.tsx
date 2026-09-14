/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  contractService,
  groupService,
  reportService,
  studentService,
} from "@/services/api.service";
import { useGroupsStore } from "@/store/groupsStore";
import { useLanguageStore } from "@/store/languageStore";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";
import { downloadFile } from "@/lib/export-utils";
import { compareContractsNewestFirst } from "@/lib/contract-order";
import {
  buildSearchEntry,
  matchesSearch,
  tokenizeQuery,
} from "@/lib/search-utils";
import {
  formatFullName,
  formatGroupSelectLabel,
  formatNameParts,
} from "@/lib/name-utils";
import { ContractDialog } from "./ContractDialog";
import type {
  ContractWithStudentNameRead,
  TerminatedStudentItem,
  TerminatedUnpaidReportItem,
} from "@/types/api";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Download,
  Edit,
  FileText,
  Loader2,
  Search,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

type ContractsView = "contracts" | "terminated-students" | "terminated-unpaid";

const CONTRACTS_PAGE_SIZE = 10;

export default function Contracts() {
  const { t } = useLanguageStore();
  const { isReadOnly } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();

  const [view, setView] = useState<ContractsView>("contracts");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  // Seeded from the URL on first render, so a link with ?group_id= loads the
  // filtered list once instead of loading everything and then again filtered.
  const readIdParam = (name: string) => {
    const value = searchParams.get(name);
    return value ? parseInt(value, 10) : undefined;
  };
  const [groupFilter, setGroupFilter] = useState<number | undefined>(() =>
    readIdParam("group_id"),
  );
  const [contractIdFilter, setContractIdFilter] = useState<number | undefined>(
    () => readIdParam("contract_id"),
  );
  const [archiveYearFilter, setArchiveYearFilter] = useState<
    number | undefined
  >(currentYear);
  const [terminatedFrom, setTerminatedFrom] = useState("");
  const [terminatedTo, setTerminatedTo] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] =
    useState<ContractWithStudentNameRead | null>(null);
  const [expandedTerminatedContractId, setExpandedTerminatedContractId] =
    useState<number | null>(null);

  const { groupsData: allGroupsData, isLoading: isLoadingGroups, fetchGroups } =
    useGroupsStore();

  useEffect(() => {
    if (!allGroupsData && !isLoadingGroups) {
      fetchGroups();
    }
  }, [allGroupsData, isLoadingGroups, fetchGroups]);

  useEffect(() => {
    const groupId = searchParams.get("group_id");
    const contractId = searchParams.get("contract_id");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroupFilter(groupId ? parseInt(groupId, 10) : undefined);
    setContractIdFilter(contractId ? parseInt(contractId, 10) : undefined);
  }, [searchParams]);

  const debouncedSearch = useDebounce(search, 500);
  const contractGroupOptions = useMemo(
    () => [
      {
        value: "",
        label: isLoadingGroups ? t("loading") : t("allGroups"),
      },
      ...(allGroupsData && Array.isArray(allGroupsData)
        ? allGroupsData.flatMap((yearGroup: any) => {
            if (!yearGroup?.groups || !Array.isArray(yearGroup.groups)) {
              return [];
            }

            return yearGroup.groups
              .filter((group: any) => group && group.id && group.name)
              .map((group: any) => ({
                value: String(group.id),
                label: formatGroupSelectLabel(group),
                keywords: [
                  group.name,
                  group.birth_year,
                  group.coach_first_name,
                  group.coach_last_name,
                ]
                  .filter(Boolean)
                  .map(String),
              }));
          })
        : []),
    ],
    [allGroupsData, isLoadingGroups, t],
  );

  // The whole filtered set, loaded once per filter combination. Sorting and
  // searching happen below, in the browser: both need every row, and typing in
  // the search box then costs no network round-trip at all.
  const [loadProgress, setLoadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);

  const contractsQuery = useQuery({
    queryKey: ["contracts", "all", statusFilter, groupFilter, archiveYearFilter],
    queryFn: async () => {
      setLoadProgress(null);
      const rows = await contractService.getAllContractsWithStudentName(
        {
          status: statusFilter || undefined,
          group_id: groupFilter,
          archive_year: archiveYearFilter,
        },
        (loaded, total) => setLoadProgress({ loaded, total }),
      );
      setLoadProgress(null);
      return rows;
    },
    enabled: view === "contracts",
    placeholderData: keepPreviousData,
    // A full list is costly to fetch: keep it around. Coming back to the page
    // shows the cached list at once and refreshes it quietly once stale.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // `/contracts/withname` rows can arrive without `student_id`. Look it up only
  // for the contract actually clicked, then open that student.
  const [openingStudentFor, setOpeningStudentFor] = useState<number | null>(
    null,
  );

  const openContractStudent = async (contract: ContractWithStudentNameRead) => {
    if (contract.student_id) {
      navigate(`/students/${contract.student_id}`);
      return;
    }
    if (openingStudentFor) return;

    setOpeningStudentFor(contract.id);
    try {
      // Same lookup the old list used for every row (`contract_number` filter
      // on /contracts), now done for this one contract only.
      const response = await contractService.getContracts({
        contract_number: contract.contract_number,
        page: 1,
        page_size: 20,
      });
      const studentId = response.data?.find(
        (row) => row.id === contract.id,
      )?.student_id;
      if (studentId) {
        navigate(`/students/${studentId}`);
      }
    } catch {
      // The response interceptor already shows the error.
    } finally {
      setOpeningStudentFor(null);
    }
  };

  // group_id → group, for the group name and birth year of each contract.
  const groupById = useMemo(() => {
    const map = new Map<number, { name: string; birth_year: number }>();
    (allGroupsData || []).forEach((yearGroup: any) =>
      (yearGroup?.groups || []).forEach((group: any) => {
        if (group?.id) map.set(group.id, group);
      }),
    );
    return map;
  }, [allGroupsData]);

  // Newest contracts first (added today, then yesterday, …) — see
  // lib/contract-order.
  const indexedContracts = useMemo(() => {
    return [...(contractsQuery.data || [])]
      .sort(compareContractsNewestFirst)
      .map((contract) => {
        const group = groupById.get(contract.group_id);
        return {
          contract,
          search: buildSearchEntry([
            contract.student_full_name,
            contract.contract_number,
            group?.name,
            contract.birth_year ?? group?.birth_year,
          ]),
        };
      });
  }, [contractsQuery.data, groupById]);

  // Search follows every keystroke; useDeferredValue keeps typing smooth.
  const contractsSearch = useDeferredValue(search);

  const filteredContracts = useMemo(() => {
    const tokens = tokenizeQuery(contractsSearch);
    return indexedContracts
      .filter(
        ({ contract, search: entry }) =>
          (!contractIdFilter || contract.id === contractIdFilter) &&
          (tokens.length === 0 || matchesSearch(entry, tokens)),
      )
      .map(({ contract }) => contract);
  }, [indexedContracts, contractsSearch, contractIdFilter]);

  const contractsPageData = useMemo(() => {
    const totalPagesForContracts = Math.max(
      1,
      Math.ceil(filteredContracts.length / CONTRACTS_PAGE_SIZE),
    );
    const currentPage = Math.min(page, totalPagesForContracts);
    const start = (currentPage - 1) * CONTRACTS_PAGE_SIZE;
    return {
      data: filteredContracts.slice(start, start + CONTRACTS_PAGE_SIZE),
      meta: {
        page: currentPage,
        page_size: CONTRACTS_PAGE_SIZE,
        total: filteredContracts.length,
        total_pages: totalPagesForContracts,
      },
    };
  }, [filteredContracts, page]);

  const terminatedSummaryQuery = useQuery({
    queryKey: ["contracts-terminated-summary", terminatedFrom, terminatedTo],
    queryFn: () =>
      reportService.getTerminatedSummary({
        // params if needed based on the endpoint, but API docs didn't specify date range params for this one
      }),
    enabled: view === "terminated-students" || view === "terminated-unpaid",
  });

  const terminatedStudentsQuery = useQuery({
    queryKey: [
      "contracts-terminated-students",
      page,
      debouncedSearch,
      groupFilter,
      archiveYearFilter,
      terminatedFrom,
      terminatedTo,
      view,
    ],
    queryFn: () =>
      contractService.getTerminatedStudents({
        archive_year: archiveYearFilter,
        group_id: groupFilter,
        search: debouncedSearch || undefined,
        terminated_from: terminatedFrom || undefined,
        terminated_to: terminatedTo || undefined,
        page,
        page_size: 10,
      }),
    enabled: view === "terminated-students",
  });

  const terminatedUnpaidQuery = useQuery({
    queryKey: [
      "contracts-terminated-unpaid",
      page,
      debouncedSearch,
      groupFilter,
      archiveYearFilter,
      terminatedFrom,
      terminatedTo,
      view,
    ],
    queryFn: () =>
      contractService.getTerminatedUnpaidReport({
        archive_year: archiveYearFilter,
        group_id: groupFilter,
        search: debouncedSearch || undefined,
        terminated_from: terminatedFrom || undefined,
        terminated_to: terminatedTo || undefined,
        page,
        page_size: 10,
      }),
    enabled: view === "terminated-unpaid",
  });

  const { data: groupData } = useQuery({
    queryKey: ["group", groupFilter],
    queryFn: () => groupService.getGroup(groupFilter!),
    enabled: !!groupFilter,
  });

  const currentData =
    view === "contracts"
      ? contractsPageData
      : view === "terminated-students"
        ? terminatedStudentsQuery.data
        : terminatedUnpaidQuery.data;

  const isLoading =
    view === "contracts"
      ? contractsQuery.isLoading
      : view === "terminated-students"
        ? terminatedStudentsQuery.isLoading
        : terminatedUnpaidQuery.isLoading;

  const handleOpenDialog = (contract?: ContractWithStudentNameRead) => {
    setSelectedContract(contract || null);
    setIsDialogOpen(true);
  };

  const deleteTerminatedStudentMutation = useMutation({
    mutationFn: (studentId: number) => studentService.hardDeleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["contracts-terminated-students"],
      });
      queryClient.invalidateQueries({
        queryKey: ["contracts-terminated-unpaid"],
      });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students-count"] });
      toast.success(
        t("studentPermanentlyDeleted") || "Talaba butunlay o'chirildi",
      );
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      let errorMessage = t("failedToDeleteStudent");

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }

      toast.error(errorMessage);
    },
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    return `${new Intl.NumberFormat("uz-UZ").format(amount)} UZS`;
  };

  const formatSource = (source: string | null | undefined) => {
    const clean = source?.toString().replace(/^.*\./, "").toLowerCase() || "";
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "-";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      active: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
      },
      expired: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      terminated: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
      archived: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
      },
      deleted: {
        bg: "bg-gray-100 dark:bg-gray-900/30",
        text: "text-gray-700 dark:text-gray-400",
      },
      cancelled: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
    };
    return (
      <Badge
        className={`${variants[status]?.bg || "bg-muted"} ${variants[status]?.text || "text-foreground"} border-0`}
      >
        {t(status as any) || status}
      </Badge>
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleArchiveYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = e.target.value;
    setArchiveYearFilter(year ? parseInt(year, 10) : undefined);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(view === "contracts" ? "active" : "");
    setGroupFilter(undefined);
    setContractIdFilter(undefined);
    setArchiveYearFilter(currentYear);
    setTerminatedFrom("");
    setTerminatedTo("");
    setExpandedTerminatedContractId(null);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search ||
      groupFilter ||
      archiveYearFilter ||
      contractIdFilter ||
      (view === "contracts" && statusFilter) ||
      (view !== "contracts" && (terminatedFrom || terminatedTo)),
  );

  const handleViewChange = (nextView: ContractsView) => {
    setView(nextView);
    setPage(1);
    setStatusFilter(nextView === "contracts" ? "active" : "");
    setArchiveYearFilter(currentYear);
    setExpandedTerminatedContractId(null);
  };

  const handleOpenStudentDetail = (studentId?: number) => {
    if (!studentId) return;

    void queryClient.prefetchQuery({
      queryKey: ["student-full-info", studentId],
      queryFn: () => studentService.getStudentFullInfo(studentId),
    });

    navigate(`/students/${studentId}`);
  };

  const handleExportTerminatedUnpaid = async () => {
    const promise = (async () => {
      const blob = await contractService.exportTerminatedUnpaidReport({
        archive_year: archiveYearFilter,
        group_id: groupFilter,
        search: debouncedSearch || undefined,
        terminated_from: terminatedFrom || undefined,
        terminated_to: terminatedTo || undefined,
      });

      if (!blob || blob.size === 0) {
        throw new Error("NO_DATA");
      }

      const date = format(new Date(), "yyyy-MM-dd");
      downloadFile(blob, `terminated-unpaid-report-${date}.xlsx`);
    })();

    toast.promise(promise, {
      loading: t("exportingData"),
      success: t("reportExported"),
      error: (error: Error) =>
        error.message === "NO_DATA"
          ? t("noDataToExport")
          : t("failedToExportReport"),
    });
  };

  const totalPages = currentData?.meta?.total_pages || 1;

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (page >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  const paginationItems = getPaginationItems();

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("contracts")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("manageContracts")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={view === "contracts" ? "default" : "outline"}
            onClick={() => handleViewChange("contracts")}
          >
            {t("contractsList")}
          </Button>
          <Button
            variant={view === "terminated-students" ? "default" : "outline"}
            onClick={() => handleViewChange("terminated-students")}
          >
            {t("terminatedStudents")}
          </Button>
          <Button
            variant={view === "terminated-unpaid" ? "default" : "outline"}
            onClick={() => handleViewChange("terminated-unpaid")}
          >
            {t("terminatedUnpaidReport")}
          </Button>
          {view === "terminated-unpaid" && (
            <Button variant="outline" onClick={handleExportTerminatedUnpaid}>
              <Download className="w-4 h-4 mr-2" />
              {t("exportReport")}
            </Button>
          )}
        </div>
      </motion.div>

      {view !== "contracts" && terminatedSummaryQuery.data?.data && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("terminatedCount") || "Terminated"}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{terminatedSummaryQuery.data.data.terminated_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("totalDebt") || "Total Debt"}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-red-600">{formatCurrency(terminatedSummaryQuery.data.data.total_debt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("withDebtCount") || "With Debt"}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{terminatedSummaryQuery.data.data.with_debt_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("noDebtCount") || "No Debt"}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-green-600">{terminatedSummaryQuery.data.data.no_debt_count}</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={
                    view === "contracts"
                      ? t("searchContractsPlaceholder")
                      : t("searchByContractNumber")
                  }
                  value={search}
                  onChange={handleSearchChange}
                  className="pl-10 pr-10"
                />
                {search && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {view === "contracts" && (
                  <Select
                    value={statusFilter}
                    onChange={handleStatusChange}
                    className="w-40"
                  >
                    <option value="">{t("allStatuses")}</option>
                    <option value="active">{t("active")}</option>
                    <option value="expired">{t("expired")}</option>
                    <option value="cancelled">{t("cancelled")}</option>
                    <option value="archived">{t("archived")}</option>
                    <option value="deleted">{t("deleted")}</option>
                  </Select>
                )}

                <Select
                  value={archiveYearFilter?.toString() || ""}
                  onChange={handleArchiveYearChange}
                  className="w-40"
                >
                  <option value="">{t("allYears")}</option>
                  {Array.from({ length: 11 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </Select>

                <SearchableSelect
                  value={groupFilter?.toString() || ""}
                  onValueChange={(value) => {
                    setGroupFilter(value ? parseInt(value, 10) : undefined);
                    setPage(1);
                  }}
                  options={contractGroupOptions}
                  placeholder={t("allGroups")}
                  searchPlaceholder={`${t("search")}...`}
                  emptyText={t("noDataFound")}
                  className="w-full sm:w-[26rem] lg:w-[30rem]"
                  triggerClassName="h-9"
                  disabled={isLoadingGroups}
                />

                {view !== "contracts" && (
                  <>
                    <Input
                      type="date"
                      value={terminatedFrom}
                      onChange={(e) => {
                        setTerminatedFrom(e.target.value);
                        setPage(1);
                      }}
                      className="w-40"
                    />
                    <Input
                      type="date"
                      value={terminatedTo}
                      onChange={(e) => {
                        setTerminatedTo(e.target.value);
                        setPage(1);
                      }}
                      className="w-40"
                    />
                  </>
                )}

                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {groupFilter && groupData?.data && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("filteringByGroup")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {groupData.data.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-2" />
                  {t("clearFilter")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex flex-wrap items-center gap-2">
              {view === "contracts"
                ? t("contractsList")
                : view === "terminated-students"
                  ? t("terminatedStudents")
                  : t("terminatedUnpaidReport")}
              {/* How many rows the current filters and search leave. */}
              {view === "contracts" && contractsQuery.data && (
                <Badge variant="secondary" className="font-semibold">
                  {filteredContracts.length}
                  {contractsSearch.trim() &&
                    ` / ${contractsQuery.data.length}`}
                </Badge>
              )}
              {view === "contracts" && contractsQuery.isFetching && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="flex items-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">
                  {t("loading") || "Loading..."}
                  {/* How far the full list has come, so a long load reads as
                      progress rather than a hang. */}
                  {view === "contracts" && loadProgress && loadProgress.total > 0 && (
                    <span className="ml-1 tabular-nums">
                      {loadProgress.loaded} / {loadProgress.total}
                    </span>
                  )}
                </span>
              </div>
              {view === "contracts" && loadProgress && loadProgress.total > 0 && (
                <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (loadProgress.loaded / loadProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("contractNumber")}</TableHead>
                    <TableHead>{t("student")}</TableHead>
                    {view === "contracts" ? (
                      <>
                        <TableHead className="hidden lg:table-cell">
                          {t("period")}
                        </TableHead>
                        <TableHead>{t("monthlyFee")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead className="text-right [&>div]:justify-end">
                          {t("actions")}
                        </TableHead>
                      </>
                    ) : view === "terminated-students" ? (
                      <>
                        <TableHead>{t("group")}</TableHead>
                        <TableHead>{t("terminatedAt")}</TableHead>
                        <TableHead>{t("paymentsTotal")}</TableHead>
                        <TableHead>{t("reason") || "Reason"}</TableHead>
                        <TableHead className="text-right [&>div]:justify-end">
                          {t("actions")}
                        </TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>{t("group")}</TableHead>
                        <TableHead>{t("terminatedAt")}</TableHead>
                        <TableHead>{t("paid") || "Paid"}</TableHead>
                        <TableHead>{t("unpaid") || "Unpaid"}</TableHead>
                        <TableHead>{t("debt") || "Debt"}</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {view === "contracts" ? (
                    currentData?.data && currentData.data.length > 0 ? (
                      (currentData.data as ContractWithStudentNameRead[]).map(
                        (contract) => (
                          <TableRow key={contract.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {contract.contract_number}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div
                                className="flex items-center gap-2 cursor-pointer group select-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openContractStudent(contract);
                                }}
                              >
                                {openingStudentFor === contract.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                ) : (
                                  <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                )}
                                <span className="font-medium text-foreground group-hover:text-primary group-hover:underline transition-colors">
                                  {formatFullName(contract.student_full_name) ||
                                    contract.student_full_name ||
                                    t("unknown") ||
                                    "Noma'lum"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="text-sm">
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                  {contract.start_date
                                    ? format(
                                        new Date(contract.start_date),
                                        "MMM d, yyyy",
                                      )
                                    : "-"}
                                </div>
                                <div className="text-muted-foreground">
                                  to{" "}
                                  {contract.end_date
                                    ? format(new Date(contract.end_date), "MMM d, yyyy")
                                    : "-"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {formatCurrency(contract.monthly_fee)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {contract.status ? (
                                getStatusBadge(contract.status)
                              ) : (
                                <Badge variant="secondary">
                                  {t("unknown") || "Noma'lum"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenDialog(contract)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ),
                      )
                    ) : (
                      <TableEmpty
                        icon={<FileText className="w-12 h-12" />}
                        title={t("noContractsFound")}
                        description={t("contractsCreatedHere")}
                      />
                    )
                  ) : view === "terminated-students" ? (
                    currentData?.data && currentData.data.length > 0 ? (
                      (currentData.data as TerminatedStudentItem[]).map((item) => {
                        const isExpanded =
                          expandedTerminatedContractId === item.contract_id;
                        const fullStudentName = formatNameParts(
                          item.student_last_name,
                          item.student_first_name,
                        );

                        return (
                          <Fragment key={item.contract_id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() =>
                                setExpandedTerminatedContractId((prev) =>
                                  prev === item.contract_id ? null : item.contract_id,
                                )
                              }
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">
                                    {item.contract_number}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div
                                  className="flex items-center gap-2 cursor-pointer group select-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenStudentDetail(item.student_id);
                                  }}
                                >
                                  <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                  <span className="font-medium text-foreground group-hover:text-primary group-hover:underline transition-colors">
                                    {fullStudentName || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{item.student_group_name || "-"}</TableCell>
                              <TableCell>
                                {item.terminated_at
                                  ? format(
                                      new Date(item.terminated_at),
                                      "MMM d, yyyy HH:mm",
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {formatCurrency(item.successful_payments_total)}
                              </TableCell>
                              <TableCell>{item.termination_reason || "-"}</TableCell>
                              <TableCell className="text-right">
                                {!isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                    disabled={deleteTerminatedStudentMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!item.student_id) return;

                                      const fullName = formatNameParts(
                                        item.student_last_name,
                                        item.student_first_name,
                                      );
                                      const confirmDelete = window.confirm(
                                        `${t("confirmDeleteStudent")} ${fullName || `ID: ${item.student_id}`}?`,
                                      );

                                      if (!confirmDelete) return;
                                      deleteTerminatedStudentMutation.mutate(
                                        item.student_id,
                                      );
                                    }}
                                    title={t("deleteStudent")}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-muted/20">
                                <TableCell colSpan={7}>
                                  <div className="space-y-4 p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("contractNumber")}
                                        </p>
                                        <p className="font-medium">
                                          {item.contract_number || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("student")}
                                        </p>
                                        <p className="font-medium">
                                          {fullStudentName || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("phoneNumber")}
                                        </p>
                                        <p className="font-medium">
                                          {item.student_phone || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("group")}
                                        </p>
                                        <p className="font-medium">
                                          {item.student_group_name || "-"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("monthlyFee")}
                                        </p>
                                        <p className="font-medium">
                                          {formatCurrency(item.monthly_fee)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("terminatedBy") || "Terminated by"}
                                        </p>
                                        <p className="font-medium">
                                          {formatFullName(
                                              item.terminated_by_full_name,
                                            ) ||
                                            (item.terminated_by_user_id
                                              ? `ID: ${item.terminated_by_user_id}`
                                              : "-")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("paymentsTotal")}
                                        </p>
                                        <p className="font-medium">
                                          {formatCurrency(item.successful_payments_total)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">
                                          {t("paymentsCount") || "Payments count"}
                                        </p>
                                        <p className="font-medium">
                                          {item.successful_payments_count ?? 0}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-sm font-semibold">
                                        {t("successfulPayments") || "Successful payments"}
                                      </p>
                                      {item.successful_payments &&
                                      item.successful_payments.length > 0 ? (
                                        <div className="overflow-x-auto rounded-md border border-border">
                                          <table className="w-full text-sm">
                                            <thead className="bg-muted/40">
                                              <tr>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  ID
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  {t("source")}
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  {t("amount")}
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  {t("date")}
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  {t("paymentYear") || "Year"}
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                  {t("paymentMonth") || "Months"}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {item.successful_payments.map((payment) => (
                                                <tr
                                                  key={payment.transaction_id}
                                                  className="border-t border-border"
                                                >
                                                  <td className="px-3 py-2">
                                                    #{payment.transaction_id}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {formatSource(payment.source)}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {formatCurrency(payment.amount)}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {payment.paid_at
                                                      ? format(
                                                          new Date(payment.paid_at),
                                                          "MMM d, yyyy HH:mm",
                                                        )
                                                      : "-"}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {payment.payment_year || "-"}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {payment.payment_months?.length
                                                      ? payment.payment_months.join(", ")
                                                      : "-"}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          {t("noData") || "No data"}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })
                    ) : (
                      <TableEmpty
                        icon={<FileText className="w-12 h-12" />}
                        title={t("noDataToExport")}
                        description={t("noTerminatedStudents")}
                      />
                    )
                  ) : currentData?.data && currentData.data.length > 0 ? (
                    (currentData.data as TerminatedUnpaidReportItem[]).map((item) => (
                      <TableRow key={item.contract_id}>
                        <TableCell>{item.contract_number}</TableCell>
                        <TableCell>
                          <div
                            className="flex items-center gap-2 cursor-pointer group select-none"
                            onClick={() => handleOpenStudentDetail(item.student_id)}
                          >
                            <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="font-medium text-foreground group-hover:text-primary group-hover:underline transition-colors">
                              {formatNameParts(
                                item.student_last_name,
                                item.student_first_name,
                              ) || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.contract_group_name ||
                            item.current_student_group_name ||
                            "-"}
                        </TableCell>
                        <TableCell>
                          {item.terminated_at
                            ? format(new Date(item.terminated_at), "MMM d, yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>{item.paid_months_count}</TableCell>
                        <TableCell>{item.unpaid_months_count}</TableCell>
                        <TableCell>{formatCurrency(item.debt_amount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmpty
                      icon={<FileText className="w-12 h-12" />}
                      title={t("noDataToExport")}
                      description={t("noTerminatedUnpaidData")}
                    />
                  )}
                </TableBody>
              </Table>

              {currentData?.meta && (currentData.meta.total_pages || 0) > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 w-9 p-0 lg:w-auto lg:px-4 lg:py-2"
                  >
                    <ChevronLeft className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">{t("previous")}</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    {paginationItems.map((item, index) =>
                      typeof item === "number" ? (
                        <Button
                          key={`${item}-${index}`}
                          variant={page === item ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPage(item)}
                          className="w-9 h-9 p-0 font-medium"
                        >
                          {item}
                        </Button>
                      ) : (
                        <span
                          key={`dots-${index}`}
                          className="flex items-center justify-center w-9 h-9 text-muted-foreground"
                        >
                          ...
                        </span>
                      ),
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 w-9 p-0 lg:w-auto lg:px-4 lg:py-2"
                  >
                    <span className="hidden lg:inline">{t("next")}</span>
                    <ChevronRight className="h-4 w-4 lg:ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </motion.div>

      <ContractDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        contract={selectedContract}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />
    </div>
  );
}
