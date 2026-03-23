"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className = "" }: ModalProps) {
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
      onClose={onClose}
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
