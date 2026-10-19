"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md overflow-hidden rounded-b-none shadow-2xl sm:rounded-b-lg"
      >
        <div className="flex items-center justify-between border-b border-border bg-surface-muted px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:bg-border/60 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
