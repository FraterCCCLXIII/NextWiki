"use client";

import { ReactNode } from "react";
import type { Session } from "next-auth";
import { TRPCClientProvider } from "~/server/providers";
import { ThemeProvider } from "~/providers/theme-provider";
import { ModalProvider } from "@repo/ui";
import { PermissionProvider } from "~/components/auth/permission/client";
import { Toaster } from "sonner";
import { useTheme } from "~/providers/theme-provider";
import { AuthProvider } from "~/components/auth/AuthProvider";

interface ProvidersProps {
  children: ReactNode;
  session?: Session;
}

// Create an inner component to render the Toaster and use the theme hook
function ToasterWithTheme() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      closeButton
      expand
      visibleToasts={3}
      theme={theme}
      richColors
      toastOptions={{
        duration: 5000,
      }}
    />
  );
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider session={session}>
        <TRPCClientProvider>
          <PermissionProvider>
            <ModalProvider>
              {children}
              <ToasterWithTheme />
            </ModalProvider>
          </PermissionProvider>
        </TRPCClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
