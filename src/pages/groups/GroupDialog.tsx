/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import toast from "react-hot-toast";
import { groupService, userService } from "@/services/api.service";
import type {
  GroupRead,
  GroupCreateRequest,
  GroupUpdateRequest,
} from "@/types/api";
import { useLanguageStore } from "@/store/languageStore";
import { formatStaffName } from "@/lib/name-utils";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupRead | null;
  onSuccess?: () => void;
}

// Form ma'lumotlari uchun type (API typelaridan foydalanamiz)
type GroupFormData = {
  name: string;
  identifier: string;
  birth_year: number | string;
  description: string;
  schedule_days: string;
  schedule_time: string;
  coach_id: number | string;
};

const normalizeScheduleDays = (raw: string) => {
  if (!raw) return raw;

  const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const aliases: Record<string, string> = {
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wen: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thur: "Thu",
    thurs: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
    sun: "Sun",
    sunday: "Sun",
  };

  const normalized = raw
    .split(/[^a-zA-Z]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => aliases[token])
    .filter(Boolean);

  if (normalized.length === 0) {
    return raw.trim();
  }

  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  return unique.join("-");
};

export function GroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: GroupDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const isEdit = Boolean(group);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GroupFormData>();

  const selectedScheduleDays = normalizeScheduleDays(watch("schedule_days") || "")
    .split("-")
    .filter(Boolean);

  const toggleScheduleDay = (day: string) => {
    const current = new Set(selectedScheduleDays);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }

    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const next = Array.from(current).sort(
      (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
    );
    setValue("schedule_days", next.join("-"), {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const { data: coachesData } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => userService.getCoaches(),
  });

  useEffect(() => {
    if (open) {
      if (group) {
        reset({
          name: group.name,
          identifier: group.identifier,
          birth_year: group.birth_year,
          description: group.description,
          schedule_days: normalizeScheduleDays(group.schedule_days),
          schedule_time: group.schedule_time,
          coach_id: group.coach_id,
        });
      } else {
        reset({
          name: "",
          identifier: "",
          birth_year: new Date().getFullYear() - 7, // Default: 7 yoshli bolalar uchun
          description: "",
          schedule_days: "Mon-Wed-Fri",
          schedule_time: "14:00-16:00",
          coach_id: "",
        });
      }
    }
  }, [group, open, reset]);

  const mutation = useMutation({
    mutationFn: (data: GroupCreateRequest | GroupUpdateRequest) => {
      if (group) {
        return groupService.updateGroup(group.id, data);
      } else {
        return groupService.createGroup(data as GroupCreateRequest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(
        group ? t("groupUpdatedSuccess") : t("groupCreatedSuccess")
      );
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = t("anErrorOccurred");

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }

      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: GroupFormData) => {
    if (!Number(data.coach_id)) {
      toast.error(t("selectCoach"));
      return;
    }

    if (group) {
      // PATCH /groups/{id} is a partial update, and it rejects `identifier` and
      // `birth_year` with a 400 because contract numbers are built from them.
      // So send only the fields the user actually changed. Schedule is not
      // offered in edit mode, so it never appears here.
      const changed: GroupUpdateRequest = {};

      if (data.name !== group.name) changed.name = data.name;
      if ((data.description ?? "") !== (group.description ?? ""))
        changed.description = data.description;
      if (Number(data.coach_id) !== group.coach_id)
        changed.coach_id = Number(data.coach_id);

      if (Object.keys(changed).length === 0) {
        toast(t("noChangesToSave"));
        onOpenChange(false);
        return;
      }

      mutation.mutate(changed);
      return;
    }

    const payload: GroupCreateRequest = {
      name: data.name,
      identifier: data.identifier,
      birth_year: Number(data.birth_year),
      description: data.description,
      schedule_days: normalizeScheduleDays(data.schedule_days),
      schedule_time: data.schedule_time,
      coach_id: Number(data.coach_id),
    };

    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? t("editGroup") : t("addNewGroup")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">
                {t("groupName")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="U15-2B"
                {...register("name", { required: t("groupNameRequired") })}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="identifier">
                {t("identifier")} <span className="text-red-500">*</span>
              </Label>
              {/* Frozen once the group exists: contract numbers are built from
                  it, so the backend answers 400 on any change. */}
              <Input
                id="identifier"
                placeholder="B2"
                readOnly={isEdit}
                aria-readonly={isEdit}
                tabIndex={isEdit ? -1 : undefined}
                className={
                  isEdit ? "bg-muted/50 cursor-not-allowed font-mono" : undefined
                }
                {...register("identifier", { required: t("identifierRequired") })}
              />
              {errors.identifier && (
                <p className="text-sm text-red-500">{errors.identifier.message}</p>
              )}
            </div>
          </div>

          {/* Capacity is not asked for at all: it limits nothing, and the
              backend treats it as optional. */}
          <div className="space-y-1">
            <Label htmlFor="birth_year">
              {t("birthYear")} <span className="text-red-500">*</span>
            </Label>
            {/* Frozen for the same reason as `identifier`. */}
            <Input
              id="birth_year"
              type="number"
              placeholder="2015"
              readOnly={isEdit}
              aria-readonly={isEdit}
              tabIndex={isEdit ? -1 : undefined}
              className={
                isEdit ? "bg-muted/50 cursor-not-allowed font-mono" : undefined
              }
              {...register("birth_year", {
                required: t("birthYearRequired"),
                valueAsNumber: true,
              })}
            />
            {errors.birth_year && (
              <p className="text-sm text-red-500">
                {errors.birth_year.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">{t("description")}</Label>
            <Input
              id="description"
              placeholder="Advanced training for the under-15 team"
              {...register("description")}
            />
          </div>

          {/* Schedule is set once, at creation. */}
          {!isEdit && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="schedule_days">
                {t("scheduleDays")} <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {weekDays.map((day) => {
                  const isSelected = selectedScheduleDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="h-9 px-2 text-xs"
                      onClick={() => toggleScheduleDay(day)}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
              <input
                type="hidden"
                id="schedule_days"
                {...register("schedule_days", {
                  required: t("scheduleDaysRequired"),
                })}
              />
              <div className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                {normalizeScheduleDays(watch("schedule_days") || "") || "-"}
              </div>
              {errors.schedule_days && (
                <p className="text-sm text-red-500">
                  {errors.schedule_days.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="schedule_time">
                {t("scheduleTime")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schedule_time"
                placeholder="15:00 - 17:00"
                {...register("schedule_time", {
                  required: t("scheduleTimeRequired"),
                })}
              />
              {errors.schedule_time && (
                <p className="text-sm text-red-500">
                  {errors.schedule_time.message}
                </p>
              )}
            </div>
          </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="coach_id">
              {t("coach")} <span className="text-red-500">*</span>
            </Label>
            <Select
              id="coach_id"
              {...register("coach_id", { required: t("coachRequired") })}
            >
              <option value="">{t("selectCoach")}</option>
              {coachesData?.data?.map((coach: any) => (
                <option key={coach.id} value={coach.id}>
                  {formatStaffName(coach.full_name)}
                </option>
              ))}
            </Select>
            {errors.coach_id && (
              <p className="text-sm text-red-500">
                {errors.coach_id.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
