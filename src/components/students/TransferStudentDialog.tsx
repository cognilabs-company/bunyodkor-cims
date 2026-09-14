import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentService, groupService } from "@/services/api.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLanguageStore } from "@/store/languageStore";
import { formatGroupSelectLabel } from "@/lib/name-utils";
import { invalidateYearLimits } from "@/hooks/useYearLimit";
import type { GroupRead } from "@/types/api";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface TransferStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  currentGroupId: number | null;
  currentGroupName?: string | null;
  /** Shown in the success message to reassure staff it did not change. */
  contractNumber?: string | null;
  onSuccess?: () => void;
}

const extractDetail = (err: unknown): string | undefined => {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err.response as { data?: { detail?: unknown } })?.data
      ?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg || detail[0]?.message;
    }
  }
  return undefined;
};

export function TransferStudentDialog({
  open,
  onOpenChange,
  studentId,
  currentGroupId,
  currentGroupName,
  contractNumber,
  onSuccess,
}: TransferStudentDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();

  const [targetGroupId, setTargetGroupId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setTargetGroupId("");
      setReason("");
    }
  }, [open]);

  // Load every group (transfers across birth years are allowed, so we do NOT
  // filter by birth year).
  const { data: groups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups-list", "transfer-student"],
    queryFn: async () => {
      const firstPage = await groupService.getGroups({
        page: 1,
        page_size: 100,
      });
      const totalPages = firstPage.meta?.total_pages || 1;
      if (totalPages <= 1) return firstPage.data || [];

      const restPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) =>
          groupService.getGroups({ page: idx + 2, page_size: 100 }),
        ),
      );
      return [
        ...(firstPage.data || []),
        ...restPages.flatMap((r) => r.data || []),
      ];
    },
    enabled: open,
  });

  // Every group is a valid target. Group capacity no longer limits anything,
  // and a transfer keeps the contract and its birth year, so the year limit
  // does not apply either. The backend never answers "group full" here.
  const groupOptions = useMemo(
    () =>
      (groups || [])
        // Exclude the student's current group.
        .filter((g: GroupRead) => g.id !== currentGroupId)
        .map((g: GroupRead) => {
          const baseLabel = formatGroupSelectLabel(g) || g.name || `#${g.id}`;
          return {
            value: String(g.id),
            label: baseLabel,
            keywords: [
              g.name,
              g.birth_year,
              g.coach_first_name,
              g.coach_last_name,
              String(g.id),
            ]
              .filter(Boolean)
              .map(String),
          };
        }),
    [groups, currentGroupId],
  );

  const transferMutation = useMutation({
    mutationFn: () =>
      studentService.transferStudent(studentId, {
        target_group_id: Number(targetGroupId),
        reason: reason.trim() || undefined,
      }),
    onSuccess: (res) => {
      const toGroupName =
        groups?.find((g: GroupRead) => g.id === Number(targetGroupId))?.name ||
        "";
      const number = res.data?.contract_number || contractNumber || "";
      // Refresh the student detail view.
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      // A transfer can move the contract into a different birth year, so both
      // years' counters are stale now.
      invalidateYearLimits(queryClient);
      toast.success(
        `${t("transferSuccess")}${toGroupName ? ` — ${toGroupName}` : ""}. ${t(
          "contractNumberUnchanged",
        )}${number ? ` (${number})` : ""}.`,
        { duration: 6000 },
      );
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(extractDetail(err) || t("transferFailed"));
    },
  });

  const handleConfirm = () => {
    if (!targetGroupId) {
      toast.error(t("selectTargetGroup"));
      return;
    }
    transferMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t("transferStudentTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("contractNumberUnchanged")}
            {contractNumber ? ` (${contractNumber}).` : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t("currentGroup")}</Label>
            <Input
              value={currentGroupName || t("notAssigned")}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="target_group_id">{t("targetGroup")}</Label>
            <SearchableSelect
              id="target_group_id"
              value={targetGroupId}
              onValueChange={setTargetGroupId}
              options={groupOptions}
              placeholder={t("selectTargetGroup")}
              searchPlaceholder={`${t("search") || "Search"}...`}
              emptyText={t("noDataFound") || "No data found"}
              triggerClassName="h-10"
              contentClassName="z-[10020]"
              disabled={isLoadingGroups}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="transfer_reason">{t("reason")}</Label>
            <Input
              id="transfer_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("transferReasonPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transferMutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              transferMutation.isPending ||
              !targetGroupId ||
              isLoadingGroups
            }
          >
            {transferMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("transferring")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                {t("confirmTransfer")}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
