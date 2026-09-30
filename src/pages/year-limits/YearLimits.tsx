import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  CalendarRange,
  Download,
  Edit,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { yearLimitService } from "@/services/api.service";
import { downloadFile } from "@/lib/export-utils";
import { format } from "date-fns";
import type { YearLimitUsage } from "@/types/api";
import { useLanguageStore } from "@/store/languageStore";
import { usePermissions } from "@/hooks/usePermissions";
import { yearLimitKeys, invalidateYearLimits } from "@/hooks/useYearLimit";
import { YearLimitDialog } from "./YearLimitDialog";

/**
 * Per-birth-year enrolment limits.
 *
 * A year's limit caps the total number of ACTIVE contracts of that birth year
 * across every group — groups and coaches within the year are unrestricted. A
 * year with no row here is unlimited.
 */
export default function YearLimits() {
  const { t } = useLanguageStore();
  const { canWrite } = usePermissions();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<YearLimitUsage | null>(
    null,
  );

  const canEdit = canWrite("groups:edit");

  const { data, isLoading } = useQuery({
    queryKey: yearLimitKeys.usage(),
    queryFn: () => yearLimitService.getYearLimitsUsage(),
  });

  const limits = useMemo(
    () => [...(data?.data || [])].sort((a, b) => b.birth_year - a.birth_year),
    [data],
  );

  const totals = useMemo(
    () =>
      limits.reduce(
        (acc, limit) => ({
          capacity: acc.capacity + (limit.max_students ?? 0),
          used: acc.used + limit.current_count,
          remaining: acc.remaining + Math.max(limit.remaining ?? 0, 0),
          full: acc.full + (limit.is_full ? 1 : 0),
        }),
        { capacity: 0, used: 0, remaining: 0, full: 0 },
      ),
    [limits],
  );

  const deleteMutation = useMutation({
    mutationFn: (birthYear: number) =>
      yearLimitService.deleteYearLimit(birthYear),
    onSuccess: () => {
      invalidateYearLimits(queryClient);
      toast.success(t("yearLimitDeleted"));
    },
    // 404 (no limit for that year) surfaces through the global interceptor.
  });

  const handleOpenDialog = (limit: YearLimitUsage | null) => {
    setSelectedLimit(limit);
    setIsDialogOpen(true);
  };

  const handleDelete = (limit: YearLimitUsage) => {
    const message = t("confirmDeleteYearLimit").replace(
      "{{year}}",
      String(limit.birth_year),
    );
    if (confirm(message)) {
      deleteMutation.mutate(limit.birth_year);
    }
  };

  const statCards = [
    {
      label: t("limitedYears"),
      value: limits.length,
      icon: CalendarRange,
      color: "text-blue-500",
    },
    {
      label: t("totalYearCapacity"),
      value: totals.capacity,
      icon: Users,
      color: "text-emerald-500",
    },
    {
      label: t("usedSpots"),
      value: totals.used,
      icon: UserCheck,
      color: "text-orange-500",
    },
    {
      label: t("availableSpots"),
      value: totals.remaining,
      icon: TrendingUp,
      color: "text-purple-500",
    },
    {
      label: t("fullYears"),
      value: totals.full,
      icon: Users,
      color: "text-red-500",
    },
  ];

  const handleExportUsage = async () => {
    const promise = (async () => {
      const blob = await yearLimitService.exportYearLimitsUsage();
      if (!blob || blob.size === 0) {
        throw new Error("NO_DATA");
      }
      downloadFile(
        blob,
        `year_limits_usage_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      );
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
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("yearLimits")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("yearLimitsDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportUsage}
          >
            <Download className="w-4 h-4" />
            {t("exportYearLimitsUsage")}
          </Button>
          {canEdit && (
            <Button onClick={() => handleOpenDialog(null)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("newYearLimit")}
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {statCards.map((card) => (
          <Card key={card.label} className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? (
                  <Loader2 className="animate-spin w-8 h-8" />
                ) : (
                  card.value
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : limits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarRange className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("noYearLimits")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  {t("noYearLimitsHint")}
                </p>
                {canEdit && (
                  <Button onClick={() => handleOpenDialog(null)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("newYearLimit")}
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("birthYear")}</TableHead>
                    <TableHead>{t("maxStudents")}</TableHead>
                    <TableHead>{t("usedSpots")}</TableHead>
                    <TableHead>{t("availableSpots")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    {canEdit && (
                      <TableHead className="text-right">
                        {t("actions")}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((limit) => {
                    const remaining = Math.max(limit.remaining ?? 0, 0);
                    return (
                      <TableRow key={limit.birth_year}>
                        <TableCell className="font-semibold">
                          {limit.birth_year}
                        </TableCell>
                        <TableCell>
                          {limit.has_limit
                            ? limit.max_students
                            : t("yearLimitUnlimited")}
                        </TableCell>
                        <TableCell>{limit.current_count}</TableCell>
                        <TableCell>
                          {limit.has_limit ? remaining : "—"}
                        </TableCell>
                        <TableCell>
                          {!limit.has_limit ? (
                            <Badge variant="outline">
                              {t("yearLimitUnlimited")}
                            </Badge>
                          ) : limit.is_full ? (
                            <Badge variant="destructive">{t("full")}</Badge>
                          ) : (
                            <Badge variant="default">
                              {t("yearLimitSlotsLeft").replace(
                                "{{count}}",
                                String(remaining),
                              )}
                            </Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(limit)}
                                className="gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                {t("edit")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(limit)}
                                disabled={deleteMutation.isPending}
                                className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4" />
                                {t("delete")}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <YearLimitDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        limit={selectedLimit}
      />
    </div>
  );
}
