"use client";
import { createContext, useContext, ReactNode } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ConfirmContextType {
  confirm: (opts: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: "danger" | "default" }) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { isOpen, options, confirm, handleConfirm, handleCancel } = useConfirm();

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmDialog
          open={isOpen}
          onOpenChange={handleCancel}
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
          onConfirm={handleConfirm}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirmContext() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirmContext must be used within ConfirmProvider");
  return context;
}