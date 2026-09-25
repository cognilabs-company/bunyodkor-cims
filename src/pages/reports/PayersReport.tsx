/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FC } from "react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { reportService, groupService, studentService } from "@/services/api.service";
import { useLanguageStore } from "@/store/languageStore";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { exportReport, downloadFile } from "@/lib/export-utils";
import { formatFullName, formatGroupSelectLabel } from "@/lib/name-utils";
import toast from "react-hot-toast";
import { formatCurrency as formatCurrencyUtil } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { GroupRead } from "@/types/api";

const PayersReport: FC = () => {
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [paymentYear, setPaymentYear] = useState<number | "">(currentYear);
  const [paymentMonth, setPaymentMonth] = useState<number | "">(currentMonth);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [minPaidAmount, setMinPaidAmount] = useState<number | "">("");
  const [fromDate, setFromDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd"),
  );

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-list-all"],
    queryFn: async () => {
      const allGroups: any[] = [];
      let currentPage = 1;
      let hasMore = true;
      while (hasMore) {
        const response = await groupService.getGroups({ page: currentPage, page_size: 100 });
        if (response.data && response.data.length > 0) {
          allGroups.push(...response.data);
          if (response.meta && currentPage < response.meta.total_pages) {
            currentPage++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
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
  });

  // Normalize groups response in case API is double-wrapped: { data: { data: [...] } }
  const groupsList: any[] = useMemo(() => {
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
  const payerGroupOptions = useMemo(
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

  const { data: payersData, isLoading } = useQuery({
    queryKey: [
      "payers-report",
      page,
      pageSize,
      paymentYear,
      paymentMonth,
      groupId,
      minPaidAmount,
      fromDate,
      toDate,
    ],
    queryFn: () => {
      const params: any = { page, page_size: pageSize };
      if (paymentYear !== "") params.payment_year = paymentYear;
      if (paymentMonth !== "") params.payment_month = paymentMonth;
      if (groupId) params.group_id = groupId;
      if (minPaidAmount !== "") params.min_paid_amount = minPaidAmount;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      return reportService.getPayers(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const formatCurrency = (amount: number) =>
    formatCurrencyUtil(amount, "UZS", "uz-UZ", false);

  const handleOpenStudentDetail = (studentId?: number) => {
    if (!studentId) return;

    void queryClient.prefetchQuery({
      queryKey: ["student-full-info", studentId],
      queryFn: () => studentService.getStudentFullInfo(studentId),
    });

    navigate(`/students/${studentId}`);
  };

  const handleExport = async () => {
    const promise = (async () => {
      const params: any = {};
      if (paymentYear !== "") params.payment_year = paymentYear;
      if (paymentMonth !== "") params.payment_month = paymentMonth;
      if (groupId) params.group_id = groupId;
      if (minPaidAmount !== "") params.min_paid_amount = minPaidAmount;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const blob = await reportService.exportPayersReport(params);

      if (!blob || blob.size === 0) {
        throw new Error("NO_DATA");
      }

      const date = format(new Date(), "yyyy-MM-dd");
      downloadFile(blob, `payers-report-${date}.xlsx`);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("payersReport")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {t("paymentYear")}
              </label>
              <Select
                value={paymentYear}
                onChange={(e) => {
                  setPaymentYear(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                }}
                className="h-10 w-40"
              >
                {[
                  currentYear - 2,
                  currentYear - 1,
                  currentYear,
                  currentYear + 1,
                ].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value="">{t("allYears")}</option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {t("month") || "Month"}
              </label>
              <Select
                value={paymentMonth}
                onChange={(e) => {
                  setPaymentMonth(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                }}
                className="h-10 w-40"
              >
                <option value="">{t("allMonths") || "All months"}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-[22rem] lg:w-[26rem]">
              <label className="text-sm font-medium text-foreground mb-1 block">
                {t("group")}
              </label>
              <SearchableSelect
                value={groupId ? String(groupId) : ""}
                onValueChange={(value) => {
                  setGroupId(value ? Number(value) : null);
                  setPage(1);
                }}
                options={payerGroupOptions}
                placeholder={t("allGroups")}
                searchPlaceholder={`${t("search")}...`}
                emptyText={t("noDataFound")}
                className="w-full"
                triggerClassName="h-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={groupsLoading}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {t("fromDate")}
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-40"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {t("toDate")}
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-40"
              />
            </div>

            <div className="ml-auto flex gap-2">
              <Button onClick={handleExport}>{t("exportReport")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table isLoading={isLoading}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("student")}</TableHead>
              <TableHead>{t("group")}</TableHead>
              <TableHead>{t("contractNumber")}</TableHead>
              <TableHead>{t("paymentYear")}</TableHead>
              <TableHead>{t("paymentMonths")}</TableHead>
              <TableHead className="text-right [&>div]:justify-end">
                {t("totalPaid")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payersData?.data && payersData.data.length > 0 ? (
              payersData.data.map((p: any) => (
                <TableRow key={`${p.student_id}-${p.contract_number}`}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-medium text-left hover:underline hover:text-primary transition-colors"
                      onClick={() => handleOpenStudentDetail(p.student_id)}
                    >
                      {formatFullName(p.student_name) || p.student_name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {p.group_name ||
                        (groupsList.find((g: any) => g.id === p.group_id)
                          ?.name ??
                          "N/A")}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.contract_number}</TableCell>
                  <TableCell>{p.payment_year}</TableCell>
                  <TableCell>{(p.payment_months || []).join(", ")}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.total_paid)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty
                title={t("noData")}
                description={t("noPayersFound")}
              />
            )}
          </TableBody>
        </Table>

        {payersData?.meta && payersData.meta.total_pages > 1 && (
          <TablePagination
            currentPage={page}
            totalPages={payersData.meta.total_pages}
            totalItems={payersData.meta.total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
};

export default PayersReport;
