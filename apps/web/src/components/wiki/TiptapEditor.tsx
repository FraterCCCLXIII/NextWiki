"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { MarkdownProse } from "./MarkdownProse";
import { logger } from "@repo/logger";
import { cn } from "~/lib/utils";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@repo/ui";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Highlighter,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link2,
  Unlink,
  Image as ImageIcon,
  Minus,
  Paintbrush,
  ListChecks,
  RemoveFormatting,
} from "lucide-react";

interface TiptapEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  onFileUpload?: (file: File) => void;
  showToolbar?: boolean;
  showInlineMenus?: boolean;
  className?: string;
}

export function TiptapEditor({
  content,
  onContentChange,
  placeholder = "Write your content using Markdown...",
  editable = true,
  onFileUpload,
  showToolbar = false,
  showInlineMenus,
  className,
}: TiptapEditorProps) {
  const inlineMenusEnabled = showInlineMenus ?? showToolbar;
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image,
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    content,
    extensions,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-full w-full outline-none focus:outline-none text-text-primary",
      },
      handlePaste: (_view, event) => {
        if (!onFileUpload) return false;

        const files = Array.from(event.clipboardData?.files || []);
        const items = Array.from(event.clipboardData?.items || []);

        logger.debug(
          "TipTap paste files:",
          files.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          }))
        );

        if (files.length > 0 && files[0]) {
          event.preventDefault();
          void onFileUpload(files[0]);
          return true;
        }

        const fileItem = items.find((item) => item.kind === "file");
        if (fileItem) {
          event.preventDefault();
          const file = fileItem.getAsFile();
          if (file) {
            void onFileUpload(file);
            return true;
          }
        }

        return false;
      },
      handleDrop: (_view, event) => {
        if (!onFileUpload) return false;

        const file = event.dataTransfer?.files?.[0];
        if (file) {
          event.preventDefault();
          void onFileUpload(file);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const markdown = activeEditor.storage.markdown.getMarkdown();
      onContentChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const currentMarkdown = editor.storage.markdown.getMarkdown();
    if (currentMarkdown !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const handleSetLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previousUrl || "");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleSetImage = () => {
    if (!editor) return;
    const url = window.prompt("Enter image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const colorOptions = [
    { label: "Default", value: "var(--color-text-primary)" },
    { label: "Primary", value: "var(--color-primary-600)" },
    { label: "Secondary", value: "var(--color-secondary-600)" },
    { label: "Accent", value: "var(--color-accent-600)" },
    { label: "Success", value: "var(--color-success-600)" },
    { label: "Warning", value: "var(--color-warning-600)" },
    { label: "Error", value: "var(--color-error-600)" },
  ];

  const highlightColor = "var(--color-accent-100)";

  return (
    <div
      className={cn(
        "tiptap-editor h-full overflow-auto bg-background-level1",
        className
      )}
    >
      {showToolbar && editor && (
        <div className="border-border sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 border-b bg-background-level1 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Bold"
            aria-pressed={editor.isActive("bold")}
            className={cn(editor.isActive("bold") && "bg-background-level2")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Italic"
            aria-pressed={editor.isActive("italic")}
            className={cn(editor.isActive("italic") && "bg-background-level2")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Underline"
            aria-pressed={editor.isActive("underline")}
            className={cn(editor.isActive("underline") && "bg-background-level2")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Strikethrough"
            aria-pressed={editor.isActive("strike")}
            className={cn(editor.isActive("strike") && "bg-background-level2")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Highlight"
            aria-pressed={editor.isActive("highlight")}
            className={cn(editor.isActive("highlight") && "bg-background-level2")}
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHighlight({ color: highlightColor })
                .run()
            }
          >
            <Highlighter className="h-4 w-4" />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                color="primary"
                aria-label="Text color"
              >
                <Paintbrush className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44 p-1">
              {colorOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="sm"
                  variant="ghost"
                  color="primary"
                  className="w-full justify-start"
                  onClick={() =>
                    editor.chain().focus().setColor(option.value).run()
                  }
                >
                  <span
                    className="mr-2 inline-flex h-3 w-3 rounded-full border border-border-default"
                    style={{ backgroundColor: option.value }}
                  />
                  {option.label}
                </Button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Inline code"
            aria-pressed={editor.isActive("code")}
            className={cn(editor.isActive("code") && "bg-background-level2")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <RemoveFormatting className="h-4 w-4" />
          </Button>
          <span className="text-border-dark">|</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Heading 1"
            aria-pressed={editor.isActive("heading", { level: 1 })}
            className={cn(
              editor.isActive("heading", { level: 1 }) &&
                "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Heading 2"
            aria-pressed={editor.isActive("heading", { level: 2 })}
            className={cn(
              editor.isActive("heading", { level: 2 }) &&
                "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Heading 3"
            aria-pressed={editor.isActive("heading", { level: 3 })}
            className={cn(
              editor.isActive("heading", { level: 3 }) &&
                "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <span className="text-border-dark">|</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Bullet list"
            aria-pressed={editor.isActive("bulletList")}
            className={cn(
              editor.isActive("bulletList") && "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Ordered list"
            aria-pressed={editor.isActive("orderedList")}
            className={cn(
              editor.isActive("orderedList") && "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Task list"
            aria-pressed={editor.isActive("taskList")}
            className={cn(
              editor.isActive("taskList") && "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Blockquote"
            aria-pressed={editor.isActive("blockquote")}
            className={cn(
              editor.isActive("blockquote") && "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Code block"
            aria-pressed={editor.isActive("codeBlock")}
            className={cn(
              editor.isActive("codeBlock") && "bg-background-level2"
            )}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-border-dark">|</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Insert link"
            onClick={handleSetLink}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="primary"
            aria-label="Insert image"
            onClick={handleSetImage}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      {inlineMenusEnabled && editor && (
        <>
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150 }}
            className="border-border flex items-center gap-1 rounded-md border bg-background-level1 p-1 shadow-md"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Bold"
              aria-pressed={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Italic"
              aria-pressed={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Underline"
              aria-pressed={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Highlight"
              aria-pressed={editor.isActive("highlight")}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHighlight({ color: highlightColor })
                  .run()
              }
            >
              <Highlighter className="h-4 w-4" />
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  color="primary"
                  aria-label="Text color"
                >
                  <Paintbrush className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44 p-1">
                {colorOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant="ghost"
                    color="primary"
                    className="w-full justify-start"
                    onClick={() =>
                      editor.chain().focus().setColor(option.value).run()
                    }
                  >
                    <span
                      className="mr-2 inline-flex h-3 w-3 rounded-full border border-border-default"
                      style={{ backgroundColor: option.value }}
                    />
                    {option.label}
                  </Button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Link"
              onClick={handleSetLink}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Clear formatting"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              }
            >
              <RemoveFormatting className="h-4 w-4" />
            </Button>
          </BubbleMenu>
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 150 }}
            className="border-border flex items-center gap-1 rounded-md border bg-background-level1 p-1 shadow-md"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Paragraph"
              aria-pressed={editor.isActive("paragraph")}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <span className="px-1 text-xs font-semibold">P</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Heading 1"
              aria-pressed={editor.isActive("heading", { level: 1 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Heading 2"
              aria-pressed={editor.isActive("heading", { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Bullet list"
              aria-pressed={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Ordered list"
              aria-pressed={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Task list"
              aria-pressed={editor.isActive("taskList")}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <ListChecks className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Blockquote"
              aria-pressed={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              color="primary"
              aria-label="Code block"
              aria-pressed={editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <Code className="h-4 w-4" />
            </Button>
          </FloatingMenu>
        </>
      )}
      <MarkdownProse className="h-full">
        <div className="mx-auto h-full w-full max-w-4xl px-8 py-6">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </MarkdownProse>
    </div>
  );
}
