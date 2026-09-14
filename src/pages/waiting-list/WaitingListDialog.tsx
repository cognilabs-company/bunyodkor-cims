/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { waitingListService, groupService } from "@/services/api.service";
import type {
  WaitingListRead,
  WaitingListCreate,
  WaitingListUpdate,
  GroupRead,
} from "@/types/api";
import { useLanguageStore } from "@/store/languageStore";
import { Loader2 } from "lucide-react";
import { formatGroupSelectLabel } from "@/lib/name-utils";

interface WaitingListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: WaitingListRead | null;
  onSuccess?: () => void;
}

type WaitingListFormData = {
  student_first_name: string;
  student_last_name: string;
  birth_year: number | string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  group_id: number | string;
  priority: number | string;
  notes: string;
};

export function WaitingListDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: WaitingListDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WaitingListFormData>();

  const selectedGroupId = watch("group_id");

  // Get groups list
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups-list-all"],
    queryFn: async () => {
      let allGroups: GroupRead[] = [];
      let currentPage = 1;
      let hasMore = true;
      while (hasMore) {
        const response = await groupService.getGroups({
          page: currentPage,
          page_size: 100,
        });
        if (response.data && response.data.length > 0) {
          allGroups = [...allGroups, ...response.data];
          if (response.meta && currentPage < response.meta.total_pages) {
            currentPage++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      return { data: allGroups };
    },
    enabled: open,
  });

  // Normalize groups data
  const groupsList: GroupRead[] = useMemo(() => {
    if (!groupsData?.data) return [];
    return groupsData.data;
  }, [groupsData]);

  // Get selected group's capacity for validation
  const selectedGroup = groupsList.find(
    (g: any) => g.id === Number(selectedGroupId),
  );
  const maxPriority = selectedGroup?.capacity || 100;

  // Auto-calculate priority based on group capacity
  useEffect(() => {
    if (selectedGroupId && groupsList.length > 0 && !entry) {
      const selectedGroup = groupsList.find(
        (g: any) => g.id === Number(selectedGroupId),
      );
      if (selectedGroup && selectedGroup.capacity) {
        const currentCount = selectedGroup.current_student_count || 0;
        const capacity = selectedGroup.capacity;
        // Formula: Full group (100%) = priority close to capacity (lowest), Empty group (0%) = priority 1 (highest)
        const calculatedPriority = Math.max(
          1,
          Math.min(
            capacity,
            Math.floor(1 + (currentCount / capacity) * (capacity - 1)),
          ),
        );
        setValue("priority", calculatedPriority);
      }
    }
  }, [selectedGroupId, groupsList, entry, setValue]);

  useEffect(() => {
    if (open) {
      if (entry) {
        // Edit mode
        reset({
          student_first_name: entry.student_first_name,
          student_last_name: entry.student_last_name,
          birth_year: entry.birth_year,
          father_name: entry.father_name,
          father_phone: entry.father_phone,
          mother_name: entry.mother_name,
          mother_phone: entry.mother_phone,
          group_id: entry.group_id,
          priority: entry.priority,
          notes: entry.notes || "",
        });
      } else {
        // Create mode
        const currentYear = new Date().getFullYear();
        reset({
          student_first_name: "",
          student_last_name: "",
          birth_year: currentYear - 10, // Default to 10 years ago
          father_name: "",
          father_phone: "",
          mother_name: "",
          mother_phone: "",
          group_id: "",
          priority: 1, // Default to highest priority
          notes: "",
        });
      }
    }
  }, [entry, open, reset]);

  const mutation = useMutation({
    mutationFn: (data: WaitingListCreate | WaitingListUpdate) => {
      if (entry) {
        // Update
        return waitingListService.updateWaitingListEntry(
          entry.id,
          data as WaitingListUpdate,
        );
      }
      // Create
      return waitingListService.addToWaitingList(data as WaitingListCreate);
    },
    onSuccess: () => {
      toast.success(
        entry
          ? t("waitingListUpdatedSuccess")
          : t("waitingListAddedSuccess"),
      );
      queryClient.invalidateQueries({ queryKey: ["waiting-list"] });
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

  const onSubmit = (data: WaitingListFormData) => {
    if (entry) {
      // Update - all fields can be updated
      const payload: WaitingListUpdate = {
        student_first_name: data.student_first_name,
        student_last_name: data.student_last_name,
        birth_year: Number(data.birth_year),
        father_name: data.father_name,
        father_phone: data.father_phone,
        mother_name: data.mother_name,
        mother_phone: data.mother_phone,
        group_id: Number(data.group_id),
        priority: Number(data.priority),
        notes: data.notes || undefined,
      };
      mutation.mutate(payload);
    } else {
      // Create - all fields are required
      const payload: WaitingListCreate = {
        student_first_name: data.student_first_name,
        student_last_name: data.student_last_name,
        birth_year: Number(data.birth_year),
        father_name: data.father_name,
        father_phone: data.father_phone,
        mother_name: data.mother_name,
        mother_phone: data.mother_phone,
        group_id: Number(data.group_id),
        priority: Number(data.priority),
        notes: data.notes || undefined,
      };
      mutation.mutate(payload);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry
              ? t("editWaitingListEntry") || "Edit Waiting List Entry"
              : t("addToWaitingList") || "Add to Waiting List"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-6">
          {/* Student Information */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold text-sm text-foreground">
              {t("studentInformation") || "Student Information"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student_last_name">
                  {t("lastName") || "Last Name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="student_last_name"
                  {...register("student_last_name", {
                    required: t("lastNameRequired") || "Last name is required",
                  })}
                  placeholder={t("enterLastName") || "Enter last name"}
                />
                {errors.student_last_name && (
                  <p className="text-sm text-red-500">
                    {errors.student_last_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_first_name">
                  {t("firstName") || "First Name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="student_first_name"
                  {...register("student_first_name", {
                    required:
                      t("firstNameRequired") || "First name is required",
                  })}
                  placeholder={t("enterFirstName") || "Enter first name"}
                />
                {errors.student_first_name && (
                  <p className="text-sm text-red-500">
                    {errors.student_first_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_year">
                  {t("birthYear") || "Birth Year"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="birth_year"
                  type="number"
                  min="2000"
                  max={currentYear}
                  {...register("birth_year", {
                    required:
                      t("birthYearRequired") || "Birth year is required",
                    min: {
                      value: 2000,
                      message:
                        t("birthYearMin") || "Birth year must be at least 2000",
                    },
                    max: {
                      value: currentYear,
                      message: (
                        t("birthYearMax") ||
                        "Birth year cannot be greater than {{year}}"
                      ).replace("{{year}}", currentYear.toString()),
                    },
                  })}
                  placeholder="2015"
                />
                {errors.birth_year && (
                  <p className="text-sm text-red-500">
                    {errors.birth_year.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Parent Information */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold text-sm text-foreground">
              {t("parentInformation") || "Parent Information"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="father_name">
                  {t("fatherName") || "Father's Name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="father_name"
                  {...register("father_name", {
                    required:
                      t("fatherNameRequired") || "Father's name is required",
                  })}
                  placeholder={t("enterFatherName") || "Enter father's name"}
                />
                {errors.father_name && (
                  <p className="text-sm text-red-500">
                    {errors.father_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="father_phone">
                  {t("fatherPhone") || "Father's Phone"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="father_phone"
                  type="tel"
                  {...register("father_phone", {
                    required:
                      t("fatherPhoneRequired") || "Father's phone is required",
                  })}
                  placeholder={
                    t("enterFatherPhone") &&
                    t("enterFatherPhone") !== "enterFatherPhone"
                      ? t("enterFatherPhone")
                      : "+998 XX XXX XX XX"
                  }
                />
                {errors.father_phone && (
                  <p className="text-sm text-red-500">
                    {errors.father_phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mother_name">
                  {t("motherName") || "Mother's Name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mother_name"
                  {...register("mother_name", {
                    required:
                      t("motherNameRequired") || "Mother's name is required",
                  })}
                  placeholder={t("enterMotherName") || "Enter mother's name"}
                />
                {errors.mother_name && (
                  <p className="text-sm text-red-500">
                    {errors.mother_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mother_phone">
                  {t("motherPhone") || "Mother's Phone"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mother_phone"
                  type="tel"
                  {...register("mother_phone", {
                    required:
                      t("motherPhoneRequired") || "Mother's phone is required",
                  })}
                  placeholder={
                    t("enterMotherPhone") &&
                    t("enterMotherPhone") !== "enterMotherPhone"
                      ? t("enterMotherPhone")
                      : "+998 XX XXX XX XX"
                  }
                />
                {errors.mother_phone && (
                  <p className="text-sm text-red-500">
                    {errors.mother_phone.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Group and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group_id">
                {t("group") || "Group"} <span className="text-red-500">*</span>
              </Label>
              <Select
                id="group_id"
                {...register("group_id", {
                  required: t("groupRequired") || "Group is required",
                })}
                className="h-10"
              >
                <option value="">{t("selectGroup") || "Select group"}</option>
                {isLoadingGroups ? (
                  <option disabled>{t("loading") || "Loading..."}</option>
                ) : (
                  groupsList.map((group: GroupRead) => (
                    <option key={group.id} value={String(group.id)}>
                      {formatGroupSelectLabel(group)}
                    </option>
                  ))
                )}
              </Select>
              {errors.group_id && (
                <p className="text-sm text-red-500">
                  {errors.group_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">
                {t("priority") || "Priority"} (1-{maxPriority}){" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max={maxPriority}
                {...register("priority", {
                  required: t("priorityRequired") || "Priority is required",
                  min: {
                    value: 1,
                    message: t("priorityMin") || "Priority must be at least 1",
                  },
                  max: {
                    value: maxPriority,
                    message:
                      t("priorityMax") ||
                      `Priority must be at most ${maxPriority}`,
                  },
                })}
                placeholder="1"
              />
              {errors.priority && (
                <p className="text-sm text-red-500">
                  {errors.priority.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("priorityHelp")}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes") || "Notes"}</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder={
                t("waitingListNotesPlaceholder") || "Additional notes..."
              }
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("saving") || "Saving..."}
                </>
              ) : (
                t("save") || "Save"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
