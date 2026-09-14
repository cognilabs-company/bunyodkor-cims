/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  groupService,
  userService,
  studentService,
  yearLimitService,
} from "@/services/api.service";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Calendar,
  User,
  X,
  Loader2,
  UserCheck,
  FileText,
  CreditCard,
  TrendingUp,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguageStore } from "@/store/languageStore";
import { useAuthStore } from "@/store/authStore";
 
import type {
  GroupRead,
  StudentRead,
  ContractRead,
  GroupsStatisticsResponse,
  YearLimitUsage,
} from "@/types/api";
import { GroupDialog } from "./GroupDialog";
import { YearLimitDialog } from "@/pages/year-limits/YearLimitDialog";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { apiClient } from "@/lib/api-client";
import { downloadFile } from "@/lib/export-utils";
import { formatFullName, formatNameParts } from "@/lib/name-utils";
import { usePermissions } from "@/hooks/usePermissions";
import { yearLimitKeys } from "@/hooks/useYearLimit";

// Group card: name, identifier, coach and headcount. Schedule and capacity are
// not shown — enrolment is capped per birth year, and that figure lives on the
// year heading. Clicking the card opens the group's contracts; every other
// action sits behind the "⋮" menu next to the name.
function GroupCard({
  group,
  coachName,
  actions,
  onViewContracts,
  t,
}: {
  group: GroupRead;
  coachName: string;
  actions: ActionMenuItem[];
  onViewContracts: () => void;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full border-border/50 hover:border-border"
        onClick={onViewContracts}
      >
        <CardHeader className={group.description ? "pb-3" : undefined}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                  {group.name}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                  {group.identifier && (
                    <Badge variant="outline" className="text-xs">
                      {group.identifier}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{coachName}</span>
                  </div>
                  {/* Headcount beside the coach — capacity no longer governs
                      enrolment, so the number stands on its own. */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                    title={t("studentsShort")}
                  >
                    <UserCheck className="w-3 h-3" />
                    {group.active_students_count ?? 0} {t("studentsShort")}
                  </span>
                </div>
              </div>
            </div>
            {/* Level with the group name, top right. */}
            <ActionMenu
              items={actions}
              label={`${group.name} — ${t("actions")}`}
              className="-mr-1 -mt-1"
            />
          </div>
        </CardHeader>
        {group.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {group.description}
            </p>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

export default function Groups() {
  const { t } = useLanguageStore();
  const { isReadOnly, canWrite } = usePermissions();
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // null = the dialog creates a new group; a group = it edits that one.
  const [groupToEdit, setGroupToEdit] = useState<GroupRead | null>(null);
  // Limit editor opened from a birth-year heading. `limit` is set when the
  // year already has one (edit); otherwise only `birthYear` (create, locked).
  const [yearLimitDialog, setYearLimitDialog] = useState<{
    open: boolean;
    limit: YearLimitUsage | null;
    birthYear: number | null;
  }>({ open: false, limit: null, birthYear: null });
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedGroupForStudents, setSelectedGroupForStudents] =
    useState<GroupRead | null>(null);
  const [isContractsDialogOpen, setIsContractsDialogOpen] = useState(false);
  const [selectedGroupForContracts, setSelectedGroupForContracts] =
    useState<GroupRead | null>(null);
  const queryClient = useQueryClient();

  const debouncedSearch = useDebounce(search, 500);

  // Fetch groups organized by birth year
  const { data: groupedData, isLoading } = useQuery({
    queryKey: ["groups-grouped-by-year"],
    queryFn: () => groupService.getGroupsGroupedByYear(),
  });

  // Fetch group statistics
  const { data: groupsStats, isLoading: isLoadingGroupsStats } = useQuery({
    queryKey: ["groups-statistics"],
    queryFn: () => groupService.getGroupsStatistics(),
  });

  // Enrolment is capped per birth year, so each year heading carries its own
  // limit. One request covers every limited year; years missing from the map
  // simply have no limit.
  const { data: yearLimitsUsage } = useQuery({
    queryKey: yearLimitKeys.usage(),
    queryFn: () => yearLimitService.getYearLimitsUsage(),
  });

  const yearLimitByYear = React.useMemo(
    () =>
      new Map(
        (yearLimitsUsage?.data || []).map((usage) => [usage.birth_year, usage]),
      ),
    [yearLimitsUsage],
  );

  // Apply search filter to grouped data
  const getFilteredGroupedData = () => {
    if (!groupedData?.data) return [];

    // Birth years run oldest first: 2008, 2009, 2010, …
    const byYear = [...groupedData.data].sort(
      (a, b) => a.birth_year - b.birth_year,
    );

    if (!debouncedSearch) return byYear;

    return byYear
      .map((yearData) => ({
        ...yearData,
        groups: yearData.groups.filter((group) =>
          group.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
        ),
        total_groups: yearData.groups.filter((group) =>
          group.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
        ).length,
      }))
      .filter((yearData) => yearData.groups.length > 0);
  };

  const filteredGroupedData = getFilteredGroupedData();

  const { data: coachesData } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => userService.getCoaches(),
  });

  // Fetch students for selected group with fallback
  const { data: groupStudentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["group-students", selectedGroupForStudents?.id],
    queryFn: async () => {
      if (!selectedGroupForStudents) return [];

      console.log(
        "[DEBUG] Fetching group students for group:",
        selectedGroupForStudents,
      );

      // Try the primary endpoint first
      const response = await groupService.getGroupStudents(
        selectedGroupForStudents.id,
      );
      console.log("[DEBUG] Group students response:", response);
      console.log("[DEBUG] Group students data:", response.data);
      console.log("[DEBUG] Group students data length:", response.data?.length);

      // If primary endpoint returns empty or null, use fallback
      if (!response.data || response.data.length === 0) {
        console.log(
          "[DEBUG] Primary endpoint returned empty, trying fallback /students endpoint",
        );

        const fallbackResponse = await studentService.getStudents({
          group_id: selectedGroupForStudents.id,
          page: 1,
          page_size: 100,
        });

        console.log("[DEBUG] Fallback students response:", fallbackResponse);
        console.log("[DEBUG] Fallback students data:", fallbackResponse.data);

        if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
          console.log(
            "[DEBUG] Using fallback data with",
            fallbackResponse.data.length,
            "students",
          );
          return fallbackResponse.data;
        }
      }

      return response.data || [];
    },
    enabled: !!selectedGroupForStudents,
  });

  // Fetch contracts for selected group
  const { data: groupContractsData, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["group-contracts", selectedGroupForContracts?.id],
    queryFn: () =>
      groupService.getGroupContracts(selectedGroupForContracts!.id, {
        page: 1,
        page_size: 100,
      }),
    enabled: !!selectedGroupForContracts,
  });

  // Fetch students for contracts (to show student names)
  const { data: studentsForContracts } = useQuery({
    queryKey: ["students-for-contracts", selectedGroupForContracts?.id],
    queryFn: async () => {
      if (!selectedGroupForContracts) return { data: [], meta: {} };

      console.log(
        "[DEBUG] Fetching all students with pagination for group:",
        selectedGroupForContracts.id,
      );

      let allStudents: StudentRead[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await studentService.getStudents({
          group_id: selectedGroupForContracts.id,
          page: currentPage,
          page_size: 100,
        });

        if (response.data && response.data.length > 0) {
          allStudents = [...allStudents, ...response.data];
          currentPage++;

          if (response.data.length < 100) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log("[DEBUG] Total students fetched:", allStudents.length);
      return { data: allStudents };
    },
    enabled: !!selectedGroupForContracts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => groupService.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups-grouped-by-year"] });
      toast.success(t("groupDeletedSuccess"));
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = "Failed to delete group";

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }

      toast.error(errorMessage);
    },
  });

  const handleOpenDialog = () => {
    setGroupToEdit(null);
    setIsDialogOpen(true);
  };

  const handleViewContracts = (group: GroupRead) => {
    setSelectedGroupForContracts(group);
    setIsContractsDialogOpen(true);
  };

  const handleEditYearLimit = (
    birthYear: number,
    limit: YearLimitUsage | undefined,
  ) => {
    setYearLimitDialog({ open: true, limit: limit ?? null, birthYear });
  };

  const handleViewStudents = (group: GroupRead) => {
    setSelectedGroupForStudents(group);
    setIsStudentsDialogOpen(true);
  };

  // Every dialog sits at the same stacking level, so swap rather than nest.
  const handleEditGroup = (group: GroupRead | null) => {
    if (!group) return;
    setGroupToEdit(group);
    setIsContractsDialogOpen(false);
    setIsDialogOpen(true);
  };

  const handleDelete = (group: GroupRead) => {
    const message =
      t("confirmDeleteGroup") ||
      `Are you sure you want to delete group "${group.name}"?`;

    if (confirm(message.replace("{{name}}", group.name))) {
      setIsContractsDialogOpen(false);
      deleteMutation.mutate(group.id);
    }
  };

  // Everything that can be done to a group, in one place: the card's "⋮" menu.
  // Writes are gated on `groups:edit`; reads and the export stay open to anyone
  // who can see the page.
  const getGroupActions = (group: GroupRead): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        key: "contracts",
        label: t("viewContracts"),
        icon: FileText,
        onSelect: () => handleViewContracts(group),
      },
      {
        key: "students",
        label: t("viewStudents"),
        icon: Users,
        onSelect: () => handleViewStudents(group),
      },
      {
        key: "export",
        label: t("exportStudents"),
        icon: Download,
        onSelect: () => handleExportGroupStudents(group),
      },
    ];

    if (canWrite("groups:edit")) {
      items.push({
        key: "edit",
        label: t("editGroup"),
        icon: Pencil,
        onSelect: () => handleEditGroup(group),
      });
      items.push({
        key: "delete",
        label: t("deleteGroup"),
        icon: Trash2,
        destructive: true,
        onSelect: () => handleDelete(group),
      });
    }

    return items;
  };

  const getCoachName = (coachId: number) => {
    const coach = coachesData?.data?.find((c) => c.id === coachId);
    return coach ? formatFullName(coach.full_name) : `ID: ${coachId}`;
  };

  const getStudentName = (studentId: number | null | undefined) => {
    if (!studentId) return t("noStudentName");
    const student = studentsForContracts?.data?.find(
      (s: StudentRead) => s.id === studentId,
    );
    return student
      ? formatNameParts(student.last_name, student.first_name)
      : t("noStudentName");
  };

  // --- Handlers for Search ---
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleClearSearch = () => {
    setSearch("");
  };

  const handleExportGroupStudents = async (group: GroupRead | null) => {
    if (!group) return;

    const toastId = toast.loading(t("exportingData") || "Exporting data...");
    try {
      const response = await apiClient.get(`/groups/${group.id}/export-students`, {
        responseType: "blob",
      });

      const contentDisposition = response.headers["content-disposition"];
      let filename = `group_${group.name}_students.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2)
          filename = filenameMatch[1];
      }

      downloadFile(response.data, filename);

      toast.success(t("exportedSuccessfully") || "Exported successfully", {
        id: toastId,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || t("errorExportingData") || "Export failed", {
        id: toastId,
      });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("groups")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("manageGroups")}</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("newGroup")}
          </Button>
        )}
      </motion.div>

      {/* Group Statistics Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {/* Total Groups Card */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalGroups") || "Jami Guruhlar"}
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {isLoadingGroupsStats ? (
                <Loader2 className="animate-spin w-8 h-8" />
              ) : (
                (groupsStats?.data?.total_groups ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Capacity Card */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalCapacity") || "Umumiy Sig'im"}
              </CardTitle>
              <Calendar className="h-5 w-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {isLoadingGroupsStats ? (
                <Loader2 className="animate-spin w-8 h-8" />
              ) : (
                (groupsStats?.data?.total_capacity ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Used Spots Card */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("usedSpots") || "Band Qilingan O'rinlar"}
              </CardTitle>
              <UserCheck className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {isLoadingGroupsStats ? (
                <Loader2 className="animate-spin w-8 h-8" />
              ) : (
                (groupsStats?.data?.total_used ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Available Spots Card */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("availableSpots") || "Bo'sh O'rinlar"}
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {isLoadingGroupsStats ? (
                <Loader2 className="animate-spin w-8 h-8" />
              ) : (
                (groupsStats?.data?.total_available ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filled Groups Count Card */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("filledGroups") || "To'liq Guruhlar"}
              </CardTitle>
              <Users className="h-5 w-5 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {isLoadingGroupsStats ? (
                <Loader2 className="animate-spin w-8 h-8" />
              ) : (
                (groupsStats?.data?.filled_groups_count ?? 0)
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchByGroupName")}
                value={search}
                onChange={handleSearchChange}
                className="pl-10 pr-10 border-border/50"
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
          </CardContent>
        </Card>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredGroupedData && filteredGroupedData.length > 0 ? (
        <div className="space-y-8">
          {filteredGroupedData.map((yearData) => {
            const yearLimit = yearLimitByYear.get(yearData.birth_year);
            const yearRemaining = Math.max(yearLimit?.remaining ?? 0, 0);

            return (
            <motion.div
              key={yearData.birth_year}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-foreground flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Calendar className="w-6 h-6 shrink-0" />
                    <span>
                      {yearData.birth_year} {t("birthYear") || "yil tug'ilganlar"}
                    </span>

                    {/* The year's enrolment limit follows the year it belongs
                        to, set off by a divider. The pencil opens the limit
                        editor for this year. */}
                    <span
                      aria-hidden="true"
                      className="hidden sm:block h-5 w-px bg-border"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canWrite("groups:edit") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleEditYearLimit(yearData.birth_year, yearLimit)
                          }
                          aria-label={t("editYearLimit")}
                          title={t("editYearLimit")}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {yearLimit ? (
                        <>
                          {/* Places left — the figure that matters, in colour. */}
                          {yearLimit.is_full ? (
                            <Badge variant="destructive">
                              {t("yearLimitFullShort")}
                            </Badge>
                          ) : (
                            <Badge variant="default" className="tabular-nums">
                              {t("yearLimitSlotsShort").replace(
                                "{{count}}",
                                String(yearRemaining),
                              )}
                            </Badge>
                          )}
                          {/* Enrolled / limit — context, kept quiet. */}
                          <Badge
                            variant="outline"
                            className="font-medium text-muted-foreground tabular-nums"
                            title={`${t("currentlyEnrolled")} / ${t("maxStudents")}`}
                          >
                            {yearLimit.current_count}/{yearLimit.max_students}
                          </Badge>
                        </>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground font-medium"
                        >
                          {t("yearLimitUnlimited")}
                        </Badge>
                      )}
                    </div>

                    <Badge variant="secondary" className="ml-auto">
                      {yearData.total_groups} {t("group")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {yearData.groups.map((group: GroupRead) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        coachName={getCoachName(group.coach_id)}
                        actions={getGroupActions(group)}
                        onViewContracts={() => handleViewContracts(group)}
                        t={t}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t("noGroupsFound")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("getStartedGroup")}
            </p>
            {!isReadOnly && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                {t("createGroup")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <GroupDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        group={groupToEdit}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["groups-grouped-by-year"],
          });
        }}
      />

      <YearLimitDialog
        open={yearLimitDialog.open}
        onOpenChange={(open) =>
          setYearLimitDialog((current) => ({ ...current, open }))
        }
        limit={yearLimitDialog.limit}
        birthYear={yearLimitDialog.birthYear}
      />

      {/* Students Dialog */}
      <Dialog
        open={isStudentsDialogOpen}
        onOpenChange={setIsStudentsDialogOpen}
      >
        <DialogContent
          className="max-w-5xl max-h-[80vh] overflow-y-auto"
          onClose={() => setIsStudentsDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedGroupForStudents?.name} - {t("groupStudents")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isLoadingStudents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("student") || "Talaba"}</TableHead>
                      <TableHead>{t("phone") || "Telefon"}</TableHead>
                      <TableHead>{t("birthYear")}</TableHead>
                      <TableHead>{t("address")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupStudentsData && groupStudentsData.length > 0 ? (
                      groupStudentsData.map((student: StudentRead) => (
                        <TableRow
                          key={student.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            navigate(`/students/${student.id}`);
                            setIsStudentsDialogOpen(false);
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                {student.first_name?.[0]}
                                {student.last_name?.[0]}
                              </div>
                              <div>
                                {formatNameParts(
                                  student.last_name,
                                  student.first_name,
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{student.phone}</TableCell>
                          <TableCell>
                            {student.date_of_birth
                              ? new Date(student.date_of_birth).getFullYear()
                              : "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {student.address || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                student.status === "active"
                                  ? "default"
                                  : student.status === "inactive"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {student.status === "active"
                                ? t("active")
                                : student.status === "inactive"
                                  ? t("inactive")
                                  : t("archived")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>
                            {t("noStudentsInGroup") || "Guruhda talabalar yo'q"}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contracts Dialog */}
      <Dialog
        open={isContractsDialogOpen}
        onOpenChange={setIsContractsDialogOpen}
      >
        <DialogContent
          className="max-w-5xl max-h-[80vh] overflow-y-auto"
          onClose={() => setIsContractsDialogOpen(false)}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {selectedGroupForContracts?.name} - {t("contracts")}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* The card itself carries no controls any more, so this is the
                  way into editing a group. */}
              {canWrite("groups:edit") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditGroup(selectedGroupForContracts)}
                  className="gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  {t("edit")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportGroupStudents(selectedGroupForContracts)}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {t("export") || "Export"}
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4">
            {isLoadingContracts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : groupContractsData?.data &&
              groupContractsData.data.length > 0 ? (
              // O'ZGARISH 1: Containerga padding (p-4) va gap berildi
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {groupContractsData.data.map((contract: ContractRead) => (
                  <Card
                    key={contract.id}
                    // O'ZGARISH 2: Card dizayni zamonaviylashtirildi
                    className="
  group relative overflow-hidden
  bg-white/80 dark:bg-slate-800/80
  backdrop-blur-xl
  border border-slate-200 dark:border-slate-700
  rounded-xl
  shadow-lg
  transition-all duration-300
  hover:-translate-y-1 hover:shadow-xl
  hover:border-blue-500/40
  hover:bg-blue-50/50 dark:hover:bg-blue-900/20
  cursor-pointer
"
                    onClick={() => {
                      if (contract.student_id) {
                        navigate(`/students/${contract.student_id}`);
                        setIsContractsDialogOpen(false);
                      }
                    }}
                  >
                    <CardHeader className="pb-3 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {/* Icon qismi */}
                          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold tracking-tight text-foreground/90">
                              {contract.contract_number}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">
                              {getStudentName(contract.student_id)}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge
                          className="px-2.5 py-0.5 text-xs font-semibold shadow-sm"
                          variant={
                            contract.status === "active"
                              ? "default"
                              : contract.status === "expired"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {contract.status === "active"
                            ? t("active")
                            : contract.status === "expired"
                              ? t("expired")
                              : t("cancelled")}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 p-5 pt-0">
                      {/* Ajratuvchi chiziq */}
                      <div className="h-px w-full bg-border/50 my-2" />

                      <div className="flex items-center gap-3 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <Calendar className="w-4 h-4 text-muted-foreground/70" />
                        <span className="text-foreground/80 font-medium">
                          {contract.start_date && contract.end_date
                            ? `${new Date(
                                contract.start_date,
                              ).toLocaleDateString()} - ${new Date(
                                contract.end_date,
                              ).toLocaleDateString()}`
                            : t("noDates")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <CreditCard className="w-4 h-4 text-muted-foreground/70" />
                        <span className="font-bold text-foreground text-base">
                          {contract.monthly_fee
                            ? `${Number(
                                contract.monthly_fee,
                              ).toLocaleString()} UZS`
                            : t("noFee")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>{t("noContractsInGroup") || "Guruhda shartnomalar yo'q"}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
