"use client";

import {
  ChangeEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "~/lib/utils";

interface MarkdownTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MarkdownTextEditor({
  value,
  onChange,
  placeholder = "Write your content using Markdown...",
  disabled = false,
  className,
}: MarkdownTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [wrapHeights, setWrapHeights] = useState<number[]>([]);
  const [mirrorWidth, setMirrorWidth] = useState<number | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const lineNumbers = useMemo(() => {
    const lineCount = Math.max(1, value.split("\n").length);
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [value]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [value]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const measureContainer = measureRef.current;
    if (!textarea || !measureContainer) return;

    const computeWrapHeights = () => {
      setMirrorWidth(textarea.clientWidth);
      const lineElements = lineRefs.current;
      if (lineElements.length === 0) {
        setWrapHeights([]);
        return;
      }

      const tops = lineElements.map((line) => line?.offsetTop ?? 0);
      const containerHeight = measureContainer.offsetHeight;
      const heights = tops.map((top, index) => {
        const nextTop = tops[index + 1] ?? containerHeight;
        return Math.max(nextTop - top, 0);
      });

      setWrapHeights(heights);
    };

    computeWrapHeights();

    const observer = new ResizeObserver(() => computeWrapHeights());
    observer.observe(textarea);
    observer.observe(measureContainer);

    return () => {
      observer.disconnect();
    };
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={cn("h-full bg-background-level1", className)}>
      <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-4xl px-8 py-6">
          <div className="relative flex items-start gap-3 font-mono text-sm leading-6">
            <div className="select-none text-right text-text-tertiary">
              {lineNumbers.map((line, index) => (
                <div
                  key={line}
                  className="pr-2"
                  style={{
                    height: wrapHeights[index] || "auto",
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "min-h-full w-full resize-none overflow-hidden bg-transparent text-text-primary outline-none",
                "placeholder:text-text-tertiary"
              )}
            />
            <div
              ref={measureRef}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-0 top-0 -z-10 whitespace-pre-wrap break-words text-transparent",
                "font-mono text-sm leading-6"
              )}
              style={{
                width: mirrorWidth ? `${mirrorWidth}px` : "100%",
              }}
            >
              {value.split("\n").map((line, index) => (
                <div
                  key={`${index}-${line}`}
                  ref={(node) => {
                    lineRefs.current[index] = node;
                  }}
                >
                  {line || " "}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
