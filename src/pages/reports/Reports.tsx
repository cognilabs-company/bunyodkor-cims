/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TablePagination,
  TableEmpty,
} from "@/components/ui/table";
import { BarChart, DonutChart, StatsCard } from "@/components/ui/charts";
import {
  reportService,
  groupService,
  studentService,
} from "@/services/api.service";
import type { DebtorItem, GroupAttendanceReport, GroupRead } from "@/types/api";

import PayersReport from "./PayersReport";
import {
  BarChart3,
  TrendingUp,
  Users,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import toast from "react-hot-toast";
import { downloadFile, exportReport } from "@/lib/export-utils";
import { formatFullName, formatGroupSelectLabel } from "@/lib/name-utils";
import { useLanguageStore } from "@/store/languageStore";
import {
  cn,
  formatCurrency as formatCurrencyUtil,
} from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const ATTENDANCE_CHART_LIMIT = 12;

const normalizePercentage = (value?: number | null) => {
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(safeValue * 10) / 10;
};

const formatPercentage = (value?: number | null) => {
  const rounded = normalizePercentage(value);
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

const getAttendanceChartColor = (value: number) => {
  if (value >= 80) return "hsl(142, 71%, 45%)";
  if (value >= 60) return "hsl(47, 96%, 53%)";
  return "hsl(349, 89%, 60%)";
};

export default function Reports() {
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const [activeTab, setActiveTab] = useState<
    "finance" | "attendance" | "debtors" | "payers" | "terminated"
  >("finance");
  const [dateRange, setDateRange] = useState({
    from: `${currentYear}-01-01`,
    to: `${currentYear}-12-31`,
  });
  const [attendanceChartMode, setAttendanceChartMode] = useState<
    "lowest" | "highest" | "all"
  >("lowest");
  const [debtorsPage, setDebtorsPage] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [minDebtAmount, setMinDebtAmount] = useState<number | "">("");
  const [unpaidYear, setUnpaidYear] = useState<number | "">(currentYear);
  const [unpaidMonth, setUnpaidMonth] = useState<number | "">(currentMonth);
  const [unpaidMonths, setUnpaidMonths] = useState("");
  const [unpaidFromDate, setUnpaidFromDate] = useState("");
  const [unpaidToDate, setUnpaidToDate] = useState("");
  const [terminatedYear, setTerminatedYear] = useState<number | "">(currentYear);
  const [terminatedGroupId, setTerminatedGroupId] = useState<number | null>(null);
  const debtorsPageSize = 20;
  const monthOptions = useMemo(
    () => [
      { value: 1, label: t("january") || "January" },
      { value: 2, label: t("february") || "February" },
      { value: 3, label: t("march") || "March" },
      { value: 4, label: t("april") || "April" },
      { value: 5, label: t("may") || "May" },
      { value: 6, label: t("june") || "June" },
      { value: 7, label: t("july") || "July" },
      { value: 8, label: t("august") || "August" },
      { value: 9, label: t("september") || "September" },
      { value: 10, label: t("october") || "October" },
      { value: 11, label: t("november") || "November" },
      { value: 12, label: t("december") || "December" },
    ],
    [t],
  );

  const { data: financeReport, isLoading: financeLoading } = useQuery({
    queryKey: ["finance-report", dateRange],
    queryFn: () =>
      reportService.getFinanceReport({
        from_date: dateRange.from,
        to_date: dateRange.to,
      }),
    enabled: activeTab === "finance",
  });

  const { data: attendanceReport, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendance-report"],
    queryFn: () => reportService.getGroupAttendanceReports(),
    enabled: activeTab === "attendance",
  });

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-list-all"],
    queryFn: async () => {
      const firstPage = await groupService.getGroups({ page: 1, page_size: 100 });
      const firstData = firstPage.data || [];
      const totalPages = firstPage.meta?.total_pages || 1;

      if (totalPages <= 1) {
        return { data: firstData };
      }

      const restPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) =>
          groupService.getGroups({ page: idx + 2, page_size: 100 }),
        ),
      );

      const allGroups = [...firstData, ...restPages.flatMap((page) => page.data || [])];

      return {
        data: allGroups.sort((a, b) => {
          const yearA = Number(a.birth_year ?? 0);
          const yearB = Number(b.birth_year ?? 0);

          if (yearA !== yearB) {
            return yearA - yearB;
          }

          return formatGroupSelectLabel(a).localeCompare(formatGroupSelectLabel(b));
        }),
      };
    },
    enabled: activeTab === "debtors" || activeTab === "terminated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Normalize groups response in case API returns nested `data` (e.g. { data: { data: [...] } })
  const groupsList: GroupRead[] = useMemo(() => {
    if (!groupsData?.data) return [];
    return groupsData.data;
  }, [groupsData]);
  const sortedGroupsList: GroupRead[] = useMemo(
    () =>
      [...groupsList].sort((a, b) => {
        const yearA = Number(a.birth_year ?? 0);
        const yearB = Number(b.birth_year ?? 0);

        if (yearA !== yearB) {
          return yearA - yearB;
        }

        return formatGroupSelectLabel(a).localeCompare(formatGroupSelectLabel(b));
      }),
    [groupsList],
  );
  const debtorsGroupOptions = useMemo(
    () => [
      {
        value: "",
        label: groupsLoading ? t("loading") : t("allGroups"),
      },
      ...sortedGroupsList.map((group) => ({
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
      })),
    ],
    [groupsLoading, sortedGroupsList, t],
  );
  const debtorsYearOptions = useMemo(
    () => [
      { value: "", label: t("allYears") || "All years" },
      ...[
        currentYear - 2,
        currentYear - 1,
        currentYear,
        currentYear + 1,
      ].map((year) => ({
        value: String(year),
        label: String(year),
      })),
    ],
    [currentYear, t],
  );
  const debtorsMonthOptions = useMemo(
    () => [
      { value: "", label: t("allMonths") || "All months" },
      ...monthOptions.map((month) => ({
        value: String(month.value),
        label: month.label,
      })),
    ],
    [monthOptions, t],
  );

  const parsedSingleMonth = useMemo(() => {
    if (unpaidMonths.trim() === "") return null;
    const parts = unpaidMonths.trim().split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 1) return null;
    const n = Number(parts[0]);
    return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
  }, [unpaidMonths]);

  const effectiveMonth = unpaidMonth !== "" ? Number(unpaidMonth) : parsedSingleMonth ?? undefined;

  const hasUnpaidListFilter = Boolean(
    unpaidYear !== "" ||
      unpaidMonth !== "" ||
      unpaidMonths.trim() !== "" ||
      unpaidFromDate ||
      unpaidToDate,
  );
  const hasAdvancedUnpaidListFilter = Boolean(
    (unpaidMonths.trim() !== "" && parsedSingleMonth === null) ||
    unpaidFromDate ||
    unpaidToDate,
  );

  const getUnpaidFilterParams = () => {
    const params: {
      year?: number;
      month?: number;
      months?: string;
      from_date?: string;
      to_date?: string;
      group_id?: number;
    } = {
      group_id: selectedGroupId || undefined,
    };

    const hasDateRange = Boolean(unpaidFromDate || unpaidToDate);
    if (hasDateRange) {
      params.from_date = unpaidFromDate || undefined;
      params.to_date = unpaidToDate || undefined;
      return params;
    }

    params.year = unpaidYear === "" ? undefined : Number(unpaidYear);
    params.month = unpaidMonth === "" ? undefined : Number(unpaidMonth);
    params.months = unpaidMonths.trim() === "" ? undefined : unpaidMonths.trim();
    return params;
  };

  const { data: debtorsData, isLoading: isDebtorsBaseLoading } = useQuery({
    queryKey: [
      "debtors-report",
      debtorsPage,
      selectedGroupId,
      minDebtAmount,
      unpaidYear,
      unpaidMonth,
      unpaidMonths,
    ],
    queryFn: () =>
      reportService.getDebtorsReport({
        page: debtorsPage,
        page_size: debtorsPageSize,
        group_id: selectedGroupId || undefined,
        min_debt_amount:
          minDebtAmount === "" ? undefined : Number(minDebtAmount),
        year: unpaidYear === "" ? undefined : Number(unpaidYear),
        month: effectiveMonth,
      }),
    enabled: activeTab === "debtors" && !hasAdvancedUnpaidListFilter,
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: debtorsFilteredData, isLoading: isDebtorsFilteredLoading } = useQuery({
    queryKey: [
      "debtors-report-filtered-unpaid",
      debtorsPage,
      selectedGroupId,
      minDebtAmount,
      unpaidYear,
      unpaidMonth,
      unpaidMonths,
      unpaidFromDate,
      unpaidToDate,
    ],
    queryFn: async () => {
      const debtorYear = unpaidYear === "" ? undefined : Number(unpaidYear);

      const debtorsFirstPage = await reportService.getDebtorsReport({
        page: 1,
        page_size: 100,
        group_id: selectedGroupId || undefined,
        min_debt_amount:
          minDebtAmount === "" ? undefined : Number(minDebtAmount),
        year: debtorYear,
      });

      const debtorsPages = debtorsFirstPage.meta?.total_pages || 1;
      const debtorsRestPages =
        debtorsPages > 1
          ? await Promise.all(
              Array.from({ length: debtorsPages - 1 }, (_, idx) =>
                reportService.getDebtorsReport({
                  page: idx + 2,
                  page_size: 100,
                  group_id: selectedGroupId || undefined,
                  min_debt_amount:
                    minDebtAmount === "" ? undefined : Number(minDebtAmount),
                  year: debtorYear,
                }),
              ),
            )
          : [];

      const allDebtors = [
        ...(debtorsFirstPage.data || []),
        ...debtorsRestPages.flatMap((page) => page.data || []),
      ];

      const unpaidFirstPage = await studentService.getUnpaidStudents({
        ...getUnpaidFilterParams(),
        page: 1,
        page_size: 100,
      });

      const unpaidPages = unpaidFirstPage.meta?.total_pages || 1;
      const unpaidRestPages =
        unpaidPages > 1
          ? await Promise.all(
              Array.from({ length: unpaidPages - 1 }, (_, idx) =>
                studentService.getUnpaidStudents({
                  ...getUnpaidFilterParams(),
                  page: idx + 2,
                  page_size: 100,
                }),
              ),
            )
          : [];

      const allUnpaid = [
        ...(unpaidFirstPage.data || []),
        ...unpaidRestPages.flatMap((page) => page.data || []),
      ];

      const unpaidStudentIds = new Set<number>();
      allUnpaid.forEach((item: any) => {
        const studentId = Number(item.student_id ?? item.student?.id);
        if (Number.isFinite(studentId)) {
          unpaidStudentIds.add(studentId);
        }
      });

      const filteredDebtors = allDebtors.filter((debtor) =>
        unpaidStudentIds.has(debtor.student_id),
      );

      const total = filteredDebtors.length;
      const total_pages = Math.max(1, Math.ceil(total / debtorsPageSize));
      const startIndex = (debtorsPage - 1) * debtorsPageSize;
      const paginated = filteredDebtors.slice(
        startIndex,
        startIndex + debtorsPageSize,
      );
      const totalDebt = filteredDebtors.reduce(
        (sum, debtor) => sum + (debtor.debt_amount || 0),
        0,
      );

      return {
        data: paginated,
        meta: {
          page: debtorsPage,
          page_size: debtorsPageSize,
          total,
          total_pages,
        },
        total_debt: totalDebt,
      };
    },
    enabled: activeTab === "debtors" && hasAdvancedUnpaidListFilter,
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: totalDebtData, isLoading: totalDebtLoading } = useQuery({
    queryKey: [
      "debtors-total-debt",
      selectedGroupId,
      minDebtAmount,
      unpaidYear,
      unpaidMonth,
      unpaidMonths,
    ],
    queryFn: async () => {
      const firstPage = await reportService.getDebtorsReport({
        page: 1,
        page_size: 100,
        group_id: selectedGroupId || undefined,
        min_debt_amount:
          minDebtAmount === "" ? undefined : Number(minDebtAmount),
        year: unpaidYear === "" ? undefined : Number(unpaidYear),
        month: effectiveMonth,
      });

      const pages = firstPage.meta?.total_pages || 1;
      const allPages =
        pages > 1
          ? await Promise.all(
              Array.from({ length: pages - 1 }, (_, idx) =>
                reportService.getDebtorsReport({
                  page: idx + 2,
                  page_size: 100,
                  group_id: selectedGroupId || undefined,
                  min_debt_amount:
                    minDebtAmount === "" ? undefined : Number(minDebtAmount),
                  year: unpaidYear === "" ? undefined : Number(unpaidYear),
                  month: effectiveMonth,
                }),
              ),
            )
          : [];

      const combined = [
        ...(firstPage.data || []),
        ...allPages.flatMap((page) => page.data || []),
      ];
      const totalDebt = combined.reduce(
        (sum, debtor) => sum + (debtor.debt_amount || 0),
        0,
      );
      return { total_debt: totalDebt };
    },
    enabled: activeTab === "debtors" && !hasAdvancedUnpaidListFilter,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: terminatedSummaryData, isLoading: terminatedSummaryLoading } = useQuery({
    queryKey: ["terminated-summary", terminatedYear, terminatedGroupId],
    queryFn: () =>
      reportService.getTerminatedSummary({
        archive_year: terminatedYear === "" ? undefined : Number(terminatedYear),
        group_id: terminatedGroupId || undefined,
      }),
    enabled: activeTab === "terminated",
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const effectiveDebtorsData = hasAdvancedUnpaidListFilter ? debtorsFilteredData : debtorsData;
  const debtorsLoading = hasUnpaidListFilter
    ? (hasAdvancedUnpaidListFilter ? isDebtorsFilteredLoading : isDebtorsBaseLoading)
    : isDebtorsBaseLoading;
  const debtorsRowOffset = (debtorsPage - 1) * debtorsPageSize;
  const totalDebtAmount = hasAdvancedUnpaidListFilter
    ? debtorsFilteredData?.total_debt || 0
    : totalDebtData?.total_debt || 0;
  const isTotalDebtLoading = hasUnpaidListFilter
    ? (hasAdvancedUnpaidListFilter ? isDebtorsFilteredLoading : totalDebtLoading)
    : totalDebtLoading;

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, "UZS", "uz-UZ", false);
  };

  const formatPhone = (phone?: string | null) => {
    const value = phone?.trim();
    return value ? value : "-";
  };

  const handleOpenStudentDetail = (studentId?: number) => {
    if (!studentId) return;

    void queryClient.prefetchQuery({
      queryKey: ["student-full-info", studentId],
      queryFn: () => studentService.getStudentFullInfo(studentId),
    });

    navigate(`/students/${studentId}`);
  };

  const formatSource = (source: string) => {
    const cleanSource =
      source?.toString().replace(/^.*\./, "").toLowerCase() || "";
    return cleanSource.charAt(0).toUpperCase() + cleanSource.slice(1);
  };

  const tabs = [
    { id: "finance", label: t("financeReport"), icon: CreditCard },
    { id: "attendance", label: t("attendanceReport"), icon: Users },
    { id: "debtors", label: t("debtors"), icon: AlertTriangle },
    { id: "payers", label: t("payersReport"), icon: Users },
    { id: "terminated", label: t("terminatedReport"), icon: XCircle },
  ];

  const paymentSourcesData =
    financeReport?.data?.breakdown?.map((item: any) => ({
      label: formatSource(item.source),
      value: item.total_amount,
    })) || [];

  const transactionCountData =
    financeReport?.data?.breakdown?.map((item: any) => ({
      label: formatSource(item.source),
      value: item.transaction_count,
    })) || [];

  const attendanceGroups = useMemo<GroupAttendanceReport[]>(() => {
    const data = attendanceReport?.data || [];

    return [...data].sort(
      (a, b) =>
        a.attendance_percentage - b.attendance_percentage ||
        b.total_students - a.total_students,
    );
  }, [attendanceReport]);

  const attendanceAverage = useMemo(() => {
    if (attendanceGroups.length === 0) return 0;

    return (
      attendanceGroups.reduce(
        (sum, group) => sum + group.attendance_percentage,
        0,
      ) / attendanceGroups.length
    );
  }, [attendanceGroups]);

  const lowAttendanceGroupsCount = useMemo(
    () => attendanceGroups.filter((group) => group.attendance_percentage < 60).length,
    [attendanceGroups],
  );

  const highAttendanceGroupsCount = useMemo(
    () => attendanceGroups.filter((group) => group.attendance_percentage >= 80).length,
    [attendanceGroups],
  );

  const attendanceChartGroups = useMemo(() => {
    if (attendanceChartMode === "all") {
      return attendanceGroups;
    }

    const source =
      attendanceChartMode === "highest"
        ? [...attendanceGroups].reverse()
        : attendanceGroups;

    return source.slice(0, ATTENDANCE_CHART_LIMIT);
  }, [attendanceChartMode, attendanceGroups]);

  const attendanceChartData = useMemo(
    () =>
      attendanceChartGroups.map((group) => ({
        label: group.group_name,
        tooltipLabel: group.group_name,
        value: normalizePercentage(group.attendance_percentage),
        color: getAttendanceChartColor(group.attendance_percentage),
      })),
    [attendanceChartGroups],
  );

  // The registration register for one year: every contract of that year,
  // however it ended, with its twelve monthly payment columns. The year is
  // the only parameter the endpoint takes, so "all years" cannot be exported.
  const handleRegistrationExport = async () => {
    if (terminatedYear === "") {
      toast.error(t("selectYearFirst"));
      return;
    }

    const year = Number(terminatedYear);

    const promise = (async () => {
      const blob = await reportService.exportRegistrationExcel({ year });
      if (!blob || blob.size === 0) {
        throw new Error("NO_DATA");
      }
      downloadFile(blob, `registration_${year}.xlsx`);
    })();

    toast.promise(promise, {
      loading: t("exportingData"),
      success: t("exportedSuccessfully"),
      error: (error: Error) =>
        error.message === "NO_DATA"
          ? t("noDataToExport")
          : t("errorExportingData"),
    });
  };

  // Two modes off one endpoint: "general" lists every student in each group,
  // "debtors" only those who owe, with an amount column.
  const handleGroupedDebtorsExport = async (mode: "general" | "debtors") => {
    const year = unpaidYear === "" ? undefined : Number(unpaidYear);
    const month = unpaidMonth === "" ? effectiveMonth : Number(unpaidMonth);

    if (!year || !month) {
      toast.error(t("pleaseSelectYearAndMonth"));
      return;
    }

    const onlyDebtors = mode === "debtors";

    const promise = (async () => {
      const blob = await reportService.exportGroupedDebtorsExcel({
        year,
        month,
        only_debtors: onlyDebtors,
      });
      if (!blob || blob.size === 0) {
        throw new Error("NO_DATA");
      }
      const date = format(new Date(), "yyyy-MM-dd");
      const prefix = onlyDebtors ? "grouped-debtors" : "grouped-students";
      downloadFile(blob, `${prefix}-${year}-${month}-${date}.xlsx`);
    })();

    toast.promise(promise, {
      loading: t("exportingData"),
      success: t("exportedSuccessfully"),
      error: (error: Error) =>
        error.message === "NO_DATA" ? t("noDataToExport") : t("errorExportingData"),
    });
  };

  const handleExport = async () => {
    try {
      let dataToExport: any[] | null = null;
      let reportType = "";

      switch (activeTab) {
        case "finance":
          if (!financeReport?.data?.breakdown?.length) {
            toast.error(t("noFinanceDataToExport"));
            return;
          }
          dataToExport = financeReport.data.breakdown.map((item) => ({
            "Payment Method": formatSource(item.source),
            "Transaction Count": item.transaction_count,
            "Total Amount": item.total_amount,
            "Average Amount": Math.round(
              item.total_amount / (item.transaction_count || 1),
            ),
          }));
          reportType = `finance-report-${dateRange.from}-to-${dateRange.to}`;
          break;

        case "attendance":
          if (!attendanceReport?.data?.length) {
            toast.error(t("noAttendanceDataToExport"));
            return;
          }
          dataToExport = attendanceReport.data.map((group) => ({
            "Group Name": group.group_name,
            "Total Sessions": group.total_sessions,
            "Total Students": group.total_students,
            "Attendance Rate": `${group.attendance_percentage}%`,
          }));
          reportType = "attendance-report";
          break;
      }

      if (dataToExport) {
        exportReport(dataToExport, reportType);
        toast.success(t("exportedSuccessfully"));
      }
    } catch (error) {
      toast.error(t("errorExportingData"));
    }
  };
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("reports")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("analyticsAndInsights")}
          </p>
        </div>
        {activeTab !== "payers" && activeTab !== "terminated" && (
          <div className="flex flex-wrap gap-2">
            {/* The grouped debtors workbook belongs to the debtors tab; the
                finance and attendance tabs export their own report only. */}
            {activeTab === "debtors" ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleGroupedDebtorsExport("debtors")}
              >
                <Download className="w-4 h-4" />
                {t("groupedDebtorsExport")}
              </Button>
            ) : (
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                {t("exportReport")}
              </Button>
            )}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id as any)}
            className="gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </motion.div>

      {/* FINANCE TAB */}
      {activeTab === "finance" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("fromDate")}
                  </label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, from: e.target.value })
                    }
                    className="w-40"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("toDate")}
                  </label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, to: e.target.value })
                    }
                    className="w-40"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                        to: format(new Date(), "yyyy-MM-dd"),
                      })
                    }
                  >
                    {t("last7Days")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                        to: format(new Date(), "yyyy-MM-dd"),
                      })
                    }
                  >
                    {t("last30Days")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                        to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
                      })
                    }
                  >
                    {t("thisMonth")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title={t("totalRevenue")}
              value={formatCurrency(financeReport?.data?.total_revenue || 0)}
              icon={<TrendingUp className="w-6 h-6" />}
            />
            <StatsCard
              title={t("transactions")}
              value={
                financeReport?.data?.breakdown?.reduce(
                  (acc: number, item: any) => acc + item.transaction_count,
                  0,
                ) || 0
              }
              icon={<CreditCard className="w-6 h-6" />}
            />
            <StatsCard
              title={t("paymentMethods")}
              value={financeReport?.data?.breakdown?.length || 0}
              icon={<BarChart3 className="w-6 h-6" />}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
                  <CardTitle className="text-lg shrink-0">
                    {t("revenueBySource")}
                  </CardTitle>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-xl sm:text-2xl font-bold text-foreground break-words overflow-wrap-anywhere">
                      {formatCurrency(financeReport?.data?.total_revenue || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("total")}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {paymentSourcesData.length > 0 ? (
                  <DonutChart data={paymentSourcesData} size={180} showLegend />
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    {t("noData")}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("transactionsBySource")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionCountData.length > 0 ? (
                  <BarChart
                    data={transactionCountData}
                    height={200}
                    horizontal
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    {t("noData")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("detailedBreakdown")}
              </CardTitle>
            </CardHeader>
            <Table isLoading={financeLoading}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("transactions")}
                  </TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("average")}
                  </TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("totalAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeReport?.data?.breakdown?.map((item) => (
                  <TableRow key={item.source}>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatSource(item.source)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.transaction_count}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(
                        Math.round(
                          item.total_amount / (item.transaction_count || 1),
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_amount)}
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableEmpty
                    title={t("noData")}
                    description={t("selectDateRangeForReport")}
                  />
                )}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatsCard
              title={t("averageAttendance")}
              value={
                attendanceLoading ? t("calculating") : `${formatPercentage(attendanceAverage)}%`
              }
              icon={<TrendingUp className="w-6 h-6" />}
            />
            <StatsCard
              title={t("lowAttendanceGroups")}
              value={attendanceLoading ? "-" : lowAttendanceGroupsCount}
              icon={<AlertTriangle className="w-6 h-6" />}
            />
            <StatsCard
              title={t("highAttendanceGroups")}
              value={attendanceLoading ? "-" : highAttendanceGroupsCount}
              icon={<CheckCircle className="w-6 h-6" />}
            />
          </div>

          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {t("groupAttendanceRates")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("allGroups")}: {attendanceGroups.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={attendanceChartMode === "lowest" ? "default" : "outline"}
                    onClick={() => setAttendanceChartMode("lowest")}
                  >
                    {t("weakestGroups")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={attendanceChartMode === "highest" ? "default" : "outline"}
                    onClick={() => setAttendanceChartMode("highest")}
                  >
                    {t("strongestGroups")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={attendanceChartMode === "all" ? "default" : "outline"}
                    onClick={() => setAttendanceChartMode("all")}
                  >
                    {t("allGroups")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : attendanceChartData.length > 0 ? (
                <div
                  className={cn(
                    "rounded-xl border border-border/60 bg-muted/20 p-4",
                    attendanceChartMode === "all" && "max-h-[540px] overflow-y-auto pr-2",
                  )}
                >
                  <BarChart
                    data={attendanceChartData}
                    horizontal
                    showLegend={false}
                    showValues
                    valueFormatter={(value) => `${formatPercentage(value)}%`}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {t("noAttendanceData")}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("groupAttendanceDetails")}
              </CardTitle>
            </CardHeader>
            <Table isLoading={attendanceLoading}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("group")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("totalSessions")}
                  </TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("totalStudents")}
                  </TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("attendanceRate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceGroups.length > 0 ? (
                  attendanceGroups.map((group) => (
                    <TableRow key={group.group_id}>
                      <TableCell className="font-medium">
                        {group.group_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.total_sessions}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.total_students}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={
                            group.attendance_percentage >= 80
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : group.attendance_percentage >= 60
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }
                        >
                          {formatPercentage(group.attendance_percentage)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty
                    title={t("noAttendanceData")}
                    description={t("attendanceDataWillAppear")}
                  />
                )}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      )}

      {/* DEBTORS TAB */}
      {activeTab === "debtors" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full sm:w-[22rem] lg:w-[26rem]">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("group")}
                  </label>
                  <SearchableSelect
                    value={selectedGroupId ? String(selectedGroupId) : ""}
                    onValueChange={(value) => {
                      setSelectedGroupId(value ? Number(value) : null);
                      setDebtorsPage(1);
                    }}
                    options={debtorsGroupOptions}
                    placeholder={t("allGroups")}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    className="w-full"
                    triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={groupsLoading}
                  />
                </div>

                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("paymentYear") || "Year"}
                  </label>
                  <SearchableSelect
                    value={unpaidYear === "" ? "" : String(unpaidYear)}
                    onValueChange={(value) => {
                      setUnpaidYear(value ? Number(value) : "");
                      setDebtorsPage(1);
                    }}
                    options={debtorsYearOptions}
                    placeholder={t("allYears") || "All years"}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    className="w-full"
                    triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("month") || "Month"}
                  </label>
                  <SearchableSelect
                    value={unpaidMonth === "" ? "" : String(unpaidMonth)}
                    onValueChange={(value) => {
                      setUnpaidMonth(value ? Number(value) : "");
                      if (value) {
                        setUnpaidMonths("");
                      }
                      setDebtorsPage(1);
                    }}
                    options={debtorsMonthOptions}
                    placeholder={t("allMonths") || "All months"}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    className="w-full"
                    triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("months") || "Months"}
                  </label>
                  <Input
                    type="text"
                    value={unpaidMonths}
                    onChange={(e) => {
                      setUnpaidMonths(e.target.value);
                      if (e.target.value.trim() !== "") {
                        setUnpaidMonth("");
                      }
                      setDebtorsPage(1);
                    }}
                    placeholder="1,2,3"
                    className="h-10"
                  />
                </div>

                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("fromDate")}
                  </label>
                  <Input
                    type="date"
                    value={unpaidFromDate}
                    onChange={(e) => {
                      setUnpaidFromDate(e.target.value);
                      setDebtorsPage(1);
                    }}
                    className="h-10"
                  />
                </div>

                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("toDate")}
                  </label>
                  <Input
                    type="date"
                    value={unpaidToDate}
                    onChange={(e) => {
                      setUnpaidToDate(e.target.value);
                      setDebtorsPage(1);
                    }}
                    className="h-10"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setMinDebtAmount("");
                    setUnpaidYear(currentYear);
                    setUnpaidMonth(currentMonth);
                    setUnpaidMonths("");
                    setUnpaidFromDate("");
                    setUnpaidToDate("");
                    setDebtorsPage(1);
                  }}
                >
                  {t("clearFilters")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatsCard
              title={t("totalDebtors")}
              value={
                debtorsLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  effectiveDebtorsData?.meta?.total || 0
                )
              }
              icon={
                debtorsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )
              }
            />
            <StatsCard
              title={t("totalDebtAmount")}
              value={
                isTotalDebtLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  formatCurrency(totalDebtAmount)
                )
              }
              icon={
                isTotalDebtLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <CreditCard className="w-6 h-6" />
                )
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("debtorsList")}</CardTitle>
            </CardHeader>
            <Table className="[&_thead_th:first-child]:hidden [&_tbody_td:first-child]:hidden">
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>{t("student")}</TableHead>
                  <TableHead>Ota/Ona</TableHead>
                  <TableHead>{t("group")}</TableHead>
                  <TableHead>{t("contractNumber")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">
                    {t("debtAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtorsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">
                          To'lamaganlar hisoblanmoqda...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : effectiveDebtorsData?.data && effectiveDebtorsData.data.length > 0 ? (
                  effectiveDebtorsData.data.map((debtor: DebtorItem, index: number) => (
                    <TableRow key={`${debtor.student_id}-${debtor.contract_number}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {debtorsRowOffset + index + 1}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-left hover:underline hover:text-primary transition-colors"
                          onClick={() => handleOpenStudentDetail(debtor.student_id)}
                        >
                          {formatFullName(debtor.student_name) || debtor.student_name}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs leading-5 space-y-1">
                        <div>
                          <span className="text-muted-foreground mr-1">Ota:</span>
                          <span className="text-sm font-medium">
                            {formatPhone(debtor.father_phone)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-1">Ona:</span>
                          <span className="text-sm font-medium">
                            {formatPhone(debtor.mother_phone)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {debtor.group_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{debtor.contract_number}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {formatCurrency(debtor.debt_amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty
                    icon={<CheckCircle className="w-12 h-12 text-green-500" />}
                    title={t("noDebtors")}
                    description={t("allStudentsPaid")}
                  />
                )}
              </TableBody>
            </Table>

            {effectiveDebtorsData?.meta && effectiveDebtorsData.meta.total_pages > 1 && (
              <TablePagination
                currentPage={debtorsPage}
                totalPages={effectiveDebtorsData.meta.total_pages}
                totalItems={effectiveDebtorsData.meta.total}
                pageSize={debtorsPageSize}
                onPageChange={setDebtorsPage}
              />
            )}
          </Card>
        </motion.div>
      )}

      {/* TERMINATED TAB */}
      {activeTab === "terminated" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-56">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("year")}
                  </label>
                  <SearchableSelect
                    value={terminatedYear === "" ? "" : String(terminatedYear)}
                    onValueChange={(value) =>
                      setTerminatedYear(value ? Number(value) : "")
                    }
                    options={[
                      { value: "", label: t("allYears") || "All years" },
                      ...[
                        currentYear - 2,
                        currentYear - 1,
                        currentYear,
                        currentYear + 1,
                      ].map((y) => ({ value: String(y), label: String(y) })),
                    ]}
                    placeholder={t("allYears") || "All years"}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    className="w-full"
                    triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="w-full sm:w-[22rem] lg:w-[26rem]">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    {t("group")}
                  </label>
                  <SearchableSelect
                    value={terminatedGroupId ? String(terminatedGroupId) : ""}
                    onValueChange={(value) =>
                      setTerminatedGroupId(value ? Number(value) : null)
                    }
                    options={[
                      {
                        value: "",
                        label: groupsLoading ? t("loading") : t("allGroups"),
                      },
                      ...sortedGroupsList.map((group) => ({
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
                      })),
                    ]}
                    placeholder={t("allGroups")}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    className="w-full"
                    triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={groupsLoading}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTerminatedYear(currentYear);
                    setTerminatedGroupId(null);
                  }}
                >
                  {t("clearFilters")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleRegistrationExport}
                >
                  <Download className="w-4 h-4" />
                  {t("registrationReportExport")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title={t("terminatedCount")}
              value={
                terminatedSummaryLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  terminatedSummaryData?.data?.terminated_count ?? 0
                )
              }
              icon={<XCircle className="w-6 h-6" />}
            />
            <StatsCard
              title={t("totalExpected")}
              value={
                terminatedSummaryLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  formatCurrency(terminatedSummaryData?.data?.total_expected ?? 0)
                )
              }
              icon={<CreditCard className="w-6 h-6" />}
            />
            <StatsCard
              title={t("totalPaid")}
              value={
                terminatedSummaryLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  formatCurrency(terminatedSummaryData?.data?.total_paid ?? 0)
                )
              }
              icon={<CheckCircle className="w-6 h-6" />}
            />
            <StatsCard
              title={t("totalDebtAmount")}
              value={
                terminatedSummaryLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-base font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("calculating")}
                  </span>
                ) : (
                  formatCurrency(terminatedSummaryData?.data?.total_debt ?? 0)
                )
              }
              icon={<AlertTriangle className="w-6 h-6" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title={t("withDebtCount")}
              value={
                terminatedSummaryLoading ? "-" : (terminatedSummaryData?.data?.with_debt_count ?? 0)
              }
              icon={<AlertTriangle className="w-6 h-6" />}
            />
            <StatsCard
              title={t("noDebtCount")}
              value={
                terminatedSummaryLoading ? "-" : (terminatedSummaryData?.data?.no_debt_count ?? 0)
              }
              icon={<CheckCircle className="w-6 h-6" />}
            />
            <StatsCard
              title={t("avgDebtPerDebtor")}
              value={
                terminatedSummaryLoading ? "-" : formatCurrency(terminatedSummaryData?.data?.avg_debt_per_debtor ?? 0)
              }
              icon={<TrendingUp className="w-6 h-6" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("terminatedSummary")}</CardTitle>
            </CardHeader>
            <Table isLoading={terminatedSummaryLoading}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("group")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("terminatedCount")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("totalExpected")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("totalPaid")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("totalDebtAmount")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("withDebtCount")}</TableHead>
                  <TableHead className="text-right [&>div]:justify-end">{t("noDebtCount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminatedSummaryData?.data?.by_group?.length > 0 ? (
                  terminatedSummaryData.data.by_group.map((row: any) => (
                    <TableRow key={row.group_id}>
                      <TableCell className="font-medium">
                        <div>{row.group_name}</div>
                        {row.group_identifier && (
                          <div className="text-xs text-muted-foreground">{row.group_identifier}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.terminated_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total_expected)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total_paid)}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.total_debt > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                          {formatCurrency(row.total_debt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{row.with_debt_count}</TableCell>
                      <TableCell className="text-right">{row.no_debt_count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty
                    title={t("noData")}
                    description={t("noTerminatedContracts")?.replace("{{year}}", String(terminatedYear)) || ""}
                  />
                )}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      )}

      {activeTab === "payers" && <PayersReport />}
    </div>
  );
}
