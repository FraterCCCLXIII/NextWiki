"use client";

import * as React from "react";
import { cn } from "../../utils";

export type TreeData = {
  name: string;
  status?: string;
  link?: string;
  blurb?: string;
  children?: TreeData[];
};

const countDescendants = (node: TreeData): number =>
  (node.children ?? []).reduce((sum, child) => sum + 1 + countDescendants(child), 0);

export type TreeNodeProps = {
  node: TreeData;
  depth?: number;
  defaultOpenDepth?: number;
};

export function TreeNode({ node, depth = 0, defaultOpenDepth = 0 }: TreeNodeProps) {
  const hasChildren = !!node.children?.length;
  const [open, setOpen] = React.useState(depth < defaultOpenDepth);
  const childId = React.useId();
  const descendants = hasChildren ? countDescendants(node) : 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined}>
      <div
        className="flex flex-wrap items-baseline gap-x-2 py-1 text-base"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={childId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-baseline gap-1.5 text-left text-kosmo-text hover:text-kosmo-mint focus-visible:outline-none focus-visible:text-kosmo-mint"
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block text-kosmo-dim2 transition-transform duration-150",
                open && "rotate-90 text-kosmo-mint",
              )}
            >
              ▸
            </span>
            <span>{node.name}</span>
            <span className="text-sm text-kosmo-dim">{descendants}</span>
          </button>
        ) : (
          <span className="pl-[1.1em] text-kosmo-text">{node.name}</span>
        )}

        {node.status ? <span className="text-sm text-kosmo-dim">{node.status}</span> : null}

        {node.link ? (
          <a
            href={node.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-kosmo-blue hover:text-kosmo-mint"
          >
            wiki ↗
          </a>
        ) : null}

        {open && node.blurb ? (
          <p className="w-full pl-[1.1em] text-sm leading-relaxed text-kosmo-dim2">{node.blurb}</p>
        ) : null}
      </div>

      {hasChildren && open ? (
        <ul id={childId} role="group" className="border-l border-kosmo-line">
          {node.children!.map((child, i) => (
            <TreeNode
              key={`${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              defaultOpenDepth={defaultOpenDepth}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export type TreeProps = {
  nodes: TreeData[];
  defaultOpenDepth?: number;
  className?: string;
};

export function Tree({ nodes, defaultOpenDepth = 0, className }: TreeProps) {
  return (
    <ul role="tree" className={cn("flex flex-col", className)}>
      {nodes.map((node, i) => (
        <TreeNode
          key={`${node.name}-${i}`}
          node={node}
          depth={0}
          defaultOpenDepth={defaultOpenDepth}
        />
      ))}
    </ul>
  );
}
