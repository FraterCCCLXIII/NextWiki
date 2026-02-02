"use client";

import { DiffResult, DiffLine } from "~/lib/services/revision-diff";
import { Card, CardContent, ScrollArea } from "@repo/ui";

interface UnifiedDiffProps {
  diff: DiffResult;
  title?: string;
}

export function UnifiedDiff({ diff, title }: UnifiedDiffProps) {
  if (!diff.hasChanges) {
    return (
      <Card variant="outlined">
        <CardContent className="p-4 text-center">
          <p className="text-text-secondary">No changes detected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <div className="text-sm text-text-secondary">
            <span className="text-green-600">+{diff.additions}</span>
            {" / "}
            <span className="text-red-600">-{diff.deletions}</span>
          </div>
        </div>
      )}

      <Card variant="outlined" className="overflow-hidden">
        <ScrollArea className="h-[600px]">
          <div className="font-mono text-sm">
            <table className="w-full border-collapse">
              <tbody>
                {diff.lines.map((line, index) => (
                  <DiffLineComponent key={index} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

interface DiffLineComponentProps {
  line: DiffLine;
}

function DiffLineComponent({ line }: DiffLineComponentProps) {
  const getLineStyle = () => {
    switch (line.type) {
      case "add":
        return "bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100";
      case "delete":
        return "bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100";
      case "context":
        return "bg-background-paper text-text-primary";
      default:
        return "";
    }
  };

  const getLinePrefix = () => {
    switch (line.type) {
      case "add":
        return "+";
      case "delete":
        return "-";
      case "context":
        return " ";
      default:
        return "";
    }
  };

  const getLineNumbers = () => {
    if (line.type === "add") {
      return {
        old: "",
        new: line.newLineNumber?.toString() || "",
      };
    } else if (line.type === "delete") {
      return {
        old: line.oldLineNumber?.toString() || "",
        new: "",
      };
    } else {
      return {
        old: line.oldLineNumber?.toString() || "",
        new: line.newLineNumber?.toString() || "",
      };
    }
  };

  const lineNumbers = getLineNumbers();
  const lineStyle = getLineStyle();
  const prefix = getLinePrefix();

  return (
    <tr className={lineStyle}>
      {/* Old line number */}
      <td className="w-12 px-2 py-0.5 text-right text-text-tertiary select-none border-r border-border-default">
        {lineNumbers.old}
      </td>

      {/* New line number */}
      <td className="w-12 px-2 py-0.5 text-right text-text-tertiary select-none border-r border-border-default">
        {lineNumbers.new}
      </td>

      {/* Prefix (+/-/ ) */}
      <td className="w-8 px-2 py-0.5 text-center select-none border-r border-border-default font-bold">
        {prefix}
      </td>

      {/* Line content */}
      <td className="px-2 py-0.5 whitespace-pre-wrap break-all">
        {line.content || " "}
      </td>
    </tr>
  );
}
