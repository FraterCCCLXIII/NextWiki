/**
 * Turns a paragraph containing only `{{kosmo:<infobox|children|links>:<slug>}}`
 * into a `kosmo-block` element. The React component map renders that element
 * as a live block that fetches the entity from the DB at view time.
 *
 * The paragraph is matched on its raw source text rather than its children,
 * because `:infobox:` and friends can be split into directive/emoji nodes by
 * the other remark plugins.
 */
import type { Node } from "unist";
import { visit } from "unist-util-visit";

interface BlockNode extends Node {
  children?: Node[];
  value?: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
}

const BLOCK_PATTERN = /^\{\{kosmo:(infobox|children|links):([^\s{}]+)\}\}$/;

function plainText(node: BlockNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map((child) => plainText(child as BlockNode)).join("");
}

function sourceText(node: BlockNode, file?: { value?: unknown }): string {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof file?.value === "string" && typeof start === "number" && typeof end === "number") {
    return file.value.slice(start, end).trim();
  }
  return plainText(node).trim();
}

function remarkKosmoBlocks() {
  return (tree: Node, file?: { value?: unknown }) => {
    visit(tree, "paragraph", (node: BlockNode) => {
      const match = BLOCK_PATTERN.exec(sourceText(node, file));
      if (!match) return;

      const kind = match[1]!;
      const slug = match[2]!;

      node.children = [];
      node.data = {
        ...node.data,
        hName: "kosmo-block",
        hProperties: { kind, slug },
      };
    });
  };
}

export default remarkKosmoBlocks;
