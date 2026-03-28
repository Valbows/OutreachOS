"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, onOpenChange, title, children, className = "" }: ModalProps) {
  const handleClose = () => {
    if (process.env.NODE_ENV === "development" && !onClose && !onOpenChange) {
      console.warn(
        "[Modal] Both onClose and onOpenChange are undefined. " +
          "The modal's open state may become desynchronized when closed natively (Escape key, backdrop click). " +
          "Provide at least one callback to handle close events."
      );
    }
    onClose?.();
    onOpenChange?.(false);
  };
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className={`backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-surface-container-high rounded-[var(--radius-modal)] shadow-ambient p-0 max-w-lg w-full text-on-surface ${className}`}
    >
      <div className="p-6">
        {title && (
          <h2 className="text-xl font-semibold mb-4 tracking-tight">{title}</h2>
        )}
        {children}
      </div>
    </dialog>
  );
}
