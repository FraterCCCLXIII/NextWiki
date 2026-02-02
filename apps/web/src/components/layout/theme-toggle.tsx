"use client";

import React, { useState } from "react";
import { Moon, Sun, MonitorSmartphone, Check } from "lucide-react";
import { Button } from "@repo/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui";
import { useTheme } from "~/providers/theme-provider";
import { cn } from "~/lib/utils";

const themeOptions = [
  {
    value: "light",
    label: "Light",
    description: "Light mode",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dark mode",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Follow system preference",
    icon: MonitorSmartphone,
  },
] as const;

export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="bg-background-paper w-[200px] rounded-lg border border-border-default p-2 shadow-lg"
      >
        <div className="space-y-1">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors text-text-primary",
                  "hover:bg-background-level1",
                  isActive && "bg-primary/10 dark:bg-primary/20"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-text-secondary">{option.description}</div>
                </div>
                {isActive && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ThemeToggle;
