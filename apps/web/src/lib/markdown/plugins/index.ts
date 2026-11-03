/**
 * Exports all custom markdown plugins
 */

import remarkAttrs from "./remarkAttrs";
import remarkKosmoEmbed from "./remarkKosmoEmbed";

/**
 * Collection of all custom plugins used in the application
 */
export const customPlugins = [
  remarkAttrs,
  remarkKosmoEmbed,
  // Add other custom plugins here
];
