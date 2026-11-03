/**
 * tiptap-markdown exports `MarkdownStorage` but does not augment Tiptap's
 * `Storage` interface, so `editor.storage.markdown` is untyped in this app.
 * Declare the augmentation the package is missing.
 *
 * The Markdown extension is registered by every editor in this app, which is
 * why `markdown` is declared as always present.
 */
import type { MarkdownStorage } from "tiptap-markdown";

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
