import React from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle, Quote, Lightbulb } from "lucide-react";
import { cn } from "~/lib/utils";

interface BlockquoteProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Custom blockquote component that adds icons based on the blockquote type
 * Replaces emoji-based indicators with proper icon components
 */
type BlockquoteType = "info" | "warning" | "danger" | "success" | "quote" | "tip";

const emojiTypeMap: Array<{ type: BlockquoteType; emojis: string[] }> = [
  { type: "tip", emojis: ["💡"] },
  { type: "info", emojis: ["ℹ️", "ℹ", "🔔", "📝"] },
  { type: "warning", emojis: ["⚠️", "⚠"] },
  { type: "danger", emojis: ["❌", "🔥"] },
  { type: "success", emojis: ["✅", "✓", "✔️", "✔"] },
  { type: "quote", emojis: ["💬"] },
];

function stripLeadingEmoji(text: string) {
  for (const entry of emojiTypeMap) {
    for (const emoji of entry.emojis) {
      const regex = new RegExp(`^\\s*${emoji}\\s*`);
      if (regex.test(text)) {
        return { text: text.replace(regex, ""), type: entry.type };
      }
    }
  }
  return { text, type: null as BlockquoteType | null };
}

function getEmojiTypeFromText(text: string): BlockquoteType | null {
  for (const entry of emojiTypeMap) {
    if (entry.emojis.some((emoji) => text.includes(emoji))) {
      return entry.type;
    }
  }
  return null;
}

function processLeadingChild(
  node: React.ReactNode,
  setDetectedEmojiType: (type: BlockquoteType) => void
): { node: React.ReactNode; continueScanning: boolean } {
  if (typeof node === "string") {
    if (/^\s*$/.test(node)) {
      return { node, continueScanning: true };
    }
    const result = stripLeadingEmoji(node);
    if (result.type) {
      setDetectedEmojiType(result.type);
      const nextText = result.text;
      if (nextText.trim().length === 0) {
        return { node: null, continueScanning: true };
      }
      return { node: nextText, continueScanning: false };
    }
    return { node, continueScanning: false };
  }

  if (React.isValidElement(node)) {
    const classNameValue = String(node.props?.className ?? "");
    const isEmojiElement = classNameValue.split(" ").includes("emoji");
    if (isEmojiElement) {
      const emojiText =
        typeof node.props?.children === "string"
          ? node.props.children
          : "";
      const emojiType = getEmojiTypeFromText(emojiText);
      if (emojiType) {
        setDetectedEmojiType(emojiType);
      }
      return { node: null, continueScanning: true };
    }
  }

  return { node, continueScanning: false };
}

export function blockquoteComponent({
  children,
  className,
  ...props
}: BlockquoteProps & React.HTMLAttributes<HTMLElement>) {
  const isInfo = className?.includes("is-info");
  const isWarning = className?.includes("is-warning");
  const isDanger = className?.includes("is-danger");
  const isSuccess = className?.includes("is-success");
  const isQuote = className?.includes("is-quote");
  const isTip = className?.includes("is-tip");

  const classType: BlockquoteType | null = isInfo
    ? "info"
    : isTip
      ? "tip"
      : isWarning
        ? "warning"
        : isDanger
          ? "danger"
          : isSuccess
            ? "success"
            : isQuote
              ? "quote"
              : null;

  let detectedEmojiType: BlockquoteType | null = null;

  const processChildren = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      const result = stripLeadingEmoji(node);
      if (result.type && !detectedEmojiType) {
        detectedEmojiType = result.type;
      }
      return result.text;
    }

    if (React.isValidElement(node)) {
      const classNameValue = String(node.props?.className ?? "");
      const isEmojiElement = classNameValue.split(" ").includes("emoji");
      if (isEmojiElement) {
        const emojiText =
          typeof node.props?.children === "string"
            ? node.props.children
            : "";
        const emojiType = getEmojiTypeFromText(emojiText);
        if (emojiType && !detectedEmojiType) {
          detectedEmojiType = emojiType;
        }
        return null;
      }
    }

    if (React.isValidElement(node) && node.props.children) {
      return React.cloneElement(node, {
        ...node.props,
        children: processChildren(node.props.children),
      });
    }

    if (Array.isArray(node)) {
      const processed: React.ReactNode[] = [];
      let scanning = true;
      const setDetectedEmojiType = (type: BlockquoteType) => {
        if (!detectedEmojiType) detectedEmojiType = type;
      };
      node.forEach((child) => {
        if (scanning) {
          const result = processLeadingChild(child, setDetectedEmojiType);
          scanning = result.continueScanning;
          if (result.node !== null) {
            processed.push(processChildren(result.node));
          }
          return;
        }
        processed.push(child);
      });
      return processed;
    }

    return node;
  };

  const content = processChildren(children);
  const type = classType ?? detectedEmojiType;

  const Icon = type === "info"
    ? Info
    : type === "tip"
      ? Lightbulb
      : type === "warning"
        ? AlertTriangle
        : type === "danger"
          ? AlertCircle
          : type === "success"
            ? CheckCircle
            : type === "quote"
              ? Quote
              : null;

  const typeClassName = type && !className?.includes(`is-${type}`)
    ? `is-${type}`
    : undefined;
  const blockquoteClassName = cn(className, typeClassName);

  return (
    <blockquote className={blockquoteClassName} {...props}>
      {Icon ? (
        <div className="flex items-start gap-2">
          <Icon className="h-5 w-5 flex-shrink-0 self-start mt-0.5" />
          <div className="flex-1">{content}</div>
        </div>
      ) : (
        content
      )}
    </blockquote>
  );
}
