/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Select } from "@/components/ui/select";
import toast from "react-hot-toast";
import {
  studentService,
  groupService,
  contractService,
} from "@/services/api.service";
import type { GroupRead } from "@/types/api";
import { useLanguageStore } from "@/store/languageStore";
import {
  Loader2,
  UserPlus,
  CheckCircle2,
  Copy,
  Download,
  Eye,
} from "lucide-react";

// openPdfUrl funksiyasini ishlatamiz
import { openPdfUrl } from "@/lib/open-pdf";
import { formatGroupSelectLabel } from "@/lib/name-utils";
import { useYearLimit, invalidateYearLimits } from "@/hooks/useYearLimit";
import { YearLimitNotice } from "@/components/year-limits/YearLimitNotice";

interface StudentWithContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface StudentFormData {
  // --- 1. Tizim uchun (Student Data) ---
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  status: "active" | "archived" | "deleted";
  group_id: number | string;

  // --- 2. Shartnoma uchun (Contract Data) ---
  contract_number: string;

  // Student Info
  student_fio: string;
  birth_year: string;
  student_address: string;

  // Parents Info
  dad_name: string;
  dad_phone: string;
  dad_occupation: string;

  mom_fio: string;
  mom_phone: string;
  mom_occupation: string;

  // Contract Dates
  contract_start_date: string;
  contract_end_date: string;

  // Buyurtmachi
  buyurtmachi_fio: string;
  buyurtmachi_passport_series_number: string;
  buyurtmachi_who_give: string;
  buyurtmachi_when_give: string;
  buyurtmachi_address: string;
  buyurtmachi_phone: string;

  // Tarbiyalanuvchi Hujjatlari
  tarbiyalanuvchi_birth_series_number: string;
  tarbiyalanuvchi_birth_year: string;
  tarbiyalanuvchi_who_give: string;
  tarbiyalanuvchi_when_give: string;

  // To'lov
  tolov_monthly_fee: number | string;
  tolov_amount_in_words: string;

  // --- 3. Fayllar ---
  passport_copy: FileList;
  form_086: FileList;
  heart_checkup: FileList;
  birth_certificate: FileList;
  contract_image_1: FileList;
  contract_image_2: FileList;
  contract_image_3: FileList;
  contract_image_4: FileList;
  contract_image_5: FileList;
}

const MONTH_NAMES = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

export function StudentWithContractDialog({
  open,
  onOpenChange,
  onSuccess,
}: StudentWithContractDialogProps) {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Group capacity blocks nothing (the backend's `is_full` is always false);
  // the only enrolment cap is the birth-year limit — see `isYearFull` below.
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  // PDF URL yoki Blob URL ni saqlash uchun
  const [pdfUrl, setPdfUrl] = useState<string>("");

  const steps = [
    t("preparingData"),
    t("generatingContract"),
    t("formattingDocument"),
    t("finalizing"),
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<StudentFormData>({
    defaultValues: {
      tolov_monthly_fee: "800000",
      tolov_amount_in_words: "саккиз юз минг",
    },
  });

  const selectedGroupId = watch("group_id");
  const birthYear = watch("birth_year");
  const primaryAddress = watch("address");
  const dateOfBirth = watch("date_of_birth");
  const [customerType, setCustomerType] = useState<
    "father" | "mother" | "other"
  >("other");

  // Watch fields
  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const middleName = watch("middle_name");
  const dadName = watch("dad_name");
  const dadPhone = watch("dad_phone");
  const momFio = watch("mom_fio");
  const momPhone = watch("mom_phone");

  const { data: groupsData } = useQuery({
    queryKey: ["groups-list"],
    queryFn: () => groupService.getGroups({ page: 1, page_size: 100 }),
    enabled: open,
  });

  // Enrolment is capped per BIRTH YEAR across every group, so the limit that
  // decides whether this student can be enrolled hangs off the selected group's
  // birth year, not off the group itself.
  const selectedGroupBirthYear =
    groupsData?.data?.find((g: GroupRead) => g.id === Number(selectedGroupId))
      ?.birth_year ?? null;

  const { data: yearUsage } = useYearLimit(selectedGroupBirthYear);
  const isYearFull = Boolean(yearUsage?.is_full);

  // Effects...
  useEffect(() => {
    if (dateOfBirth) {
      const year = new Date(dateOfBirth).getFullYear().toString();
      if (year && year.length === 4) {
        setValue("birth_year", year);
        setValue("tarbiyalanuvchi_birth_year", year);
      }
    }
  }, [dateOfBirth, setValue]);

  useEffect(() => {
    if (firstName || lastName || middleName) {
      const fullName = [lastName, firstName, middleName]
        .filter(Boolean)
        .join(" ");
      if (fullName.trim()) {
        setValue("student_fio", fullName);
      }
    }
  }, [firstName, lastName, middleName, setValue]);

  useEffect(() => {
    const fetchContractNumber = async () => {
      if (selectedGroupId && groupsData?.data) {
        try {
          const selectedGroup = groupsData.data.find(
            (g: any) => g.id === Number(selectedGroupId),
          );
          if (!selectedGroup) return;

          // The next serial is the only valid contract number — assign it and
          // display it read-only.
          const response = await contractService.getNextAvailableNumber(
            Number(selectedGroupId),
          );

          const contractNumber = response.data.contract_number || "";
          setValue("contract_number", contractNumber);
        } catch (error) {
          console.error("Shartnoma raqami xatosi:", error);
        }
      }
    };
    fetchContractNumber();
  }, [selectedGroupId, setValue, groupsData, birthYear, t]);

  // --- YANGILANGAN TUGMALAR LOGIKASI ---

  // 1. Shartnomani Yuklash
  const handleDownloadContract = () => {
    if (!pdfUrl) {
      toast.error(t("pdfNotFound"));
      return;
    }

    // Hozirgi shartnoma raqamini olamiz
    const contractNum = getValues("contract_number") || "shartnoma";

    // Faylni yuklash uchun link yaratamiz
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `shartnoma_${contractNum}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t("downloadedSuccessfully"));
  };

  // 2. Shartnomani Ko'rish (Student Detail Page dagi kabi)
  const handleViewContract = () => {
    if (pdfUrl) {
      // lib/open-pdf dagi yordamchi funksiyadan foydalanamiz
      openPdfUrl(pdfUrl);
    } else {
      toast.error("PDF fayli topilmadi");
    }
  };

  // Variant that fetches PDF URL from backend using contract number and start date (like StudentDetailPage)
  const viewContractByNumber = async () => {
    try {
      const contractNumber = getValues("contract_number");
      if (!contractNumber) {
        toast.error(
          t("contractNumberNotFormed"),
        );
        return;
      }

      const startDate = getValues("contract_start_date")
        ? new Date(getValues("contract_start_date"))
        : new Date();
      const year = startDate.getFullYear();

      const toastId = toast.loading(t("loadingContractFile"));
      const response = await contractService.getContractPdfUrl(
        year,
        contractNumber,
      );
      toast.dismiss(toastId);

      let pdfUrlFromResp: string | null = null;
      if (!response) pdfUrlFromResp = null;
      else if (typeof response === "string") pdfUrlFromResp = response;
      else if (typeof response === "object" && "pdf_url" in response)
        pdfUrlFromResp = (response as any).pdf_url;

      if (pdfUrlFromResp) {
        openPdfUrl(pdfUrlFromResp);
      } else {
        toast.error(t("pdfLinkNotFound"));
      }
    } catch (error) {
      toast.error(
        t("errorOpeningContractFile"),
      );
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setIsSubmitting(false);
    setPdfUrl("");
    setLoadingProgress(0);
    setCurrentStep(0);
    onOpenChange(false);
  };

  // ... (Other helper functions: copyAddressToField, handleCustomerTypeChange, etc.) ...
  const copyAddressToField = (
    targetField: "student_address" | "buyurtmachi_address",
  ) => {
    if (primaryAddress) {
      setValue(targetField, primaryAddress);
      toast.success(t("addressCopied"));
    } else {
      toast.error(t("enterAddressFirst"));
    }
  };

  const handleCustomerTypeChange = (type: "father" | "mother" | "other") => {
    setCustomerType(type);
    if (type === "father") {
      if (dadName) setValue("buyurtmachi_fio", dadName);
      if (dadPhone) setValue("buyurtmachi_phone", dadPhone);
      toast.success(
        t("fatherInfoCopied"),
      );
    } else if (type === "mother") {
      if (momFio) setValue("buyurtmachi_fio", momFio);
      if (momPhone) setValue("buyurtmachi_phone", momPhone);
      toast.success(
        t("motherInfoCopied"),
      );
    } else {
      setValue("buyurtmachi_fio", "");
      setValue("buyurtmachi_phone", "");
    }
  };

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      const currentYear = new Date().getFullYear();
      const endOfYear = `${currentYear}-12-31`;

      reset({
        first_name: "",
        last_name: "",
        date_of_birth: "",
        phone: "",
        address: "",
        status: "active",
        group_id: "",
        contract_number: "",
        student_fio: "",
        birth_year: "",
        student_address: "",
        dad_name: "",
        dad_phone: "",
        dad_occupation: "",
        mom_fio: "",
        mom_phone: "",
        mom_occupation: "",
        contract_start_date: today,
        contract_end_date: endOfYear,
        buyurtmachi_fio: "",
        buyurtmachi_passport_series_number: "",
        buyurtmachi_who_give: "",
        buyurtmachi_when_give: "",
        buyurtmachi_address: "",
        buyurtmachi_phone: "",
        tarbiyalanuvchi_birth_series_number: "",
        tarbiyalanuvchi_birth_year: "",
        tarbiyalanuvchi_who_give: "",
        tarbiyalanuvchi_when_give: "",
        tolov_monthly_fee: "800000",
        tolov_amount_in_words: "саккиз юз минг",
      });
    }
  }, [open, reset]);

  const formatPrice = (price: number | string) => {
    if (!price) return "0";
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const simulateProgress = async (
    stepIndex: number,
    duration: number = 1000,
  ) => {
    setCurrentStep(stepIndex);
    const startProgress = stepIndex * 25;
    const endProgress = (stepIndex + 1) * 25;
    const steps = 20;
    const increment = (endProgress - startProgress) / steps;
    for (let i = 0; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, duration / steps));
      setLoadingProgress(Math.min(startProgress + increment * i, endProgress));
    }
  };

  const onSubmit = async (data: StudentFormData) => {
    try {
      setIsSubmitting(true);
      setLoadingProgress(0);
      setCurrentStep(0);

      if (!data.contract_start_date) {
        toast.error(t("startDateRequired"));
        setIsSubmitting(false);
        return;
      }

      // The birth year — not the group — caps enrolment. Stop here so a full
      // year never reaches the upload step and leaves orphan files behind.
      if (isYearFull) {
        toast.error(
          t("yearLimitReachedShort").replace(
            "{{year}}",
            String(selectedGroupBirthYear ?? ""),
          ),
        );
        setIsSubmitting(false);
        return;
      }

      await simulateProgress(0, 800);

      const startDateObj = new Date(data.contract_start_date);
      const startDay = startDateObj.getDate().toString().padStart(2, "0");
      const startMonthIndex = startDateObj.getMonth();
      const startMonthName = MONTH_NAMES[startMonthIndex];
      const startYear = startDateObj.getFullYear().toString();

      const student_data = {
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        phone: data.phone,
        address: data.address || "",
        status: data.status,
        group_id: data.group_id ? Number(data.group_id) : null,
      };

      const contract_data = {
        contract_number: data.contract_number,
        student: {
          student_image: data.contract_image_1?.[0]?.name || "photo.jpg",
          student_fio: data.student_fio,
          birth_year: data.birth_year,
          student_address: data.student_address,
          dad_occupation: data.dad_occupation || "",
          mom_occupation: data.mom_occupation || "",
          dad_phone_number: data.dad_phone || "",
          mom_phone_number: data.mom_phone || "",
          dad_fullname: data.dad_name || "",
          mom_fullname: data.mom_fio || "",
        },
        sana: { kun: startDay, oy: startMonthName, yil: startYear },
        buyurtmachi: {
          fio: data.buyurtmachi_fio,
          pasport_seriya: data.buyurtmachi_passport_series_number,
          pasport_kim_bergan: data.buyurtmachi_who_give,
          pasport_qachon_bergan: data.buyurtmachi_when_give,
          manzil: data.buyurtmachi_address,
          telefon: data.buyurtmachi_phone,
        },
        tarbiyalanuvchi: {
          fio: data.student_fio,
          tugilganlik_guvohnoma: data.tarbiyalanuvchi_birth_series_number,
          tugilganlik_yil:
            parseInt(data.tarbiyalanuvchi_birth_year) ||
            parseInt(data.birth_year) ||
            0,
          guvohnoma_kim_bergan: data.tarbiyalanuvchi_who_give || "",
          guvohnoma_qachon_bergan: data.tarbiyalanuvchi_when_give || "",
        },
        shartnoma_muddati: {
          boshlanish: data.contract_start_date,
          tugash: data.contract_end_date,
          yil: startYear,
        },
        tolov: {
          oylik_narx: formatPrice(data.tolov_monthly_fee),
          oylik_narx_sozlar: data.tolov_amount_in_words || "",
        },
      };

      const formData = new FormData();
      formData.append("student_data", JSON.stringify(student_data));
      formData.append("contract_data", JSON.stringify(contract_data));

      const requiredFileFields: (keyof StudentFormData)[] = [
        "passport_copy",
        "form_086",
        "heart_checkup",
        "birth_certificate",
        "contract_image_2",
        "contract_image_4",
      ];
      const optionalFileFields: (keyof StudentFormData)[] = [
        "contract_image_1",
        "contract_image_3",
        "contract_image_5",
      ];

      let filesMissing = false;
      for (const field of requiredFileFields) {
        if (data[field]?.[0]) {
          formData.append(field, data[field][0]);
        } else {
          filesMissing = true;
          toast.error(`${field}: ${t("fileNotUploaded")}`);
        }
      }
      for (const field of optionalFileFields) {
        if (data[field]?.[0]) {
          formData.append(field, data[field][0]);
        }
      }
      if (filesMissing) {
        setIsSubmitting(false);
        return;
      }

      await simulateProgress(1, 1000);
      await simulateProgress(2, 500);

      // API so'rovi
      const response = await studentService.createStudentWithContract(formData);

      await simulateProgress(3, 800);

      if (!response) {
        toast.error(t("pdfNotFound"));
        setIsSubmitting(false);
        return;
      }

      // --- PDF URL ni to'g'ri olish ---
      if (
        typeof response === "object" &&
        "pdf_url" in response &&
        response.pdf_url
      ) {
        // Agar backend { pdf_url: "..." } qaytarsa
        setPdfUrl(response.pdf_url as string);
        setIsSuccess(true);
      } else {
        // Agar backend BLOB (fayl) qaytarsa
        try {
          const blob =
            response instanceof Blob
              ? response
              : new Blob([response], { type: "application/pdf" });
          const fileURL = window.URL.createObjectURL(blob);
          setPdfUrl(fileURL);
          setIsSuccess(true);
        } catch (e) {
          console.error("[DEBUG] Error creating blob URL", e);
          toast.error(t("pdfNotFound"));
          setIsSubmitting(false);
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      // One more active contract in this birth year — refresh the counters.
      invalidateYearLimits(queryClient);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Xatolik:", error);
      let errorMessage = t("anErrorOccurred");
      // Xatoliklarni ushlash va qayta urinish logikasi (Sizning kodingizdan saqlandi)
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          if (json.detail)
            errorMessage =
              typeof json.detail === "string"
                ? json.detail
                : JSON.stringify(json.detail);
        } catch (e) {
          /* ignore */
        }
      } else if (error.response?.data?.detail) {
        errorMessage =
          typeof error.response.data.detail === "string"
            ? error.response.data.detail
            : JSON.stringify(error.response.data.detail);
      }

      // 409 from the birth-year limit (the year filled up between the banner
      // loading and submit): re-read the counters so the banner and the submit
      // button catch up with the server. The message itself is shown below.
      if (error.response?.status === 409) {
        invalidateYearLimits(queryClient);
      }

      const isDuplicateContract =
        errorMessage.toLowerCase().includes("already exists") ||
        errorMessage.toLowerCase().includes("mavjud") ||
        errorMessage.toLowerCase().includes("duplicate");

      if (isDuplicateContract && data.group_id) {
        try {
          toast(
            t("retryingWithNewNumber"),
          );
          const year =
            data.birth_year && data.birth_year.toString().length === 4
              ? Number(data.birth_year)
              : new Date().getFullYear();
          const response = await contractService.getNextAvailableNumber(
            Number(data.group_id),
            year,
          );

          if (response.data.contract_number) {
            const newContractNumber = response.data.contract_number;
            setValue("contract_number", newContractNumber);
            toast.success(`${t("newNumberSuggested")}: ${newContractNumber}`);
            toast(
              t("pleaseSubmitAgain"),
            );
          } else {
            toast.error(errorMessage);
          }
        } catch (retryError) {
          toast.error(errorMessage);
        }
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlayClick={false}
    >
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto border-2 border-primary/20 pb-10 pl-10">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            {t("createStudentAndContract")}
          </DialogTitle>
          <DialogDescription>
            {t("fillAllFieldsDocsRequired")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* FORM QISMI O'ZGARISHSIZ QOLDI */}
          {/* ... Inputlar va Fayl yuklash qismlari sizdagi koddagi kabi ... */}

          {/* TIZIM MA'LUMOTLARI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
              <h3 className="font-bold text-blue-800 dark:text-blue-200 text-lg border-b border-blue-200 pb-2 mb-4">
                1. {t("systemStudentInfo")}
              </h3>
              {/* ... System inputs ... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{t("lastName")} *</Label>
                  <Input
                    {...register("last_name", { required: true })}
                    placeholder={t("lastName")}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("firstName")} *</Label>
                  <Input
                    {...register("first_name", { required: true })}
                    placeholder={t("firstName")}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("middleName")}</Label>
                  <Input
                    {...register("middle_name")}
                    placeholder={t("middleName")}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("dateOfBirth")} *</Label>
                  <Input
                    type="date"
                    {...register("date_of_birth", { required: true })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("phoneNumber")} *</Label>
                  <Input
                    {...register("phone", {
                      required: true,
                      onChange: (e) => {
                        if (!e.target.value.startsWith("+998"))
                          e.target.value =
                            "+998" + e.target.value.replace(/^\+998/, "");
                      },
                    })}
                    placeholder="+998901234567"
                    defaultValue="+998"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <Label>{t("address")}</Label>
                  <Input {...register("address")} placeholder={t("address")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("group")} *</Label>
                  <Select
                    {...register("group_id", { required: true })}
                    className="h-10"
                  >
                    <option value="">{t("selectGroupPlaceholder")}</option>
                    {[...(groupsData?.data || [])]
                      .sort((a: GroupRead, b: GroupRead) => {
                        const ya = Number((a as any).birth_year) || 0;
                        const yb = Number((b as any).birth_year) || 0;
                        return yb - ya;
                      })
                      .map((group: GroupRead) => (
                        <option key={group.id} value={String(group.id)}>
                          {formatGroupSelectLabel(group)}
                        </option>
                      ))}
                  </Select>
                  {/* Places left in the group's birth year — this, not the
                      group's capacity, is what can block the enrolment. */}
                  <YearLimitNotice birthYear={selectedGroupBirthYear} />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200">
              <h3 className="font-bold text-purple-800 dark:text-purple-200 text-lg border-b border-purple-200 pb-2 mb-4">
                {t("traineeDocuments")}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t("certificateSeries")}</Label>
                    <Input
                      {...register("tarbiyalanuvchi_birth_series_number")}
                      placeholder="I-AA 1234567"
                    />
                  </div>
                  <div>
                    <Label>{t("birthYear")}</Label>
                    <Input
                      {...register("tarbiyalanuvchi_birth_year")}
                      placeholder="2012"
                      onFocus={() => {
                        if (birthYear && !watch("tarbiyalanuvchi_birth_year"))
                          setValue("tarbiyalanuvchi_birth_year", birthYear);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("issuedDate")}</Label>
                  <Input
                    type="date"
                    {...register("tarbiyalanuvchi_when_give")}
                  />
                </div>
                <div>
                  <Label>{t("issuedBy")}</Label>
                  <Input
                    {...register("tarbiyalanuvchi_who_give")}
                      placeholder={t("issuedByPlaceholder")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
            <h3 className="font-bold text-green-800 dark:text-green-200 text-lg border-b border-green-200 pb-2 mb-4">
              2. {t("contractInfoForPDF")}
            </h3>
            {/* ... Contract inputs ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-1 md:col-span-2 space-y-1">
                <Label className="text-green-700 font-semibold">
                  {t("contractNumber")} *
                </Label>
                {/* Contract number is a frozen, never-reused serial. It is
                    assigned automatically from the group — there is no choice
                    to make, so the field is read-only. */}
                <Input
                  {...register("contract_number", { required: true })}
                  readOnly
                  aria-readonly="true"
                  tabIndex={-1}
                  placeholder={
                    selectedGroupId ? "" : t("selectGroup")
                  }
                  className="border-green-300 bg-muted/50 cursor-not-allowed font-mono focus:border-green-300 focus-visible:ring-0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("contractNumberFrozenHint")}
                </p>
              </div>
              <div className="space-y-1">
                <Label>{t("studentFullName")} *</Label>
                <Input
                  {...register("student_fio", { required: true })}
                  placeholder={t("studentFullNamePlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("birthYear")} *</Label>
                <Input
                  {...register("birth_year", { required: true })}
                  placeholder="2015"
                />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label>{t("studentAddress")} *</Label>
                  {primaryAddress && (
                    <button
                      type="button"
                      onClick={() => copyAddressToField("student_address")}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {t("copyAddressFromAbove")}
                    </button>
                  )}
                </div>
                <Input
                  {...register("student_address", { required: true })}
                  placeholder={t("addressPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("startDate")} *</Label>
                <Input
                  type="date"
                  {...register("contract_start_date", { required: true })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("endDate")} *</Label>
                <Input
                  type="date"
                  {...register("contract_end_date", { required: true })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("monthlyFee")} (UZS) *</Label>
                <Input
                  type="number"
                  {...register("tolov_monthly_fee", { required: true })}
                  placeholder="800 000"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("amountInWords")} *</Label>
                <Input
                  {...register("tolov_amount_in_words", { required: true })}
                  placeholder={t("amountInWordsPlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-green-200 pt-6">
              {/* Ota/Ona ma'lumotlari */}
              <div className="space-y-4 p-4 bg-white/60 dark:bg-black/20 rounded-lg border border-green-100 shadow-sm">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> {t("fatherInfo")}
                </h4>
                <div className="space-y-2">
                  <Label>{t("fullName")}</Label>
                  <Input {...register("dad_name")} placeholder={t("fullNamePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("occupation")}</Label>
                  <Input
                    {...register("dad_occupation")}
                    placeholder={t("occupationPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("phoneNumber")}</Label>
                  <Input
                    {...register("dad_phone", {
                      onChange: (e) => {
                        if (!e.target.value.startsWith("+998"))
                          e.target.value =
                            "+998" + e.target.value.replace(/^\+998/, "");
                      },
                    })}
                    defaultValue="+998"
                  />
                </div>
              </div>
              <div className="space-y-4 p-4 bg-white/60 dark:bg-black/20 rounded-lg border border-green-100 shadow-sm">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> {t("motherInfo")}
                </h4>
                <div className="space-y-2">
                  <Label>{t("fullName")}</Label>
                  <Input {...register("mom_fio")} placeholder={t("fullNamePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("occupation")}</Label>
                  <Input
                    {...register("mom_occupation")}
                    placeholder={t("occupationPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("phoneNumber")}</Label>
                  <Input
                    {...register("mom_phone", {
                      onChange: (e) => {
                        if (!e.target.value.startsWith("+998"))
                          e.target.value =
                            "+998" + e.target.value.replace(/^\+998/, "");
                      },
                    })}
                    defaultValue="+998"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-green-200 pt-6 mt-4">
              <div className="space-y-3">
                <h4 className="font-semibold mb-2 text-green-800">
                  {t("customer")}
                </h4>
                <div className="space-y-2">
                  <div>
                    <Label>{t("customerType")} *</Label>
                    <Select
                      value={customerType}
                      onChange={(e) =>
                        handleCustomerTypeChange(e.target.value as any)
                      }
                      className="h-10"
                    >
                      <option value="father">{t("father")}</option>
                      <option value="mother">{t("mother")}</option>
                      <option value="other">{t("other")}</option>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("fullName")} *</Label>
                    <Input
                      {...register("buyurtmachi_fio", { required: true })}
                      readOnly={customerType !== "other"}
                      className={customerType !== "other" ? "bg-muted" : ""}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t("passportSeries")} *</Label>
                      <Input
                        {...register("buyurtmachi_passport_series_number", {
                          required: true,
                        })}
                        placeholder="AA1234567"
                      />
                    </div>
                    <div>
                      <Label>{t("phoneNumber")} *</Label>
                      <Input
                        {...register("buyurtmachi_phone", { required: true })}
                        readOnly={customerType !== "other"}
                        className={
                          customerType !== "other" ? "bg-muted" : ""
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>{t("address")}</Label>
                      {primaryAddress && (
                        <button
                          type="button"
                          onClick={() => copyAddressToField("buyurtmachi_address")}
                          className="text-xs text-blue-600 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          {t("copy")}
                        </button>
                      )}
                    </div>
                    <Input
                      {...register("buyurtmachi_address")}
                      placeholder={t("addressPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("issuedDate")}</Label>
                    <Input type="date" {...register("buyurtmachi_when_give")} />
                  </div>
                  <div>
                    <Label>{t("issuedBy")}</Label>
                    <Input
                      {...register("buyurtmachi_who_give")}
                      placeholder={t("issuedByPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200">
            <h3 className="font-bold text-orange-800 dark:text-orange-200 text-lg border-b border-orange-200 pb-2 mb-4">
              3. {t("documents")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>{t("profilePhoto")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("passport_copy")}
                />
              </div>
              <div>
                <Label>{t("form086")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("form_086")}
                />
              </div>
              <div>
                <Label>{t("contractPhoto")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("contract_image_2")}
                />
              </div>
              <div>
                <Label>{t("birthCertificate")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("birth_certificate")}
                />
              </div>
              <div>
                <Label>{t("heartCheckup")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("heart_checkup")}
                />
              </div>
              <div>
                <Label>{t("passportCopy")} *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  {...register("contract_image_4")}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t sticky bottom-0 bg-white dark:bg-slate-900 p-4 shadow-lg border-t-gray-200">
            {isYearFull && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t("yearLimitReachedShort").replace(
                  "{{year}}",
                  String(selectedGroupBirthYear ?? ""),
                )}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isYearFull}
                className="w-40"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {t("create")}
              </Button>
            </div>
          </div>
        </form>

        {/* Loading Overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {t("creatingContract")}
                </h3>
                <span className="text-2xl font-bold text-primary">
                  {Math.round(loadingProgress)}%
                </span>
              </div>
              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-8">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 transition-all duration-300 ${
                      index === currentStep
                        ? "scale-105"
                        : index < currentStep
                          ? "opacity-60"
                          : "opacity-30"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index < currentStep
                          ? "bg-green-500 text-white"
                          : index === currentStep
                            ? "bg-primary text-white animate-pulse"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                      }`}
                    >
                      {index < currentStep ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : index === currentStep ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <span className="text-sm font-semibold">
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium transition-colors ${
                        index === currentStep
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("pleaseWaitDoNotClose")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Overlay - TUGMALAR TUZATILDI */}
        {isSuccess && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-3">
                {t("contractCreatedSuccess")}
              </h3>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                {t("successfullySaved")}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    type="button"
                    onClick={viewContractByNumber}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Eye className="w-5 h-5" />
                    {t("view")}
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={handleClose}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {t("close")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
