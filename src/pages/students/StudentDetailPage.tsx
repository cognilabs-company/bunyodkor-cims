/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  studentService,
  contractService,
  transactionService,
} from "@/services/api.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// dialog UI removed for Replace Contract PDF — kept programmatic mutation
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Home,
  Calendar,
  Clock,
  Phone,
  FileText,
  User,
  Users,
  Trash2,
  AlertTriangle,
  Download,
  Eye,
  Pencil,
  UploadCloud,
  File as FileIcon,
  X,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { openPdfResponse, openPdfUrl } from "@/lib/open-pdf";
import { usePermissions } from "@/hooks/usePermissions";
import { invalidateYearLimits } from "@/hooks/useYearLimit";
import { ArrowRightLeft } from "lucide-react";
import { TransferStudentDialog } from "@/components/students/TransferStudentDialog";
import { useLanguageStore } from "@/store/languageStore";
import { formatFullName, formatNameParts } from "@/lib/name-utils";
import { Select } from "@/components/ui/select";
import {
  TERMINATION_INITIATORS,
  parseTerminationInitiator,
  terminationInitiatorKey,
  type TerminationInitiator,
} from "@/lib/termination";
import type {
  StudentFullInfo,
  TransactionRead,
  ContractRead,
  AttendanceRead,
  ParentRead,
} from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloneContractDialog } from "@/components/timetable/CloneContractDialog";

const getStatusBadge = (status: string) => {
  const styles: { [key: string]: string } = {
    active:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    archived:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    deleted:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    present:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    graduated:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    dropped: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    absent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    cancelled:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    suspended:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    late: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <Badge
      className={`${styles[status] || "bg-gray-100 text-gray-700"} border-0`}
    >
      {status}
    </Badge>
  );
};

export default function StudentDetailPage() {
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isReadOnly, canWrite } = usePermissions();

  const { id } = useParams<{ id: string }>();
  const studentId = parseInt(id || "0", 10);
  const [isHardDeleteDialogOpen, setIsHardDeleteDialogOpen] = useState(false);
  const [contractToUpdate, setContractToUpdate] = useState<ContractRead | null>(
    null,
  );
  const [isEditContractDialogOpen, setIsEditContractDialogOpen] =
    useState(false);
  const [isEditFeeDialogOpen, setIsEditFeeDialogOpen] = useState(false);
  const [monthlyFeeValue, setMonthlyFeeValue] = useState<number | string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(
    null,
  );
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transactionToDelete, setTransactionToDelete] =
    useState<TransactionRead | null>(null);
  const [isDeleteTransactionDialogOpen, setIsDeleteTransactionDialogOpen] =
    useState(false);
  const [isTerminateDialogOpen, setIsTerminateDialogOpen] = useState(false);
  const [terminationInitiator, setTerminationInitiator] = useState<
    TerminationInitiator | ""
  >("");
  const [terminatedAt, setTerminatedAt] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [terminatedContractId, setTerminatedContractId] = useState<number | null>(
    null,
  );

  const formatSource = (source: string | null | undefined) => {
    const cleanSource =
      source?.toString().replace(/^.*\./, "").toLowerCase() || "";
    const sourceMap: Record<string, string> = {
      bank: t("bank"),
      payme: t("payme"),
      click: t("click"),
      manual: t("manual"),
    };
    return sourceMap[cleanSource] || cleanSource;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-full-info", studentId],
    queryFn: () => studentService.getStudentFullInfo(studentId),
    enabled: !!studentId,
  });

  const hardDeleteMutation = useMutation({
    mutationFn: () => studentService.hardDeleteStudent(studentId),
    onSuccess: () => {
      // 1. Ro'yxatlarni yangilaymiz (List sahifalar uchun)
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });

      // ⚠️ MUHIM: Quyidagi qatorni O'CHIRIB TASHLANG yoki Commentga oling:
      // queryClient.invalidateQueries({ queryKey: ["student-full-info"] });
      // Sababi: Student o'chdi, uning infosini qayta so'rash xato (404) beradi.

      // 2. Cache dan bu studentni qo'lda o'chiramiz (Xatolik chiqmasligi uchun)
      queryClient.removeQueries({ queryKey: ["student-full-info", studentId] });

      toast.success(
        t("studentPermanentlyDeleted") || "Talaba butunlay o'chirildi",
      );
      setIsHardDeleteDialogOpen(false);

      // 3. Sahifadan chiqib ketamiz
      navigate("/students", { replace: true });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage =
        t("failedToDeleteStudent") || "Talabani o'chirishda xato";

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }

      toast.error(errorMessage);
    },
  });

  const updatePdfMutation = useMutation({
    mutationFn: ({
      contractId,
      formData,
    }: {
      contractId: number;
      formData: FormData;
    }) => contractService.updateContractPdf(contractId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("pdfReplacedSuccess") || "Shartnoma PDF yangilandi");
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = t("anErrorOccurred") || "An error occurred";
      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }
      toast.error(errorMessage);
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId: number) =>
      transactionService.deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("transactionDeleted") || "Transaction deleted");
      setIsDeleteTransactionDialogOpen(false);
      setTransactionToDelete(null);
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage =
        t("failedToDeleteTransaction") || "Failed to delete transaction";

      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }

      toast.error(errorMessage);
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: ({ contractId, data }: { contractId: number; data: any }) =>
      contractService.updateContract(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("contractUpdatedSuccess") || "Contract updated");
      setIsEditContractDialogOpen(false);
      setContractToUpdate(null);
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = t("anErrorOccurred") || "An error occurred";
      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }
      toast.error(errorMessage);
    },
  });

  const terminateContractMutation = useMutation({
    mutationFn: ({
      contractId,
      termination_reason,
      terminated_at,
    }: {
      contractId: number;
      termination_reason: string;
      terminated_at: string;
    }) =>
      contractService.terminateContract(contractId, {
        termination_reason,
        terminated_at: new Date(terminated_at).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      // One fewer active contract — a place opens up in that birth year.
      invalidateYearLimits(queryClient);
      toast.success(t("contractUpdatedSuccess") || "Contract terminated");
      setIsTerminateDialogOpen(false);
      setTerminationInitiator("");
      setTerminatedAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = t("anErrorOccurred") || "An error occurred";
      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }
      toast.error(errorMessage);
    },
  });

  const updateMonthlyFeeMutation = useMutation({
    mutationFn: ({
      contractId,
      monthly_fee,
    }: {
      contractId: number;
      monthly_fee: number;
    }) => contractService.updateContractMonthlyFee(contractId, { monthly_fee }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-full-info", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(t("contractUpdatedSuccess") || "Monthly fee updated");
      setMonthlyFeeValue("");
      setContractToUpdate(null);
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let errorMessage = t("anErrorOccurred") || "An error occurred";
      if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail[0].msg || detail[0].message || errorMessage;
      } else if (typeof detail === "string") {
        errorMessage = detail;
      }
      toast.error(errorMessage);
    },
  });

  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files[0].type !== "application/pdf") {
        toast.error("Iltimos, faqat PDF fayl tanlang.");
        return;
      }
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].type !== "application/pdf") {
        toast.error("Iltimos, faqat PDF fayl tanlang.");
        return;
      }
      setSelectedFile(e.target.files[0]);
    }
  };

  const closeReplaceDialog = () => {
    setIsReplaceDialogOpen(false);
    setSelectedFile(null);
  };

  const handleUpload = () => {
    if (selectedFile && selectedContractId) {
      const formData = new FormData();
      formData.append("final_pdf", selectedFile);
      updatePdfMutation.mutate(
        { contractId: selectedContractId, formData },
        {
          onSuccess: () => {
            closeReplaceDialog();
          },
        },
      );
    }
  };

  const handleDownloadPdf = async (contract: ContractRead) => {
    // Same logic but for download
    try {
      let pdfUrl: string | null = null;

      if (contract.final_pdf_url) {
        pdfUrl = contract.final_pdf_url;
      } else {
        const year = new Date(contract.start_date).getFullYear();
        const response = await contractService.getContractPdfUrl(
          year,
          contract.contract_number,
        );

        if (typeof response === "string") {
          pdfUrl = response;
        } else if (
          typeof response === "object" &&
          response !== null &&
          "pdf_url" in response
        ) {
          pdfUrl = (response as any).pdf_url;
        }
      }

      if (!pdfUrl) {
        toast.error(t("pdfNotFound") || "PDF topilmadi");
        return;
      }

      // Download the PDF
      const resp = await fetch(pdfUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contract.contract_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t("downloadedSuccessfully"));
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(t("errorDownloadingFile"));
    }
  };

  const handleViewContract = async (contractId: number) => {
    const toastId = toast.loading(
      t("loadingContractFile") || "Shartnoma yuklanmoqda...",
    );
    try {
      // API chaqiruvi
      const blob = await contractService.viewContractPdf(contractId);
      toast.dismiss(toastId);

      if (blob) {
        openPdfResponse(blob);
      } else {
        toast.error(t("pdfLinkNotFound") || "PDF topilmadi");
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error("Error fetching contract PDF", error);
      toast.error(t("errorOpeningContractFile") || "Xatolik yuz berdi");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Clock className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-500">
          {t("loadingError")}
        </h2>
        <p className="text-muted-foreground">{t("studentNotFoundOrError")}</p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/students">{t("backToStudents")}</Link>
        </Button>
      </div>
    );
  }
  
  const {
    student,
    parents,
    contracts,
    group,
    coach,
    transactions,
    attendances,
  } = data.data as StudentFullInfo;

  const activeContract = contracts?.find((c) => c.status === "active") || null;
  const getDisplayParents = (): any[] => {
    console.log("[STUDENT DETAIL] Getting parent info");
    console.log("[STUDENT DETAIL] Parents from API:", parents);
    console.log("[STUDENT DETAIL] Contracts:", contracts);

    if (parents && parents.length > 0) {
      console.log("[STUDENT DETAIL] Using parents from API");
      return parents;
    }

    if (contracts && contracts.length > 0) {
      const sortedContracts = [...contracts].sort((a, b) => b.id - a.id);
      console.log("[STUDENT DETAIL] Sorted contracts:", sortedContracts);

      // Try to extract parent info from ALL contracts, collect all unique parents
      const allParents: any[] = [];

      for (const contract of sortedContracts) {
        console.log("[STUDENT DETAIL] Processing contract:", contract.id);
        
        let customFields: any = contract.custom_fields;

        if (!customFields) {
          console.log(
            "[STUDENT DETAIL] No custom_fields in contract",
            contract.id,
          );
          continue;
        }

        if (typeof customFields === "string") {
          try {
            customFields = JSON.parse(customFields);
            console.log("[STUDENT DETAIL] Parsed custom_fields:", customFields);
          } catch (e) {
            console.error("[STUDENT DETAIL] Custom fields parse error", e);
            continue;
          }
        } else {
          console.log("[STUDENT DETAIL] Custom fields (object):", customFields);
        }

        // Extract buyurtmachi
        if (
          customFields.buyurtmachi &&
          (customFields.buyurtmachi.fio || customFields.buyurtmachi.name)
        ) {
          const buyurtmachiName =
            customFields.buyurtmachi.fio || customFields.buyurtmachi.name;
          console.log("[STUDENT DETAIL] Found buyurtmachi:", buyurtmachiName);

          allParents.push({
            id: `contract-${contract.id}-buyurtmachi`,
            first_name: buyurtmachiName,
            last_name: "",
            relationship_type: "Buyurtmachi",
            phone:
              customFields.buyurtmachi.telefon ||
              customFields.buyurtmachi.phone ||
              "",
            email: "",
            is_from_contract: true,
          });
        }

        // Extract mom info
        const st = customFields.student || {};
        console.log("[STUDENT DETAIL] Student fields:", st);
        const momName =
          st.mom_fullname ||
          st.mom_fio ||
          st.mom_name ||
          customFields.mom_fio ||
          customFields.mom_fullname;
        const momPhone =
          st.mom_phone_number ||
          st.mom_phone ||
          customFields.mom_phone ||
          customFields.mom_phone_number ||
          "";
        console.log(
          "[STUDENT DETAIL] Checking mom - name:",
          momName,
          "phone:",
          momPhone,
        );
        if (momName) {
          console.log("[STUDENT DETAIL] Found mom:", momName, momPhone);
          allParents.push({
            id: `contract-${contract.id}-mom`,
            first_name: momName,
            last_name: "",
            relationship_type: "Ona",
            phone: momPhone,
            email: "",
            is_from_contract: true,
          });
        }

        // Extract dad info
        const dadName =
          st.dad_fullname ||
          st.dad_name ||
          st.dad_fio ||
          customFields.dad_name ||
          customFields.dad_fullname;
        const dadPhone =
          st.dad_phone_number ||
          st.dad_phone ||
          customFields.dad_phone ||
          customFields.dad_phone_number ||
          "";
        console.log(
          "[STUDENT DETAIL] Checking dad - name:",
          dadName,
          "phone:",
          dadPhone,
        );
        if (dadName) {
          console.log("[STUDENT DETAIL] Found dad:", dadName, dadPhone);
          allParents.push({
            id: `contract-${contract.id}-dad`,
            first_name: dadName,
            last_name: "",
            relationship_type: "Ota",
            phone: dadPhone,
            email: "",
            is_from_contract: true,
          });
        } else {
          console.log(
            "[STUDENT DETAIL] No dad name found in contract",
            contract.id,
          );
          console.log(
            "[STUDENT DETAIL] Checked fields - st.dad_fullname:",
            st.dad_fullname,
            "st.dad_name:",
            st.dad_name,
            "st.dad_fio:",
            st.dad_fio,
            "customFields.dad_name:",
            customFields.dad_name,
          );
        }
      }

      // Deduplicate by name and relationship_type
      const uniqueParents = allParents.filter(
        (parent, index, self) =>
          index ===
          self.findIndex(
            (p) =>
              p.first_name === parent.first_name &&
              p.relationship_type === parent.relationship_type,
          ),
      );

      console.log("[STUDENT DETAIL] All parents found:", allParents);
      console.log("[STUDENT DETAIL] Unique parents:", uniqueParents);

      if (uniqueParents.length > 0) {
        return uniqueParents;
      }
    }

    console.log("[STUDENT DETAIL] No parent info found");
    return [];
  };

  const displayParents = getDisplayParents();

  console.log("[STUDENT DETAIL] Display parents:", displayParents);

  // Separate parents and guardians
  // Parents: Ota and Ona
  const parentsList = displayParents.filter(
    (p) => p.relationship_type === "Ota" || p.relationship_type === "Ona",
  );

  // Guardians: Everyone else (Buyurtmachi, etc.)
  // BUT also show Buyurtmachi separately if they are ALSO listed as parent
  const guardiansList = displayParents.filter(
    (p) => p.relationship_type !== "Ota" && p.relationship_type !== "Ona",
  );

  console.log("[STUDENT DETAIL] Parents list:", parentsList);
  console.log("[STUDENT DETAIL] Guardians list:", guardiansList);

  // Who asked for the termination, read back from the contract terminated
  // last. A parent means the one who signed — the Buyurtmachi, or the father
  // when the contract names no separate customer.
  const terminatedContract =
    contracts
      ?.filter((c) => c.status !== "active" && c.terminated_at)
      .sort(
        (a, b) =>
          new Date(b.terminated_at!).getTime() -
          new Date(a.terminated_at!).getTime(),
      )[0] || null;

  const terminationInitiatorOf = parseTerminationInitiator(
    terminatedContract?.termination_reason,
  );

  const contractCustomer =
    displayParents.find((p) => p.relationship_type === "Buyurtmachi") ||
    displayParents.find((p) => p.relationship_type === "Ota") ||
    displayParents[0] ||
    null;

  const terminationInitiatorPerson =
    terminationInitiatorOf === "parent"
      ? {
          name: formatNameParts(
            contractCustomer?.last_name,
            contractCustomer?.first_name,
          ),
          role: contractCustomer?.relationship_type || "",
          phone: contractCustomer?.phone || "",
        }
      : terminationInitiatorOf === "coach"
        ? {
            name: formatFullName(coach?.full_name),
            role: t("coach"),
            phone: coach?.phone || "",
          }
        : null;

  return (
    <div className="space-y-6">
      <Link
        to="/students"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backToStudents")}
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
              {student.first_name?.[0]}
              {student.last_name?.[0]}
            </div>
            <div>
              <CardTitle className="text-2xl">
                {formatNameParts(student.last_name, student.first_name)}
              </CardTitle>
              <p className="text-muted-foreground">{student.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(student.status!)}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span>{student.phone}</span>
          </div>
          <div className="flex items-center gap-3">
            <Home className="w-5 h-5 text-muted-foreground" />
            <span>{student.address}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span>
              {t("birthDate")}:{" "}
              {format(new Date(student.date_of_birth!), "dd-MM-yyyy")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("totalPayments")}
              </p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("en-US").format(
                  transactions
                    ?.filter((t) => t.status?.toLowerCase() === "success")
                    .reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
                )}{" "}
                UZS
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions?.filter(
                  (t) => t.status?.toLowerCase() === "success",
                ).length || 0}{" "}
                {t("successfulPayments")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("contractNumber")}
              </p>
              <p className="text-2xl font-bold">
                {activeContract?.contract_number || "-"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {!isReadOnly && activeContract && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsTerminateDialogOpen(true)}
                  >
                    {t("cancelContractAction")}
                  </Button>
                )}
                {activeContract && canWrite("contracts:edit") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTransferDialogOpen(true)}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    {t("transferToAnotherGroup")}
                  </Button>
                )}
                {!isReadOnly &&
                  !activeContract &&
                  contracts?.some((c) => c.status === "terminated") && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const terminated = contracts.find(
                          (c) => c.status === "terminated",
                        );
                        if (terminated) {
                          setTerminatedContractId(terminated.id);
                          setIsCloneDialogOpen(true);
                        }
                      }}
                    >
                      {t("activate")}
                    </Button>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("attendancePercentage")}
              </p>
              <p className="text-2xl font-bold">
                {attendances && attendances.length > 0
                  ? Math.round(
                      (attendances.filter((a) => a.status === "present")
                        .length /
                        attendances.length) *
                        100,
                    )
                  : 0}
                %
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: INFORMATION */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("information")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{t("group")}</span>
                <span className="text-sm font-medium text-right">
                  {group?.name || t("notAssigned")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{t("coach")}</span>
                <span className="text-sm font-medium text-right">
                  {formatFullName(coach?.full_name) || t("notAssigned")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Face ID</span>
                <Badge variant="secondary" className="font-mono">
                  {student.face_id || t("notSet")}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-muted-foreground">{t("joinedDate")}</span>
                <span className="text-sm font-medium text-right">
                  {format(new Date(student.created_at!), "dd.MM.yyyy")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Who asked for the termination — only once a contract is terminated. */}
          {terminationInitiatorOf && (
            <Card className="border-red-200/70 dark:border-red-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-500">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {t("terminatedByCardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  variant="secondary"
                  className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                >
                  {t(terminationInitiatorKey(terminationInitiatorOf))}
                </Badge>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-bold">
                    {terminationInitiatorPerson?.name?.charAt(0) || (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">
                      {terminationInitiatorPerson?.name ||
                        t("terminationInitiatorUnknown")}
                    </span>
                    {terminationInitiatorPerson?.role && (
                      <span className="text-xs text-muted-foreground truncate">
                        {terminationInitiatorPerson.role}
                      </span>
                    )}
                  </div>
                </div>

                {terminationInitiatorPerson?.phone && (
                  <a
                    href={`tel:${terminationInitiatorPerson.phone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {terminationInitiatorPerson.phone}
                  </a>
                )}

                {terminatedContract && (
                  <div className="space-y-1 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <span>{t("contractNumber")}</span>
                      <span className="font-mono">
                        {terminatedContract.contract_number}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>{t("terminatedAt")}</span>
                      <span>
                        {format(
                          new Date(terminatedContract.terminated_at!),
                          "dd.MM.yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: PARENTS & GUARDIANS */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* PARENTS SECTION */}
          <Card>
            <CardHeader className="pb-4 border-b border-border/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" /> {t("parents")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {parentsList.length > 0 ? (
                <div className="grid gap-4">
                  {parentsList.map((parent: ParentRead | any, index) => (
                    <div
                      key={parent.id || index}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/40 hover:shadow-sm transition-all gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                          {parent.first_name?.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base leading-none">
                              {formatNameParts(parent.last_name, parent.first_name)}
                            </h4>
                            <Badge variant="secondary" className="px-2 py-0 text-xs font-medium rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                              {parent.relationship_type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                            {parent.email && <span>{parent.email}</span>}
                            {parent.is_from_contract && (
                              <span className="flex items-center gap-1 text-xs">
                                <FileText className="w-3.5 h-3.5" />
                                {t("fromContract")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {parent.phone ? (
                        <a
                          href={`tel:${parent.phone.replace(/\D/g, "")}`}
                          className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium font-mono">
                            {parent.phone}
                          </span>
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground px-4 py-2 border border-dashed rounded-lg">
                          {t("noPhone")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <div className="p-3 bg-muted rounded-full mb-3">
                    <Users className="w-6 h-6 opacity-40" />
                  </div>
                  <p className="text-sm">{t("noParentInfo")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* GUARDIANS SECTION */}
          <Card>
            <CardHeader className="pb-4 border-b border-border/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-amber-500" /> {t("guardian")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {guardiansList.length > 0 ? (
                <div className="grid gap-4">
                  {guardiansList.map((guardian: ParentRead | any, index) => (
                    <div
                      key={guardian.id || index}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10 hover:shadow-sm transition-all gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                          {guardian.first_name?.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base leading-none">
                              {formatNameParts(
                                guardian.last_name,
                                guardian.first_name,
                              )}
                            </h4>
                            <Badge variant="outline" className="px-2 py-0 text-xs font-medium rounded-md border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400">
                              {guardian.relationship_type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                            {guardian.email && <span>{guardian.email}</span>}
                            {guardian.is_from_contract && (
                              <span className="flex items-center gap-1 text-xs text-amber-600/70 dark:text-amber-400/70">
                                <FileText className="w-3.5 h-3.5" />
                                {t("fromContract")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {guardian.phone ? (
                        <a
                          href={`tel:${guardian.phone.replace(/\D/g, "")}`}
                          className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-colors shrink-0 border border-amber-200/50 dark:border-amber-800/50"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium font-mono">
                            {guardian.phone}
                          </span>
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground px-4 py-2 border border-dashed rounded-lg">
                          {t("noPhone")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <div className="p-3 bg-muted rounded-full mb-3">
                    <User className="w-6 h-6 opacity-40" />
                  </div>
                  <p className="text-sm">{t("noGuardianInfo")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("contracts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("contractNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("monthlyFee")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
                <TableHead className="text-right [&>div]:justify-end">
                  {t("contract")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts && contracts.length > 0 ? (
                contracts.map((c: ContractRead, index: number) => {
                  const startDate = new Date(c.start_date!);
                  const endDate = new Date(c.end_date!);
                  const monthsDiff = Math.round(
                    (endDate.getTime() - startDate.getTime()) /
                      (1000 * 60 * 60 * 24 * 30),
                  );
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {c.contract_number}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(c.status!)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {new Intl.NumberFormat("en-US").format(c.monthly_fee)}{" "}
                          UZS
                          {!isReadOnly && (
                            <Pencil
                              className="w-4 h-4 text-muted-foreground cursor-pointer"
                              onClick={() => {
                                setContractToUpdate(c);
                                setMonthlyFeeValue(c.monthly_fee ?? "");
                                setIsEditFeeDialogOpen(true);
                              }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {format(startDate, "dd.MM.yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            - {format(endDate, "dd.MM.yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {monthsDiff} {t("months")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewContract(c.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {t("viewContract")}
                          </Button>
                          {!isReadOnly && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedContractId(c.id);
                                setIsReplaceDialogOpen(true);
                              }}
                              disabled={updatePdfMutation.isPending}
                            >
                              <RefreshCw
                                className={`w-4 h-4 mr-2 ${updatePdfMutation.isPending ? "animate-spin" : ""}`}
                              />
                              {t("replaceContractPdf")}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPdf(c)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {t("downloadContract")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    {t("noContracts")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("yearMonth")}</TableHead>
                <TableHead>{t("sum")}</TableHead>
                <TableHead>{t("source")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("comment")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                transactions.map((transaction: TransactionRead, index: number) => {
                  const paidDate = new Date(transaction.paid_at!);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{index + 1}
                      </TableCell>
                      <TableCell>{format(paidDate, "dd.MM.yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {transaction.payment_year}-
                          {transaction.payment_months &&
                          transaction.payment_months.length > 0
                            ? transaction.payment_months
                                .map((m) => String(m).padStart(2, "0"))
                                .join(",")
                            : format(paidDate, "MM")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Intl.NumberFormat("en-US").format(
                          transaction.amount,
                        )}{" "}
                        UZS
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatSource(transaction.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status!)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.comment || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex w-full min-w-[180px] items-center justify-end gap-2">
                          {transaction.settlement_document_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openPdfUrl(transaction.settlement_document_url!)
                              }
                              className="h-8 min-w-[84px] justify-center gap-1 whitespace-nowrap"
                            >
                              <Eye className="w-4 h-4" />
                              {t("view")}
                            </Button>
                          ) : (
                            <div className="h-8 min-w-[84px]" aria-hidden="true" />
                          )}
                          {!isReadOnly && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 min-w-[84px] justify-center gap-1 whitespace-nowrap"
                              onClick={() => {
                                setTransactionToDelete(transaction);
                                setIsDeleteTransactionDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              {t("delete")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    {t("noPayments")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("attendanceHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("comment")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendances && attendances.length > 0 ? (
                attendances.map((a: AttendanceRead) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(new Date(a.created_at!), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status!)}</TableCell>
                    <TableCell>{a.comment}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    {t("noAttendanceData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Critical Actions Section */}
      {!isReadOnly && (
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-500">
            <AlertTriangle className="w-5 h-5" />
            {t("criticalAction")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("studentDeletionWarning_line1")}
            <br />
            <span className="font-semibold">
              {t("studentDeletionWarning_line2")}
            </span>
          </p>
          <Button
            variant="destructive"
            onClick={() => setIsHardDeleteDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("permanentlyDelete")}
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Hard Delete Confirmation Dialog */}
      <Dialog
        open={isHardDeleteDialogOpen}
        onOpenChange={setIsHardDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-md pb-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 dark:text-red-500">
              <AlertTriangle />
              {t("permanentDeleteWarning")}
            </DialogTitle>
            <DialogDescription className="pt-4 text-left">
              <p>
                {t("permanentDeleteStudent")}
                <span className="font-bold text-foreground">
                  {` ${formatNameParts(student.last_name, student.first_name)}`}
                </span>
                ?
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {t("studentDeletionWarning_line1")}
              </p>
              <p className="mt-2 font-semibold text-red-600 dark:text-red-500">
                {t("thisActionCannotBeUndone")}!
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsHardDeleteDialogOpen(false)}
              className="flex-1"
              disabled={hardDeleteMutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => hardDeleteMutation.mutate()}
              disabled={hardDeleteMutation.isPending}
              className="flex-1 gap-2"
            >
              {hardDeleteMutation.isPending ? (
                t("deleting")
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t("confirmPermanentDelete")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteTransactionDialogOpen}
        onOpenChange={setIsDeleteTransactionDialogOpen}
      >
        <DialogContent className="sm:max-w-md pb-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 dark:text-red-500">
              <AlertTriangle />
              {t("confirmDelete")}
            </DialogTitle>
            <DialogDescription className="pt-4 text-left">
              {t("areYouSureDeleteTransaction") ||
                "Are you sure you want to delete this transaction?"}
              {transactionToDelete ? (
                <span className="block mt-2 font-medium text-foreground">
                  #{transactionToDelete.id} -{" "}
                  {new Intl.NumberFormat("en-US").format(
                    transactionToDelete.amount,
                  )}{" "}
                  UZS
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteTransactionDialogOpen(false);
                setTransactionToDelete(null);
              }}
              className="flex-1"
              disabled={deleteTransactionMutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!transactionToDelete) return;
                deleteTransactionMutation.mutate(transactionToDelete.id);
              }}
              disabled={deleteTransactionMutation.isPending || !transactionToDelete}
              className="flex-1 gap-2"
            >
              {deleteTransactionMutation.isPending ? (
                t("deleting")
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t("delete")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminate Contract Dialog */}
      <Dialog open={isTerminateDialogOpen} onOpenChange={setIsTerminateDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[520px] p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
            <DialogHeader className="space-y-2 p-0">
              <DialogTitle className="flex items-start gap-2 text-base text-red-600 dark:text-red-500 sm:text-lg">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{t("cancelContractAction")}</span>
              </DialogTitle>
              <DialogDescription className="text-sm">
                {activeContract?.contract_number ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {activeContract.contract_number}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t("contractNumber")}
                    </span>
                  </span>
                ) : (
                  t("noContracts")
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-2">
              <label
                htmlFor="termination_initiator"
                className="flex items-center justify-between text-sm font-medium"
              >
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {t("terminationInitiator")}
                </span>
                <span className="text-xs text-red-500">*</span>
              </label>

              <Select
                id="termination_initiator"
                value={terminationInitiator}
                onChange={(e) =>
                  setTerminationInitiator(
                    e.target.value as TerminationInitiator | "",
                  )
                }
                className="h-11 rounded-xl px-4 text-base sm:text-sm"
              >
                <option value="">{t("selectTerminationInitiator")}</option>
                {TERMINATION_INITIATORS.map((initiator) => (
                  <option key={initiator} value={initiator}>
                    {t(terminationInitiatorKey(initiator))}
                  </option>
                ))}
              </Select>

              <p className="text-xs text-muted-foreground">
                {t("terminationInitiatorDescription")}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="terminated_at"
                className="flex items-center justify-between text-sm font-medium"
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t("terminatedAt")}
                </span>
                <span className="text-xs text-red-500">*</span>
              </label>

              <input
                id="terminated_at"
                type="datetime-local"
                value={terminatedAt}
                onChange={(e) => setTerminatedAt(e.target.value)}
                className="
                  h-11 w-full rounded-xl border border-border bg-background px-4
                  text-base text-foreground shadow-sm outline-none transition
                  [color-scheme:light] dark:[color-scheme:dark] sm:text-sm
                  focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40
                "
              />
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsTerminateDialogOpen(false)}
                disabled={terminateContractMutation.isPending}
              >
                {t("cancel")}
              </Button>

              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={terminateContractMutation.isPending || !activeContract}
                onClick={() => {
                  if (!activeContract) return;

                  if (!terminationInitiator) {
                    toast.error(t("selectTerminationInitiator"));
                    return;
                  }
                  if (!terminatedAt) {
                    toast.error(t("terminatedAt"));
                    return;
                  }

                  terminateContractMutation.mutate({
                    contractId: activeContract.id,
                    // The initiator travels in the reason field the backend
                    // already has — see lib/termination.
                    termination_reason: terminationInitiator,
                    terminated_at: terminatedAt,
                  });
                }}
              >
                {terminateContractMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {t("saving")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t("cancelContractAction")}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CloneContractDialog
        open={isCloneDialogOpen}
        onOpenChange={(open) => {
          setIsCloneDialogOpen(open);
          if (!open) {
            setTerminatedContractId(null);
          }
        }}
        terminatedContractId={terminatedContractId ?? 0}
      />

      <TransferStudentDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        studentId={studentId}
        currentGroupId={student.group_id ?? group?.id ?? null}
        currentGroupName={group?.name}
        contractNumber={activeContract?.contract_number}
      />

      {/* Edit Contract Dialog */}
      <Dialog
        open={isEditContractDialogOpen}
        onOpenChange={setIsEditContractDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("replaceContract") || t("editContract")}
            </DialogTitle>
          </DialogHeader>
          {contractToUpdate && (
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm">{t("monthlyFee")}</label>
                <input
                  type="number"
                  min={1}
                  value={String(contractToUpdate.monthly_fee ?? "")}
                  onChange={(e) =>
                    setContractToUpdate({
                      ...contractToUpdate,
                      monthly_fee: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded px-3 py-2 mt-1 bg-background text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!contractToUpdate) return;
                    const payload = {
                      start_date: contractToUpdate.start_date,
                      end_date: contractToUpdate.end_date,
                      monthly_fee: contractToUpdate.monthly_fee,
                      status: contractToUpdate.status,
                      custom_fields: contractToUpdate.custom_fields,
                    };
                    updateContractMutation.mutate({
                      contractId: contractToUpdate.id,
                      data: payload,
                    });
                  }}
                >
                  {t("save")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditContractDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Monthly Fee Dialog */}
      <Dialog open={isEditFeeDialogOpen} onOpenChange={setIsEditFeeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("editMonthlyFee") || "Oylik to'lovni tahrirlash"}
            </DialogTitle>
          </DialogHeader>
          {contractToUpdate && (
            <div className="p-6 space-y-4">
              <div className="flex-1">
                <label
                  htmlFor="monthly_fee_input"
                  className="text-sm font-medium"
                >
                  {t("monthlyFee")}
                </label>
                <input
                  id="monthly_fee_input"
                  type="number"
                  min={1}
                  value={String(monthlyFeeValue)}
                  onChange={(e) => setMonthlyFeeValue(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2 mt-1 bg-background text-foreground"
                  placeholder="e.g. 500000"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditFeeDialogOpen(false)}
                  disabled={updateMonthlyFeeMutation.isPending}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => {
                    const fee = Number(monthlyFeeValue);
                    if (isNaN(fee) || fee <= 0) {
                      toast.error(
                        t("amountMustBeGreaterThanZero") ||
                          "Summa 0 dan katta bo'lishi kerak",
                      );
                      return;
                    }
                    updateMonthlyFeeMutation.mutate(
                      {
                        contractId: contractToUpdate.id,
                        monthly_fee: fee,
                      },
                      {
                        onSuccess: () => {
                          setIsEditFeeDialogOpen(false);
                        },
                      },
                    );
                  }}
                  disabled={updateMonthlyFeeMutation.isPending}
                >
                  {updateMonthlyFeeMutation.isPending && (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {t("save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isReplaceDialogOpen} onOpenChange={closeReplaceDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("replaceContractPdf")}
            </DialogTitle>
            <DialogDescription>
              {t("replaceContractPdfDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/20 hover:border-primary/50"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={handleFileChange}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center text-center p-4">
                  <FileIcon className="w-12 h-12 text-primary" />
                  <p className="font-medium mt-2 break-all">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center text-muted-foreground">
                  <UploadCloud className="w-12 h-12 mb-2" />
                  <p className="font-bold">
                    {t("dragAndDropOrClick")}
                  </p>
                  <p className="text-sm">
                    {t("pdfOnlyUpTo10MB")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pb-6 pr-6">
            <Button
              variant="outline"
              onClick={closeReplaceDialog}
              disabled={updatePdfMutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || updatePdfMutation.isPending}
            >
              {updatePdfMutation.isPending && (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              )}
              {t("upload")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
