"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils";
import { X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";

interface DrawerProps {
  isOpen: boolean;
  children: React.ReactNode;
  onClose: () => void;
  position?: "right" | "left";
  size?: "sm" | "md" | "lg";
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
  overlayClassName?: string;
}

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  children,
  onClose,
  position = "right",
  size = "md",
  closeOnEscape = true,
  showCloseButton = true,
  className,
  overlayClassName,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeOnEscape, onClose, isOpen]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  const positionClasses = {
    right: "justify-end",
    left: "justify-start",
  };

  if (!isOpen) return null;

  return typeof window === "undefined"
    ? null
    : createPortal(
        <div
          className={cn(
            "fixed inset-0 z-[60] flex min-h-screen bg-black/40 backdrop-blur-sm",
            positionClasses[position],
            overlayClassName
          )}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={drawerRef}
            className={cn(
              "bg-background-paper border-border-default relative h-full w-full overflow-y-auto border shadow-xl",
              sizeClasses[size],
              position === "right" ? "animate-slideInRight" : "animate-slideInLeft",
              className
            )}
          >
            {showCloseButton && (
              <button
                className="bg-background-level1 text-text-secondary hover:bg-background-level2 hover:text-text-primary absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
                onClick={onClose}
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {children}
          </div>
        </div>,
        document.body
      );
};

export { Drawer };
