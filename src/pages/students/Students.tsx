import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
// } from "@/components/ui/dialog";
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
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Edit,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Trash2,
  Users as UsersIcon,
  Calendar,
  Filter,
  Download,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Upload,
  X,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  studentService,
  contractService,
  fetchAllPages,
} from "@/services/api.service";
import type { ContractRead, StudentRead } from "@/types/api";
import { StudentDialog } from "./StudentDialog";
import { StudentWithContractDialog } from "./StudentWithContractDialog";
import { exportStudents } from "@/lib/export-utils";
import { formatGroupSelectLabel, formatNameParts } from "@/lib/name-utils";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguageStore } from "@/store/languageStore";
import { useGroupsStore } from "@/store/groupsStore";
import { usePermissions } from "@/hooks/usePermissions";

type GroupOption = {
  id: number;
  name: string;
};

export default function Students() {
  const { t } = useLanguageStore();
  const { isReadOnly } = usePermissions();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [archiveYearFilter, setArchiveYearFilter] = useState<string>("");
  const currentYear = new Date().getFullYear();
  const [exportFromDate, setExportFromDate] = useState<string>(
    `${currentYear}-01-01`,
  );
  const [exportToDate, setExportToDate] = useState<string>(
    `${currentYear}-12-31`,
  );
  const [exportGroupId, setExportGroupId] = useState<string>("");
  const [exportStatus, setExportStatus] = useState<string>("");
  const [isComprehensiveExporting, setIsComprehensiveExporting] =
    useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRead | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCombinedDialogOpen, setIsCombinedDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [studentToDelete, setStudentToDelete] = useState<StudentRead | null>(
    null,
  );
  const queryClient = useQueryClient();

  const debouncedSearch = useDebounce(search, 500);

  // Use global groups store
  const {
    groupsData,
    isLoading: isLoadingGroups,
    fetchGroups,
  } = useGroupsStore();

  // Flatten grouped data into single array
  const allGroups: GroupOption[] =
    groupsData?.flatMap((yearGroup) => yearGroup.groups as GroupOption[]) || [];
  const exportGroupOptions = [
    {
      value: "",
      label: isLoadingGroups ? t("loading") : t("allGroups"),
    },
    ...(!isLoadingGroups && allGroups.length > 0
      ? allGroups.map((group) => ({
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
        }))
      : []),
  ];
  const studentGroupFilterOptions = [
    {
      value: "",
      label: isLoadingGroups ? t("loading") : t("allGroups"),
    },
    ...(!isLoadingGroups && allGroups.length > 0
      ? allGroups.map((group) => ({
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
        }))
      : []),
  ];
  const exportStatusOptions = [
    { value: "", label: t("allStatuses") },
    { value: "active", label: t("active") },
    { value: "archived", label: t("archived") },
    { value: "deleted", label: t("deleted") },
  ];

  // Fetch groups on component mount if not already loaded
  useEffect(() => {
    if (!groupsData && !isLoadingGroups) {
      console.log("[STUDENTS] No groups data, fetching from store...");
      fetchGroups();
    } else if (groupsData) {
      console.log("[STUDENTS] Groups already loaded:", groupsData);
      console.log("[STUDENTS] Flattened groups:", allGroups);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsData, isLoadingGroups, fetchGroups]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "students",
      page,
      pageSize,
      debouncedSearch,
      statusFilter,
      groupFilter,
      archiveYearFilter,
    ],
    queryFn: () =>
      studentService.getStudents({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        group_id: groupFilter ? parseInt(groupFilter, 10) : undefined,
        archive_year: archiveYearFilter
          ? parseInt(archiveYearFilter, 10)
          : undefined,
      }),
  });

  const { data: allContracts } = useQuery({
    queryKey: ["contracts", "numbers-by-student"],
    queryFn: () =>
      fetchAllPages<ContractRead>((page, page_size) =>
        contractService.getContracts({ page, page_size }),
      ),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const contractNumberByStudent = useMemo(() => {
    const byStudent = new Map<number, ContractRead>();

    for (const contract of allContracts || []) {
      if (!contract.student_id) continue;

      const current = byStudent.get(contract.student_id);
      if (!current) {
        byStudent.set(contract.student_id, contract);
        continue;
      }

      const beatsOnStatus =
        contract.status === "active" && current.status !== "active";
      const sameStatus = (contract.status === "active") === (current.status === "active");
      if (beatsOnStatus || (sameStatus && contract.id > current.id)) {
        byStudent.set(contract.student_id, contract);
      }
    }

    return new Map(
      [...byStudent].map(([studentId, contract]) => [
        studentId,
        contract.contract_number,
      ]),
    );
  }, [allContracts]);

  // Get total count for each status (independent of pagination)
  const { data: activeCountData } = useQuery({
    queryKey: ["students-count", "active"],
    queryFn: () =>
      studentService.getStudents({ status: "active", page: 1, page_size: 1 }),
  });

  const { data: archivedCountData } = useQuery({
    queryKey: ["students-count", "archived"],
    queryFn: () =>
      studentService.getStudents({
        status: "archived",
        page: 1,
        page_size: 1,
      }),
  });

  const { data: deletedCountData } = useQuery({
    queryKey: ["students-count", "deleted"],
    queryFn: () =>
      studentService.getStudents({ status: "deleted", page: 1, page_size: 1 }),
  });

  // Use DELETE /students/{student_id} for soft delete
  // const deleteMutation = useMutation({
  //   mutationFn: (id: number) => studentService.deleteStudent(id),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["students"] });
  //     queryClient.invalidateQueries({ queryKey: ["students-count"] });
  //     queryClient.invalidateQueries({ queryKey: ["contracts"] });
  //     queryClient.invalidateQueries({ queryKey: ["transactions"] });
  //     queryClient.invalidateQueries({ queryKey: ["finance"] });
  //     queryClient.invalidateQueries({ queryKey: ["attendances"] });
  //     queryClient.invalidateQueries({ queryKey: ["groups"] });
  //     toast.success(t("studentDeleted") || "Talaba o'chirildi");
  //   },
  //   onError: (error: any) => {
  //     const detail = error?.response?.data?.detail;
  //     let errorMessage =
  //       t("failedToDeleteStudent") || "Talabani o'chirishda xato";
  //     if (Array.isArray(detail) && detail.length > 0) {
  //       errorMessage = detail[0].msg || detail[0].message || errorMessage;
  //     } else if (typeof detail === "string") {
  //       errorMessage = detail;
  //     }
  //     toast.error(errorMessage);
  //   },
  // });

  // // Professional UI: open dialog, confirm, then delete
  // const handleDelete = (student: StudentRead) => {
  //   setStudentToDelete(student);
  //   setIsDeleteDialogOpen(true);
  // };

  // const confirmDelete = () => {
  //   if (studentToDelete) {
  //     deleteMutation.mutate(studentToDelete.id);
  //     setIsDeleteDialogOpen(false);
  //     setStudentToDelete(null);
  //   }
  // };

  const handleEdit = (student: StudentRead) => {
    setSelectedStudent(student);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedStudent(null);
    setIsCombinedDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setGroupFilter("");
    setArchiveYearFilter("");
  };

  const hasActiveFilters =
    search || statusFilter || groupFilter || archiveYearFilter;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExport = () => {
    try {
      if (!data?.data || data.data.length === 0) {
        toast.error(t("noStudentsToExport"));
        return;
      }
      exportStudents(data.data);
      toast.success(t("studentsExported"));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error(t("failedToExportStudents"));
    }
  };

  const handleExportComprehensiveData = async () => {
    if (exportFromDate && exportToDate && exportFromDate > exportToDate) {
      toast.error(t("dateRangeInvalid"));
      return;
    }

    const toastId = toast.loading(t("exportingData"));
    try {
      setIsComprehensiveExporting(true);

      const blob = await studentService.exportComprehensiveStudentData({
        from_date: exportFromDate || undefined,
        to_date: exportToDate || undefined,
        group_id: exportGroupId ? parseInt(exportGroupId, 10) : undefined,
        status: exportStatus || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `students_comprehensive_${exportFromDate || "from"}_${exportToDate || "to"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(t("exportedSuccessfully"));
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error(t("errorExportingData"));
    } finally {
      setIsComprehensiveExporting(false);
    }
  };

  const getStatusBadge = (status: StudentRead["status"]) => {
    const variants: Record<string, { bg: string; text: string }> = {
      active: {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-400",
      },
      archived: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
      },
      deleted: {
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-400",
      },
      graduated: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
      },
      dropped: {
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-400",
      },
      suspended: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
      },
    };
    const variant = variants[status!] || variants.active;
    return (
      <Badge className={`${variant.bg} ${variant.text} border-0 font-medium`}>
        {t(status!)}
      </Badge>
    );
  };

  const stats = {
    total: data?.meta?.total || 0,
    active: activeCountData?.meta?.total || 0,
    archived: archivedCountData?.meta?.total || 0,
    deleted: deletedCountData?.meta?.total || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("students")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("manageStudents")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExport}
            title={t("export") || "Export"}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t("export")}</span>
            <span className="sm:hidden">1</span>
          </Button> */}
          {!isReadOnly && (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("addStudent")}</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Comprehensive Export Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">
              {t("comprehensiveStudentsExport")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("comprehensiveStudentsExportDescription")}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col xl:flex-row gap-3 xl:items-end">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,1.4fr)_minmax(0,1fr)] flex-1">
                <div className="space-y-1">
                  <label htmlFor="export_from_date" className="text-sm">
                    {t("fromDate")}
                  </label>
                  <Input
                    id="export_from_date"
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="export_to_date" className="text-sm">
                    {t("toDate")}
                  </label>
                  <Input
                    id="export_to_date"
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="export_group_id" className="text-sm">
                    {t("group")}
                  </label>
                  <SearchableSelect
                    id="export_group_id"
                    value={exportGroupId}
                    onValueChange={setExportGroupId}
                    options={exportGroupOptions}
                    placeholder={t("allGroups")}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                    disabled={isLoadingGroups}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="export_status" className="text-sm">
                    {t("status")}
                  </label>
                  <SearchableSelect
                    id="export_status"
                    value={exportStatus}
                    onValueChange={setExportStatus}
                    options={exportStatusOptions}
                    placeholder={t("allStatuses")}
                    searchPlaceholder={`${t("search")}...`}
                    emptyText={t("noDataFound")}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="gap-2 xl:self-end bg-primary/10 hover:bg-primary/20"
                onClick={handleExportComprehensiveData}
                disabled={isComprehensiveExporting}
                title={t("exportAllStudentsData")}
              >
                <Download className="w-4 h-4" />
                {isComprehensiveExporting
                  ? t("exportingData")
                  : t("exportAllStudentsData")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: t("totalStudents"),
            value: stats.total,
            icon: UsersIcon,
            color: "blue",
          },
          {
            label: t("active"),
            value: stats.active,
            icon: UsersIcon,
            color: "green",
          },
          {
            label: t("archived"),
            value: stats.archived,
            icon: UsersIcon,
            color: "purple",
          },
          {
            label: t("deleted"),
            value: stats.deleted,
            icon: UsersIcon,
            color: "rose",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="border-border/50 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}
                >
                  <stat.icon
                    className={`w-5 h-5 text-${stat.color}-600 dark:text-${stat.color}-400`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchByName")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-border/50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-40"
                >
                  <option value="">{t("allStatuses")}</option>
                  <option value="active">{t("active")}</option>
                  <option value="archived">{t("archived")}</option>
                  <option value="deleted">{t("deleted")}</option>
                </Select>
                <SearchableSelect
                  value={groupFilter}
                  onValueChange={(value) => {
                    console.log("[STUDENTS] Group filter changed:", value);
                    setGroupFilter(value);
                  }}
                  options={studentGroupFilterOptions}
                  placeholder={t("allGroups")}
                  searchPlaceholder={`${t("search")}...`}
                  emptyText={t("noDataFound")}
                  className="w-full sm:w-72 lg:w-80 xl:w-[22rem]"
                  triggerClassName="h-9"
                  disabled={isLoadingGroups}
                />
                <Input
                  type="number"
                  placeholder={t("archiveYear")}
                  value={archiveYearFilter}
                  onChange={(e) => setArchiveYearFilter(e.target.value)}
                  className="w-full sm:w-40"
                  min="2020"
                  max="2050"
                />{" "}
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span>{t("activeFilters")}</span>
                {search && (
                  <Badge variant="secondary">
                    {t("search")}: {search}
                  </Badge>
                )}
                {statusFilter && (
                  <Badge variant="secondary">
                    {t("status")}: {t(statusFilter)}
                  </Badge>
                )}
                {groupFilter && (
                  <Badge variant="secondary">
                    {t("group")}:{" "}
                    {
                      allGroups.find(
                        (g) => g?.id?.toString() === groupFilter,
                      )?.name
                    }
                  </Badge>
                )}
                {archiveYearFilter && (
                  <Badge variant="secondary">
                    {t("archiveYear")}: {archiveYearFilter}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Students Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg">{t("studentsList")}</CardTitle>
          </CardHeader>
          <Table isLoading={isLoading}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("studentName")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("contact")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("group")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("dateOfBirth")}
                </TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right [&>div]:justify-end">
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data && data.data.length > 0 ? (
                data.data.map((student) => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {student.first_name?.[0]}
                          {student.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/students/${student.id}`}
                            className="font-medium text-foreground truncate hover:underline"
                          >
                            {formatNameParts(student.last_name, student.first_name)}
                          </Link>
                          {contractNumberByStudent.get(student.id) && (
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              {contractNumberByStudent.get(student.id)}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground truncate">
                            {student.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>
                        <p className="text-sm text-foreground">
                          {student.phone}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {student.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline">
                        {allGroups.find((g) => g.id === student.group_id)
                          ?.name || t("noGroup") || "No Group"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {student.date_of_birth &&
                          format(new Date(student.date_of_birth), "dd-MM-yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(student);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {/* <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(student);
                          }}
                          disabled={deleteMutation.isPending}
                          className="h-8 w-8 p-0 text-red-500 hover:text-white hover:bg-red-500 dark:hover:bg-red-900/40 transition-colors duration-150"
                          title={t("deleteStudent")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button> */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty
                  icon={<UsersIcon className="w-12 h-12" />}
                  title={t("noStudentsFound")}
                  description={
                    hasActiveFilters
                      ? t("adjustFiltersMessage")
                      : t("getStartedByCreating")
                  }
                  action={
                    hasActiveFilters ? (
                      <Button variant="outline" onClick={clearFilters}>
                        {t("clearFilters")}
                      </Button>
                    ) : !isReadOnly ? (
                      <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t("addStudent")}
                      </Button>
                    ) : null
                  }
                />
              )}
            </TableBody>
          </Table>
          {data?.meta && data.meta.total_pages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={data.meta.total_pages}
              totalItems={data.meta.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          )}
        </Card>
      </motion.div>

      {/* Student Dialog (for editing existing students) */}
      <StudentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        student={selectedStudent}
      />

      {/* Combined Student + Contract Dialog (for creating new students) */}
      <StudentWithContractDialog
        open={isCombinedDialogOpen}
        onOpenChange={setIsCombinedDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["students"] });
          queryClient.invalidateQueries({ queryKey: ["students-count"] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      {/* <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse" />
              </div>
              <DialogTitle className="text-xl font-bold text-red-600 dark:text-red-400">
                {t("confirmDelete") || "O'chirishni tasdiqlang"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base mt-4">
              <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-l-4 border-red-500 rounded-lg shadow-sm">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-red-900 dark:text-red-200 mb-2 flex items-center gap-2">
                      <span>
                        {t("deleteStudentWarning") || "Talabani o'chirasizmi?"}
                      </span>
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300 font-semibold mb-2">
                      {t("thisActionCannotBeUndone") ||
                        "Bu amalni qaytarib bo'lmaydi!"}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1.5">
                      {t("followingWillBeDeleted") ||
                        "Quyidagilar o'chiriladi:"}
                    </p>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5 list-disc list-inside ml-1">
                      <li>{t("studentProfile") || "Talaba profili"}</li>
                      <li>{t("allContracts") || "Barcha shartnomalar"}</li>
                      <li>{t("paymentHistory") || "To'lov tarixi"}</li>
                      <li>{t("attendanceRecords") || "Davomat yozuvlari"}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setStudentToDelete(null);
              }}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleteMutation.isPending ? t("deleting") : t("deleteStudent")}
            </Button>
          </div>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
