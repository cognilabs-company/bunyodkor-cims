/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Archive as ArchiveIcon,
  RotateCcw,
  FileX,
  AlertTriangle,
  Loader2,
  Calendar,
  Search,
  Database,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

import { archiveService, contractService } from "@/services/api.service";
import type { TerminatedStudentItem } from "@/types/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableEmpty,
} from "@/components/ui/table";
import { useLanguageStore } from "@/store/languageStore";
import { formatFullName } from "@/lib/name-utils";
import { formatTerminationReason } from "@/lib/termination";
import { BackupSection } from "@/pages/settings/Backup";
import { usePermissions } from "@/hooks/usePermissions";

export default function Archive() {
  const { t } = useLanguageStore();
  const { isReadOnly } = usePermissions();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canReactivate = !!user?.is_super_admin;
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [activeTab, setActiveTab] = useState("stats");
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);

  // Arxiv statistikasi
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["archive-stats", selectedYear],
    queryFn: () => archiveService.getArchiveStats(selectedYear),
  });

  // Bekor qilingan shartnomalar — terminated_at sanasi bo'yicha (yil filtri bilan)
  // Eski /archive/terminated-contracts/{year} endpoint'i archive_year bo'yicha filtrlardi,
  // bu esa terminated_at maydoni bilan mos kelmasdi. Shu sababli /contracts/terminated-students
  // ishlatamiz va terminated_from / terminated_to bilan tanlangan yilga cheklaymiz.
  const { data: terminatedData, isLoading: isTerminatedLoading } = useQuery({
    queryKey: ["terminated-contracts", selectedYear],
    queryFn: () =>
      contractService.getTerminatedStudents({
        terminated_from: `${selectedYear}-01-01`,
        terminated_to: `${selectedYear}-12-31`,
        page: 1,
        page_size: 1000,
      }),
    enabled: activeTab === "terminated",
  });

  // Arxivlash mutatsiyasi
  const archiveMutation = useMutation({
    mutationFn: (year: number) => archiveService.archiveYear(year),
    onSuccess: () => {
      toast.success(
        (t("yearArchivedSuccess" as any) || "{{year}} year data successfully archived").replace("{{year}}", selectedYear.toString())
      );
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
    },
    onError: () => toast.error(t("errorArchiving" as any) || "Error archiving data"),
  });

  // Arxivdan chiqarish mutatsiyasi
  const unarchiveMutation = useMutation({
    mutationFn: (year: number) => archiveService.unarchiveYear(year),
    onSuccess: () => {
      toast.success((t("yearUnarchivedSuccess" as any) || "{{year}} year data unarchived").replace("{{year}}", selectedYear.toString()));
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
    },
    onError: () => toast.error(t("errorUnarchiving" as any) || "Error unarchiving data"),
  });

  // Terminated shartnomani qayta aktivlashtirish (faqat super_admin)
  const reactivateMutation = useMutation({
    mutationFn: (contractId: number) =>
      contractService.updateContract(contractId, { status: "active" }),
    onMutate: (contractId: number) => {
      setReactivatingId(contractId);
    },
    onSettled: () => setReactivatingId(null),
    onError: () =>
      toast.error(
        t("errorReactivatingContract" as any) || "Error reactivating contract"
      ),
  });

  const handleReactivate = (contract: TerminatedStudentItem) => {
    if (!canReactivate) return;
    const num = contract.contract_number || String(contract.contract_id);
    const msg = (
      t("confirmReactivateContract" as any) ||
      "Reactivate contract {{contractNumber}}? The status will change from terminated to active."
    ).replace("{{contractNumber}}", num);
    if (!confirm(msg)) return;
    reactivateMutation.mutate(contract.contract_id, {
      onSuccess: () => {
        toast.success(
          (t("contractReactivatedSuccess" as any) ||
            "Contract {{contractNumber}} reactivated successfully").replace(
            "{{contractNumber}}",
            num
          )
        );
        queryClient.invalidateQueries({ queryKey: ["terminated-contracts"] });
        queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
        queryClient.invalidateQueries({ queryKey: ["contracts"] });
      },
    });
  };

  const handleArchive = () => {
    if (
      confirm(
        (t("confirmArchiveYear" as any) || "WARNING! All data for {{year}} will be archived. Continue?").replace("{{year}}", selectedYear.toString())
      )
    ) {
      archiveMutation.mutate(selectedYear);
    }
  };

  const handleUnarchive = () => {
    if (
      confirm(
        (t("confirmUnarchiveYear" as any) || "Do you want to restore {{year}} year data from archive?").replace("{{year}}", selectedYear.toString())
      )
    ) {
      unarchiveMutation.mutate(selectedYear);
    }
  };

  // Safe access to stats data with default values
  // Handle both possible API response structures: { data: {...} } or direct {...}
   
  const stats: any = statsData?.data?.data || statsData?.data || {
    active_count: 0,
    archived_count: 0,
    total: 0,
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
            {t("archive" as any) || "Archive"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("archiveManagement" as any) || "Archive and manage annual data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <Input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-32"
            min={2000}
            max={2100}
          />
        </div>
      </motion.div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="flex flex-col sm:flex-row h-auto sm:h-10 w-full sm:w-auto gap-2 sm:gap-0 bg-transparent sm:bg-muted p-0 sm:p-1">
          <TabsTrigger
            value="stats"
            className="gap-2 w-full sm:w-auto justify-start sm:justify-center px-4 py-3 sm:py-2 border-2 sm:border-0 border-border data-[state=active]:border-primary sm:data-[state=active]:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg sm:rounded-md shadow-sm sm:shadow-none"
          >
            <ArchiveIcon className="w-4 h-4" />
            {t("statisticsAndManagement" as any) || "Statistics and Management"}
          </TabsTrigger>
          <TabsTrigger
            value="terminated"
            className="gap-2 w-full sm:w-auto justify-start sm:justify-center px-4 py-3 sm:py-2 border-2 sm:border-0 border-border data-[state=active]:border-primary sm:data-[state=active]:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg sm:rounded-md shadow-sm sm:shadow-none"
          >
            <FileX className="w-4 h-4" />
            {t("terminatedContracts" as any) || "Terminated Contracts"}
          </TabsTrigger>
          {!isReadOnly && (
            <TabsTrigger
              value="backup"
              className="gap-2 w-full sm:w-auto justify-start sm:justify-center px-4 py-3 sm:py-2 border-2 sm:border-0 border-border data-[state=active]:border-primary sm:data-[state=active]:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg sm:rounded-md shadow-sm sm:shadow-none"
            >
              <Database className="w-4 h-4" />
              {t("backup" as any) || "Backup"}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {/* Statistika Kartalari */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("totalData" as any) || "Total Data"}</CardTitle>
                <CardDescription>{(t("forYear" as any) || "For {{year}}").replace("{{year}}", selectedYear.toString())}</CardDescription>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <div className="text-3xl font-bold">{stats.total || 0}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-600">
                  {t("activeNotArchived" as any) || "Active (Not Archived)"}
                </CardTitle>
                <CardDescription>{t("currentActiveData" as any) || "Current active data"}</CardDescription>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <div className="text-3xl font-bold text-green-600">
                    {stats.active_count || 0}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-orange-600">
                  {t("archived" as any) || "Archived"}
                </CardTitle>
                <CardDescription>{t("archivedData" as any) || "Archived data"}</CardDescription>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <div className="text-3xl font-bold text-orange-600">
                    {stats.archived_count || 0}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Boshqaruv Paneli */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle>{t("archivingOperations" as any) || "Archiving Operations"}</CardTitle>
              <CardDescription>
                {(t("archivingOperationsDescription" as any) || "These operations affect all groups, students and contracts for {{year}}.").replace("{{year}}", selectedYear.toString())}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              {!isReadOnly && (
                <Button
                  onClick={handleArchive}
                  disabled={archiveMutation.isPending || stats.active_count === 0}
                  className="gap-2 bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                >
                  {archiveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArchiveIcon className="w-4 h-4" />
                  )}
                  {t("archiveYearButton" as any) || "Archive Year"}
                </Button>
              )}

              {!isReadOnly && (
                <Button
                  onClick={handleUnarchive}
                  variant="outline"
                  disabled={
                    unarchiveMutation.isPending || stats.archived_count === 0
                  }
                  className="gap-2 border-orange-600 text-orange-600 hover:bg-orange-50 w-full sm:w-auto"
                >
                  {unarchiveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  {t("unarchiveButton" as any) || "Unarchive"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminated">
          <Card>
            <CardHeader>
              <CardTitle>
                {(t("terminatedContractsYear" as any) || "Terminated Contracts ({{year}})").replace("{{year}}", selectedYear.toString())}
              </CardTitle>
              <div className="relative max-w-sm mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("search" as any) || "Search..."} className="pl-8" />
              </div>
            </CardHeader>
            <CardContent>
              <Table isLoading={isTerminatedLoading}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("contractNumber" as any) || "Contract №"}</TableHead>
                    <TableHead>{t("student" as any) || "Student"}</TableHead>
                    <TableHead>{t("group" as any) || "Group"}</TableHead>
                    <TableHead>{t("terminatedDate" as any) || "Terminated Date"}</TableHead>
                    <TableHead>{t("reason" as any) || "Reason"}</TableHead>
                    <TableHead>{t("byWhom" as any) || "By Whom"}</TableHead>
                    {canReactivate && (
                      <TableHead className="text-right">
                        {t("actions" as any) || "Actions"}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminatedData?.data && terminatedData.data.length > 0 ? (
                    terminatedData.data.map((contract: TerminatedStudentItem) => {
                      const studentName = [
                        contract.student_first_name,
                        contract.student_last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      return (
                        <TableRow key={contract.contract_id}>
                          <TableCell className="font-medium">
                            {contract.contract_number}
                          </TableCell>
                          <TableCell>
                            {formatFullName(studentName) ||
                              `ID: ${contract.student_id}`}
                          </TableCell>
                          <TableCell>
                            {contract.student_group_name ||
                              contract.student_group_identifier ||
                              (contract.student_group_id
                                ? `ID: ${contract.student_group_id}`
                                : "-")}
                          </TableCell>
                          <TableCell>
                            {contract.terminated_at
                              ? format(
                                  new Date(contract.terminated_at),
                                  "dd.MM.yyyy HH:mm"
                                )
                              : "-"}
                          </TableCell>
                          <TableCell
                            className="max-w-[200px] truncate"
                            title={formatTerminationReason(contract.termination_reason, t)}
                          >
                            {formatTerminationReason(contract.termination_reason, t) ||
                              (t("reasonNotProvided" as any) ||
                                "Reason not provided")}
                          </TableCell>
                          <TableCell>
                            {formatFullName(contract.terminated_by_full_name) ||
                              (contract.terminated_by_user_id
                                ? `ID: ${contract.terminated_by_user_id}`
                                : "-")}
                          </TableCell>
                          {canReactivate && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                onClick={() => handleReactivate(contract)}
                                disabled={
                                  reactivatingId === contract.contract_id
                                }
                              >
                                {reactivatingId === contract.contract_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                                {t("reactivateContract" as any) || "Reactivate"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableEmpty
                      icon={
                        <AlertTriangle className="w-12 h-12 text-yellow-500" />
                      }
                      title={t("noDataFound" as any) || "No data found"}
                      description={(t("noTerminatedContracts" as any) || "No terminated contracts in {{year}}.").replace("{{year}}", selectedYear.toString())}
                    />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {!isReadOnly && (
          <TabsContent value="backup">
            <BackupSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
