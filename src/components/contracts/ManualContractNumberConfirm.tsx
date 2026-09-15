import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/languageStore";

interface ManualContractNumberConfirmProps {
  open: boolean;
  /** The automatically assigned number, shown in the warning. */
  contractNumber: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before an automatically assigned contract number becomes editable.
 * Families pay (Payme, Click) against this exact number, so it must not be
 * changed by accident.
 *
 * Portalled to <body> so it sits centred above any dialog it is opened from,
 * and Escape closes only this confirmation, never the dialog underneath.
 */
export function ManualContractNumberConfirm({
  open,
  contractNumber,
  onCancel,
  onConfirm,
}: ManualContractNumberConfirmProps) {
  const { t } = useLanguageStore();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="manual-contract-number-confirm-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-2">
            <h3
              id="manual-contract-number-confirm-title"
              className="text-lg font-semibold text-foreground"
            >
              {t("manualContractNumberTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("manualContractNumberBody").replace(
                "{{number}}",
                contractNumber || "—",
              )}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {t("editContractNumberManually")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
