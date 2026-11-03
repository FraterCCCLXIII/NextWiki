/**
 * Exports all custom markdown plugins
 */

import remarkAttrs from "./remarkAttrs";
import remarkKosmoEmbed from "./remarkKosmoEmbed";
import remarkKosmoBlocks from "./remarkKosmoBlocks";

/**
 * Collection of all custom plugins used in the application
 */
export const customPlugins = [
  remarkAttrs,
  remarkKosmoEmbed,
  remarkKosmoBlocks,
  // Add other custom plugins here
];
