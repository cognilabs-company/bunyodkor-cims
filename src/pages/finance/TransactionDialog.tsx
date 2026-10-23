import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  transactionService,
  contractService,
  studentService,
} from "@/services/api.service";
import type { TransactionSource } from "@/types";
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
import { Badge } from "@/components/ui/badge";
import { Calendar, X, Check, User } from "lucide-react";
import toast from "react-hot-toast";
import { useLanguageStore } from "@/store/languageStore";
import { useDebounce } from "@/hooks/useDebounce";
import type { ContractRead, StudentRead } from "@/types/api";
import { formatNameParts } from "@/lib/name-utils";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "manual" | "spravka";
}

interface TransactionFormData {
  amount: number;
  source: "bank" | "payme" | "click";
  contract_number: string;
  payment_year: number;
  payment_months: string;
  comment?: string;
  file_type: "malumotnoma" | "bildirgi" | "buyruq";
  order_number?: string;
}

interface CreateTransactionPayload {
  amount: number;
  source: TransactionSource;
  contract_number: string;
  payment_year: number;
  payment_months: number[];
  comment?: string;
  proof_file?: File | null;
  mode: "manual" | "spravka";
}

// Backenddan keladigan ContractRead turini kengaytiramiz
type ContractWithStudent = ContractRead & { student?: StudentRead };

export function TransactionDialog({
  open,
  onOpenChange,
  mode,
}: TransactionDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const isSpravkaMode = mode === "spravka";

  // States
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [contractSearch, setContractSearch] = useState("");
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [selectedContract, setSelectedContract] =
    useState<ContractWithStudent | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedContractSearch = useDebounce(contractSearch, 300);

  const monthNames = [
    t("january"),
    t("february"),
    t("march"),
    t("april"),
    t("may"),
    t("june"),
    t("july"),
    t("august"),
    t("september"),
    t("october"),
    t("november"),
    t("december"),
  ];

  const monthShortNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // 1. Shartnomalarni qidirish (Autocomplete uchun)
  const { data: contractsData } = useQuery({
    queryKey: ["contracts-search", debouncedContractSearch],
    queryFn: () =>
      contractService.getContracts({
        page: 1,
        page_size: 10,
        contract_number: debouncedContractSearch || undefined,
      }),
    enabled: debouncedContractSearch.length > 0,
  });

  // 2. Barcha talabalarni yuklash (Agar shartnoma ichida student kelmasa)
  const { data: studentsData } = useQuery({
    queryKey: ["students-list-full"],
    queryFn: () => studentService.getStudents({ page: 1, page_size: 2000 }),
    enabled: open,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormData>({
    defaultValues: {
      amount: 0,
      source: "bank",
      contract_number: "",
      payment_year: new Date().getFullYear(),
      payment_months: "",
      file_type: "malumotnoma",
      order_number: "",
    },
  });

  // Tanlangan file turi (buyruq tanlansa, buyruq raqami maydoni chiqadi)
  const selectedFileType = watch("file_type");
  const isBuyruq = isSpravkaMode && selectedFileType === "buyruq";

  // Yordamchi funksiya: Talaba ma'lumotini topish
  const getStudentInfo = (contract: ContractRead): StudentRead | undefined => {
    const c = contract as ContractWithStudent;
    if (c.student) return c.student;
    return studentsData?.data?.find(
      (s: StudentRead) => s.id === contract.student_id
    );
  };

  // Yordamchi funksiya: Talaba ismini string ko'rinishida olish
  const getStudentNameString = (contract: ContractRead) => {
    const student = getStudentInfo(contract);
    return student
      ? formatNameParts(student.last_name, student.first_name)
      : t("noStudentAttached");
  };

  // Yoshni hisoblash
  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const toggleMonth = (monthNumber: number) => {
    const newSelectedMonths = selectedMonths.includes(monthNumber)
      ? selectedMonths.filter((m) => m !== monthNumber)
      : [...selectedMonths, monthNumber].sort((a, b) => a - b);

    setSelectedMonths(newSelectedMonths);
    setValue("payment_months", newSelectedMonths.join(", "));
  };

  const isAllowedProofFile = (file: File) =>
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setProofFile(null);
      return;
    }

    setProofFile(file);
  };

  const handleContractSelect = (contract: ContractRead) => {
    setSelectedContract(contract as ContractWithStudent);
    setContractSearch(contract.contract_number);
    setValue("contract_number", contract.contract_number);
    setValue("amount", isSpravkaMode ? 0 : contract.monthly_fee);
    setShowContractDropdown(false);
  };

  useEffect(() => {
    if (contractSearch !== selectedContract?.contract_number) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedContract(null);
    }
  }, [contractSearch, selectedContract]);

  useEffect(() => {
    if (open && isSpravkaMode) {
      setValue("amount", 0);
    }
  }, [open, isSpravkaMode, setValue]);

  useEffect(() => {
    if (open && !isSpravkaMode) {
      setValue("source", "bank");
    }
  }, [open, isSpravkaMode, setValue]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContractSearch("");
      setSelectedContract(null);
      setSelectedMonths([]);
      setProofFile(null);
      setValue("order_number", "");
      setValue("file_type", "malumotnoma");
    }
  }, [open, setValue]);

  // Dropdowndan tashqariga bosilganda yopish
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowContractDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mutation = useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const paidAt = new Date().toISOString();

      if (payload.mode === "spravka") {
        const formData = new FormData();
        formData.append("contract_number", payload.contract_number);
        formData.append("source", payload.source);
        formData.append("amount", String(payload.amount));
        formData.append("payment_year", String(payload.payment_year));
        formData.append("payment_months", payload.payment_months.join(","));
        formData.append("settlement_type", "waiver_spravka");
        formData.append("waiver_spravka", "true");
        if (payload.comment) {
          formData.append("comment", payload.comment);
        }
        formData.append("paid_at", paidAt);
        if (payload.proof_file) {
          formData.append("proof_file", payload.proof_file);
        }
        return transactionService.createManualTransactionWithProof(formData, {
          suppressGlobalErrorToast: true,
        });
      }

      return transactionService.createManualTransaction({
        amount: payload.amount,
        source: payload.source,
        contract_number: payload.contract_number,
        payment_year: payload.payment_year,
        payment_months: payload.payment_months,
        comment: payload.comment,
        paid_at: paidAt,
      }, {
        suppressGlobalErrorToast: true,
      });
    },
    onSuccess: () => {
      // Invalidate AND refetch finance section queries
      queryClient.invalidateQueries({
        queryKey: ["transactions-with-name"],
        refetchType: "all"
      });
      queryClient.invalidateQueries({
        queryKey: ["finance-report"],
        refetchType: "all"
      });
      queryClient.invalidateQueries({
        queryKey: ["unassigned-transactions"],
        refetchType: "all"
      });

      // Invalidate dashboard queries
      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary"],
        refetchType: "all"
      });
      queryClient.invalidateQueries({
        queryKey: ["recent-transactions"],
        refetchType: "all"
      });

      // Invalidate student detail page queries (all students)
      queryClient.invalidateQueries({
        queryKey: ["student-full-info"],
        refetchType: "all"
      });

      toast.success(
        t("transactionCreatedSuccess")
      );
      reset();
      setSelectedMonths([]);
      setProofFile(null);
      onOpenChange(false);
    },
    // --- ERROR QISMI O'ZGARTIRILDI ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      let errorMessage =
        t("failedToCreateTransaction");

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        const normalizedDetail = detail.toLowerCase();

        // Backend xabarlarini o'zbekchaga o'girish
        if (
          normalizedDetail.includes("cannot identify image file") ||
          normalizedDetail.includes("failed to upload file as pdf")
        ) {
          errorMessage = t("invalidProofFileFormat");
        } else if (normalizedDetail.includes("failed to upload proof file")) {
          errorMessage = t("failedToUploadProofFile");
        } else if (detail.includes("Contract not found")) {
          errorMessage = t("contractNotFound");
        } else if (detail.includes("Student not found")) {
          errorMessage = t("studentNotFound");
        } else if (detail.includes("Transaction already exists")) {
          errorMessage = t("transactionAlreadyExists");
        } else if (detail.toLowerCase().includes("permission")) {
          errorMessage = t("errorPermissionDenied");
        } else {
          errorMessage = detail;
        }
      }

      toast.error(errorMessage);
    },
    // ---------------------------------
  });

  const onSubmit = (data: TransactionFormData) => {
    const paymentMonthsArray = data.payment_months
      .split(",")
      .map((m) => parseInt(m.trim()))
      .filter((m) => !isNaN(m) && m >= 1 && m <= 12);

    if (paymentMonthsArray.length === 0) {
      toast.error(t("selectAtLeastOneMonth"));
      return;
    }

    if (isSpravkaMode) {
      if (!proofFile || !isAllowedProofFile(proofFile)) {
        toast.error(t("invalidProofFileFormat"));
        return;
      }
      if (data.file_type === "buyruq" && !data.order_number?.trim()) {
        toast.error(t("orderNumberRequired"));
        return;
      }
    }

    // Spravka izohi: file turi, buyruq bo'lsa buyruq raqami bilan birga saqlanadi
    let spravkaComment = data.file_type as string;
    if (data.file_type === "buyruq" && data.order_number?.trim()) {
      spravkaComment = `buyruq №${data.order_number.trim()}`;
    }

    mutation.mutate({
      amount: isSpravkaMode ? 0 : data.amount,
      source: isSpravkaMode ? "manual" : data.source,
      contract_number: data.contract_number,
      payment_year: data.payment_year,
      payment_months: paymentMonthsArray,
      comment: isSpravkaMode ? spravkaComment : data.comment,
      proof_file: isSpravkaMode ? proofFile : null,
      mode,
    });
  };

  // Tanlangan shartnoma uchun talaba ma'lumotini olish
  const currentStudent = selectedContract
    ? getStudentInfo(selectedContract)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[500px] max-w-[95vw]"
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>
            {isSpravkaMode ? t("addSpravka") : t("addTransaction")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="amount">{t("amount")} (UZS)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              {...register("amount", {
                valueAsNumber: true,
                ...(isSpravkaMode
                  ? {}
                  : {
                      required: t("amountRequired"),
                      min: {
                        value: 1,
                        message: t("amountMustBeGreaterThanZero"),
                      },
                    }),
              })}
              readOnly={isSpravkaMode}
            />
            {isSpravkaMode && (
              <p className="text-xs text-muted-foreground">
                {t("spravkaAmountZero")}
              </p>
            )}
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {isSpravkaMode && (
            <div className="space-y-1">
              <Label htmlFor="file_type">{t("fileType")}</Label>
              <Select id="file_type" {...register("file_type")}>
                <option value="malumotnoma">{t("fileTypeMalumotnoma")}</option>
                <option value="bildirgi">{t("fileTypeBildirgi")}</option>
                <option value="buyruq">{t("fileTypeBuyruq")}</option>
              </Select>
            </div>
          )}

          {isBuyruq && (
            <div className="space-y-1">
              <Label htmlFor="order_number">
                {t("orderNumber")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="order_number"
                placeholder={t("enterOrderNumber")}
                {...register("order_number")}
              />
              <p className="text-xs text-muted-foreground">
                {t("orderNumberHint")}
              </p>
            </div>
          )}

          {isSpravkaMode && (
            <div className="space-y-1">
              <Label htmlFor="spravka_source">{t("paymentSource")}</Label>
              <Input id="spravka_source" value={t("manual")} readOnly />
            </div>
          )}

          {isSpravkaMode && (
            <div className="space-y-1">
              <Label htmlFor="proof_file">
                {isBuyruq ? t("orderFile") : t("paymentProof")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="proof_file"
                type="file"
                accept="application/pdf,.pdf,image/*"
                onChange={handleProofFileChange}
              />
              <p className="text-xs text-muted-foreground">PDF yoki rasm</p>
            </div>
          )}

          {/* Shartnoma raqami (Autocomplete) */}
          <div
            className="space-y-1 relative contract-autocomplete"
            ref={dropdownRef}
          >
            <Label htmlFor="contract_number">{t("contractNumber")}</Label>
            <div className="relative">
              <Input
                id="contract_number"
                placeholder={t("enterContractNumber")}
                value={contractSearch}
                onChange={(e) => {
                  setContractSearch(e.target.value);
                  setValue("contract_number", e.target.value);
                  setShowContractDropdown(true);
                }}
                onFocus={() => setShowContractDropdown(true)}
                autoComplete="off"
              />
              {selectedContract && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              )}
            </div>
            {errors.contract_number && (
              <p className="text-sm text-red-500">
                {errors.contract_number.message}
              </p>
            )}

            {/* --- DROPDOWN RO'YXATI (Ism bilan) --- */}
            {showContractDropdown &&
              contractsData?.data &&
              contractsData.data.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {contractsData.data.map((contract: ContractRead) => (
                    <button
                      key={contract.id}
                      type="button"
                      onClick={() => handleContractSelect(contract)}
                      className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">
                            {contract.contract_number}
                          </p>
                          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">
                            {getStudentNameString(contract)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {new Intl.NumberFormat("uz-UZ").format(
                              contract.monthly_fee
                            )}{" "}
                            UZS
                          </p>
                          <Badge
                            className={`${
                              contract.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                            } border-0 text-[10px]`}
                          >
                            {contract.status}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

            {/* --- STUDENT MA'LUMOTLARI KARTASI --- */}
            {selectedContract && currentStudent && (
              <div className="mt-4 p-4 bg-white dark:bg-card border border-border rounded-xl shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("studentInformation")}
                  </h3>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[120px]">
                      {t("studentName")}:
                    </span>
                    <span className="font-medium text-foreground">
                      {formatNameParts(
                        currentStudent.last_name,
                        currentStudent.first_name,
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[120px]">
                      {t("phoneNumber")}:
                    </span>
                    <span className="text-foreground">
                      {currentStudent.phone}
                    </span>
                  </div>

                  {currentStudent.date_of_birth && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <div className="flex items-center gap-1 min-w-[120px]">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {t("birthYear")}:
                        </span>
                      </div>
                      <span className="text-foreground">
                        {new Date(currentStudent.date_of_birth).getFullYear()} (
                        {calculateAge(currentStudent.date_of_birth)}{" "}
                        {t("yearsOld")})
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[120px]">
                      {t("status")}:
                    </span>
                    <Badge
                      variant="secondary"
                      className="w-fit bg-slate-100 text-slate-800 hover:bg-slate-200"
                    >
                      {t(currentStudent.status) || "Faol"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment_year">{t("paymentYear")}</Label>
            <Input
              id="payment_year"
              type="number"
              placeholder="2025"
              {...register("payment_year", {
                required: t("paymentYearRequired"),
                valueAsNumber: true,
              })}
            />
            {errors.payment_year && (
              <p className="text-sm text-red-500">
                {errors.payment_year.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label>
                {isSpravkaMode
                  ? t("spravkaMonthsLabel")
                  : t("selectPaymentMonths")}{" "}
                <span className="text-red-500">*</span>
              </Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {monthShortNames.map((month, index) => {
                const monthNumber = index + 1;
                const isSelected = selectedMonths.includes(monthNumber);
                return (
                  <button
                    key={monthNumber}
                    type="button"
                    onClick={() => toggleMonth(monthNumber)}
                    className={`relative px-3 py-2.5 text-sm font-medium rounded-full border transition-all w-full min-w-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background hover:bg-muted border-input"
                    }`}
                  >
                    <span className="block">{month}</span>
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-background">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <input
              type="hidden"
              {...register("payment_months", {
                required: t("selectAtLeastOneMonth"),
              })}
            />
            {errors.payment_months && (
              <p className="text-sm text-red-500">
                {errors.payment_months.message}
              </p>
            )}
            {selectedMonths.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 p-3 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground font-medium">
                  {t("selected")}:
                </span>
                {selectedMonths.map((month) => (
                  <Badge
                    key={month}
                    variant="secondary"
                    className="gap-1 px-3 py-1.5 text-sm"
                  >
                    {monthNames[month - 1]}
                    <button
                      type="button"
                      onClick={() => toggleMonth(month)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {!isSpravkaMode && (
            <div className="space-y-1">
              <Label htmlFor="source">{t("paymentSource")}</Label>
              <Select id="source" {...register("source")}>
                <option value="bank">{t("bank")}</option>
                <option value="payme">{t("payme")}</option>
                <option value="click">{t("click")}</option>
              </Select>
            </div>
          )}

          {!isSpravkaMode && (
            <div className="space-y-1">
              <Label htmlFor="comment">
                {t("comment")} ({t("optional")})
              </Label>
              <Input
                id="comment"
                placeholder={t("monthlyPayment")}
                {...register("comment")}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("saving")
                : isSpravkaMode
                  ? t("addSpravka")
                  : t("addTransaction")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
