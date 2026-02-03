"use client";

import React, { useEffect, useRef, useState } from "react";
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
  lockScroll?: boolean;
  disableAnimation?: boolean;
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
  lockScroll = true,
  disableAnimation = false,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [animationState, setAnimationState] = useState<"open" | "closed">(
    isOpen ? "open" : "closed"
  );

  useScrollLock(lockScroll && isOpen);

  useEffect(() => {
    if (disableAnimation) {
      setIsRendered(isOpen);
      setAnimationState(isOpen ? "open" : "closed");
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => setAnimationState("open"));
    } else {
      setAnimationState("closed");
      timeout = setTimeout(() => setIsRendered(false), 150);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [disableAnimation, isOpen]);

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

  if (!isRendered) return null;

  return typeof window === "undefined"
    ? null
    : createPortal(
        <div
          className={cn(
            "fixed inset-0 z-[60] flex min-h-screen bg-transparent pointer-events-none",
            positionClasses[position],
            overlayClassName
          )}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          data-state={animationState}
        >
          <div
            ref={drawerRef}
            className={cn(
              "bg-background-paper border-border-default relative h-full w-full overflow-y-auto border shadow-xl pointer-events-auto",
              !disableAnimation &&
                "will-change-transform data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=left]:slide-in-from-right-2 data-[side=left]:slide-out-to-right-2 data-[side=right]:slide-in-from-left-2 data-[side=right]:slide-out-to-left-2 duration-150",
              sizeClasses[size],
              className
            )}
            data-state={animationState}
            data-side={position === "right" ? "left" : "right"}
          >
            {showCloseButton && (
              <button
                className="bg-background-level1 text-text-secondary hover:bg-background-level2 hover:text-text-primary absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
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
