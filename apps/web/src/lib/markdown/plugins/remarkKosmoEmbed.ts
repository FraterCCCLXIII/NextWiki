/**
 * Turns a paragraph containing only `{{embed:<tool>}}` into an iframe
 * pointing at a static Kosmographica tool. Uses hName/hProperties so the
 * output is a plain element (no raw HTML needed on client or server).
 */
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { kosmoToolSrc, KOSMO_TOOLS } from "~/lib/kosmo/tools";

interface EmbedNode extends Node {
  children?: Node[];
  value?: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, string | boolean>;
  };
}

const EMBED_PATTERN = /^\{\{embed:([a-z-]+)\}\}$/;

function remarkKosmoEmbed() {
  return (tree: Node) => {
    visit(tree, "paragraph", (node: EmbedNode) => {
      const children = node.children ?? [];
      if (children.length !== 1 || children[0]?.type !== "text") return;

      const match = EMBED_PATTERN.exec((children[0] as EmbedNode).value ?? "");
      if (!match) return;

      const slug = match[1]!;
      const src = kosmoToolSrc(slug);
      if (!src) return;

      node.children = [];
      node.data = {
        ...node.data,
        hName: "iframe",
        hProperties: {
          src,
          title: KOSMO_TOOLS[slug]!.title,
          loading: "lazy",
          className: "kosmo-embed w-full min-h-[80vh] border-0",
        },
      };
    });
  };
}

export default remarkKosmoEmbed;
