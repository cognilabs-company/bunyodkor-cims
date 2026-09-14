import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { yearLimitService } from "@/services/api.service";
import type { YearLimitUsage } from "@/types/api";
import { useLanguageStore } from "@/store/languageStore";
import { extractErrorMessage } from "@/lib/error-utils";
import { useYearLimit, invalidateYearLimits } from "@/hooks/useYearLimit";

interface YearLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row being edited; `null` opens the dialog in create mode. */
  limit: YearLimitUsage | null;
  /**
   * Create mode for one specific year (e.g. from a birth-year heading): the
   * year is prefilled and locked. Ignored when `limit` is given.
   */
  birthYear?: number | null;
  onSuccess?: () => void;
}

type YearLimitFormData = {
  birth_year: number | string;
  max_students: number | string;
};

const MIN_BIRTH_YEAR = 1900;
const MAX_BIRTH_YEAR = 2100;

export function YearLimitDialog({
  open,
  onOpenChange,
  limit,
  birthYear = null,
  onSuccess,
}: YearLimitDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const isEdit = Boolean(limit);
  const lockedYear = limit?.birth_year ?? birthYear;
  const isYearLocked = lockedYear != null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<YearLimitFormData>();

  const watchedYear = Number(watch("birth_year"));
  const watchedMax = Number(watch("max_students"));

  // Live headcount for the year being configured, so the admin sets a number
  // against the real enrolment instead of guessing.
  const { data: usage, isLoading: isLoadingUsage } = useYearLimit(
    watchedYear >= MIN_BIRTH_YEAR && watchedYear <= MAX_BIRTH_YEAR
      ? watchedYear
      : null,
  );

  useEffect(() => {
    if (!open) return;
    reset({
      birth_year: lockedYear ?? new Date().getFullYear() - 7,
      max_students: limit?.max_students ?? 100,
    });
  }, [limit, lockedYear, open, reset]);

  // Whether the typed year already has a limit is the server's answer, not the
  // dialog's mode: "New limit" + a year that is already limited must update it,
  // not fail with a duplicate error.
  const yearAlreadyLimited = Boolean(usage?.has_limit);

  const mutation = useMutation({
    mutationFn: (data: YearLimitFormData) =>
      yearLimitService.setYearLimit(
        Number(data.birth_year),
        Number(data.max_students),
      ),
    onSuccess: () => {
      invalidateYearLimits(queryClient);
      toast.success(
        yearAlreadyLimited ? t("yearLimitUpdated") : t("yearLimitCreated"),
      );
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      // 422 (negative limit, year outside 1900–2100) and 401/403 land here;
      // 409/404 cannot, since setYearLimit picks the endpoint that fits.
      toast.error(extractErrorMessage(error, t("anErrorOccurred")));
    },
  });

  const onSubmit = (data: YearLimitFormData) => mutation.mutate(data);

  // A limit below the current headcount is legal — it just closes the year
  // immediately — but it is almost never intended, so say so out loud.
  const isBelowCurrent =
    Boolean(usage) &&
    Number.isFinite(watchedMax) &&
    watchedMax < (usage?.current_count ?? 0);

  // Opened as "New limit" on a year that turns out to be limited already.
  const isUnexpectedUpdate = !isEdit && yearAlreadyLimited;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editYearLimit") : t("newYearLimit")}
          </DialogTitle>
          <DialogDescription>{t("yearLimitsDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="birth_year">
              {t("birthYear")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="birth_year"
              type="number"
              placeholder="2020"
              // The year identifies the limit, so it cannot be edited — delete
              // the row and create a new one to move a limit to another year.
              readOnly={isYearLocked}
              className={
                isYearLocked ? "bg-muted/50 cursor-not-allowed" : undefined
              }
              {...register("birth_year", {
                required: t("birthYearRequired"),
                min: { value: MIN_BIRTH_YEAR, message: t("birthYearInvalid") },
                max: { value: MAX_BIRTH_YEAR, message: t("birthYearInvalid") },
              })}
            />
            {errors.birth_year && (
              <p className="text-sm text-red-500">{errors.birth_year.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="max_students">
              {t("maxStudents")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="max_students"
              type="number"
              min={0}
              step={1}
              placeholder="200"
              {...register("max_students", {
                required: t("maxStudentsRequired"),
                // The backend takes a non-negative integer; 0 closes the year.
                min: { value: 0, message: t("maxStudentsInvalid") },
                validate: (value) =>
                  Number.isInteger(Number(value)) || t("maxStudentsInvalid"),
              })}
            />
            {errors.max_students ? (
              <p className="text-sm text-red-500">
                {errors.max_students.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("maxStudentsHint")}
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            {isLoadingUsage ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t("checkingYearLimit")}
              </span>
            ) : usage ? (
              <span className="text-muted-foreground">
                {t("currentlyEnrolled")}:{" "}
                <span className="font-semibold text-foreground">
                  {usage.current_count}
                </span>{" "}
                ({usage.birth_year})
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("enterBirthYearToSeeUsage")}
              </span>
            )}
          </div>

          {isUnexpectedUpdate && (
            <div className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t("yearLimitAlreadySet")
                  .replace("{{year}}", String(usage?.birth_year ?? ""))
                  .replace("{{max}}", String(usage?.max_students ?? ""))}
              </span>
            </div>
          )}

          {isBelowCurrent && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t("yearLimitBelowCurrent").replace(
                  "{{count}}",
                  String(usage?.current_count ?? 0),
                )}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {yearAlreadyLimited ? t("save") : t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
