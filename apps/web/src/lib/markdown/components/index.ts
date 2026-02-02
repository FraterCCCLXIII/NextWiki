/**
 * Re-exports all custom React components for markdown rendering
 */

import { codeComponent } from "./CodeComponent";
import { listItemComponent } from "./ListItemComponent";
import { listComponent } from "./ListComponent";
import { linkComponent } from "./LinkComponent";
import { h1Component, h2Component, h3Component, h4Component, h5Component, h6Component } from "./HeadingComponent";
import { blockquoteComponent } from "./BlockquoteComponent";
import type { Components } from "react-markdown";

/**
 * Collection of all custom components for client-side markdown rendering
 */
export const markdownComponents: Components = {
  code: codeComponent,
  ul: listComponent,
  li: listItemComponent,
  a: linkComponent,
  h1: h1Component,
  h2: h2Component,
  h3: h3Component,
  h4: h4Component,
  h5: h5Component,
  h6: h6Component,
  blockquote: blockquoteComponent,
};
