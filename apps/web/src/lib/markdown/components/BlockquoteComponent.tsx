import React from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle, Quote } from "lucide-react";

interface BlockquoteProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Custom blockquote component that adds icons based on the blockquote type
 * Replaces emoji-based indicators with proper icon components
 */
export function blockquoteComponent({ children, className, ...props }: BlockquoteProps & React.HTMLAttributes<HTMLElement>) {
  // Determine the blockquote type from className
  const isInfo = className?.includes("is-info");
  const isWarning = className?.includes("is-warning");
  const isDanger = className?.includes("is-danger");
  const isSuccess = className?.includes("is-success");
  const isQuote = className?.includes("is-quote");

  // Select the appropriate icon and label
  let Icon = null;
  let label = "";

  if (isInfo) {
    Icon = Info;
    label = "Info";
  } else if (isWarning) {
    Icon = AlertTriangle;
    label = "Warning";
  } else if (isDanger) {
    Icon = AlertCircle;
    label = "Danger";
  } else if (isSuccess) {
    Icon = CheckCircle;
    label = "Success";
  } else if (isQuote) {
    Icon = Quote;
    label = "Quote";
  }

  // Strip emoji from the beginning of the content if present
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") {
      // Remove common emojis at the start
      return children.replace(/^[ℹ️⚠️❌✅💡🔔📝🎯✓✔️⚡🔥💬]\s*/, "");
    }
    
    if (React.isValidElement(children) && children.props.children) {
      return React.cloneElement(children, {
        ...children.props,
        children: processChildren(children.props.children),
      });
    }

    if (Array.isArray(children)) {
      return children.map((child, index) => {
        if (index === 0) {
          return processChildren(child);
        }
        return child;
      });
    }

    return children;
  };

  return (
    <blockquote className={className} {...props}>
      {Icon && (
        <div className="flex items-start gap-2">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">{processChildren(children)}</div>
        </div>
      )}
      {!Icon && children}
    </blockquote>
  );
}
