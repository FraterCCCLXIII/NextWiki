import { diffLines, Change } from "diff";

/**
 * Service for comparing page revisions and generating diffs
 */

export interface RevisionComparison {
  contentDiff: DiffResult;
  titleChanged: boolean;
  oldTitle?: string;
  newTitle?: string;
  pathChanged: boolean;
  oldPath?: string;
  newPath?: string;
  publishStatusChanged: boolean;
  oldPublishStatus?: boolean;
  newPublishStatus?: boolean;
  editorTypeChanged: boolean;
  oldEditorType?: string | null;
  newEditorType?: string | null;
  tagsChanged: boolean;
  oldTags?: string[];
  newTags?: string[];
}

export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  hasChanges: boolean;
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Generate a unified diff between two text strings
 * Uses a more robust approach to ensure both additions and deletions are shown
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string
): DiffResult {
  // Normalize inputs - DON'T trim as that loses important whitespace changes
  // Just ensure they're strings
  const normalizedOld = oldText || "";
  const normalizedNew = newText || "";
  
  // If both are empty, no changes
  if (normalizedOld === "" && normalizedNew === "") {
    return {
      lines: [],
      additions: 0,
      deletions: 0,
      hasChanges: false,
    };
  }
  
  // If only one is empty, show full diff
  if (normalizedOld === "" || normalizedNew === "") {
    const text = normalizedOld || normalizedNew;
    const textLines = text.split(/\r?\n/);
    const diffLines: DiffLine[] = [];
    
    if (normalizedOld === "") {
      // Everything is added
      textLines.forEach((line, idx) => {
        diffLines.push({
          type: "add",
          content: line,
          newLineNumber: idx + 1,
        });
      });
      
      return {
        lines: diffLines,
        additions: textLines.length,
        deletions: 0,
        hasChanges: true,
      };
    } else {
      // Everything is deleted
      textLines.forEach((line, idx) => {
        diffLines.push({
          type: "delete",
          content: line,
          oldLineNumber: idx + 1,
        });
      });
      
      return {
        lines: diffLines,
        additions: 0,
        deletions: textLines.length,
        hasChanges: true,
      };
    }
  }
  
  // Ensure both texts end with newlines for consistent line comparison
  const oldWithNewline = normalizedOld && !normalizedOld.endsWith('\n') ? normalizedOld + '\n' : normalizedOld;
  const newWithNewline = normalizedNew && !normalizedNew.endsWith('\n') ? normalizedNew + '\n' : normalizedNew;
  
  // Use diffLines - it treats each line as a unit
  const changes: Change[] = diffLines(oldWithNewline, newWithNewline);

  const lines: DiffLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;
  let additions = 0;
  let deletions = 0;

  // Process each change block
  changes.forEach((change) => {
    // Split by newlines carefully
    const contentLines = change.value.split(/\r?\n/);
    
    // Remove last element only if it's truly empty (trailing newline case)
    if (contentLines.length > 0 && contentLines[contentLines.length - 1] === "") {
      contentLines.pop();
    }
    
    // Skip if no actual content lines
    if (contentLines.length === 0) {
      return;
    }

    if (change.removed) {
      // IMPORTANT: Process removals FIRST (before additions)
      // This ensures red lines appear before green lines in the diff
      contentLines.forEach((line) => {
        lines.push({
          type: "delete",
          content: line,
          oldLineNumber: oldLineNumber++,
        });
        deletions++;
      });
    } else if (change.added) {
      // Process additions second
      contentLines.forEach((line) => {
        lines.push({
          type: "add",
          content: line,
          newLineNumber: newLineNumber++,
        });
        additions++;
      });
    } else {
      // Context lines (unchanged)
      contentLines.forEach((line) => {
        lines.push({
          type: "context",
          content: line,
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
        });
      });
    }
  });

  return {
    lines,
    additions,
    deletions,
    hasChanges: additions > 0 || deletions > 0,
  };
}

/**
 * Compare two revisions and return detailed differences
 */
export function compareRevisions(
  oldRevision: {
    content: string;
    title?: string | null;
    path?: string | null;
    isPublished?: boolean | null;
    editorType?: string | null;
    revisionMetadata?: any;
  },
  newRevision: {
    content: string;
    title?: string | null;
    path?: string | null;
    isPublished?: boolean | null;
    editorType?: string | null;
    revisionMetadata?: any;
  }
): RevisionComparison {
  // Generate content diff
  const contentDiff = generateUnifiedDiff(
    oldRevision.content || "",
    newRevision.content || ""
  );

  // Compare metadata
  const titleChanged = oldRevision.title !== newRevision.title;
  const pathChanged = oldRevision.path !== newRevision.path;
  const publishStatusChanged =
    oldRevision.isPublished !== newRevision.isPublished;
  const editorTypeChanged = oldRevision.editorType !== newRevision.editorType;

  // Compare tags
  const oldTags =
    (oldRevision.revisionMetadata as Record<string, unknown>)?.tags as string[] || [];
  const newTags =
    (newRevision.revisionMetadata as Record<string, unknown>)?.tags as string[] || [];
  const tagsChanged =
    JSON.stringify(oldTags.sort()) !== JSON.stringify(newTags.sort());

  return {
    contentDiff,
    titleChanged,
    oldTitle: oldRevision.title || undefined,
    newTitle: newRevision.title || undefined,
    pathChanged,
    oldPath: oldRevision.path || undefined,
    newPath: newRevision.path || undefined,
    publishStatusChanged,
    oldPublishStatus: oldRevision.isPublished || undefined,
    newPublishStatus: newRevision.isPublished || undefined,
    editorTypeChanged,
    oldEditorType: oldRevision.editorType || undefined,
    newEditorType: newRevision.editorType || undefined,
    tagsChanged,
    oldTags,
    newTags,
  };
}

/**
 * Format a diff result as a unified diff string (like git diff)
 */
export function formatUnifiedDiff(diff: DiffResult): string {
  let result = "";

  diff.lines.forEach((line) => {
    if (line.type === "add") {
      result += `+ ${line.content}\n`;
    } else if (line.type === "delete") {
      result += `- ${line.content}\n`;
    } else {
      result += `  ${line.content}\n`;
    }
  });

  return result;
}

/**
 * Get a summary of changes between two revisions
 */
export function getChangeSummary(comparison: RevisionComparison): string {
  const changes: string[] = [];

  if (comparison.titleChanged) {
    changes.push(
      `Title changed from "${comparison.oldTitle}" to "${comparison.newTitle}"`
    );
  }

  if (comparison.pathChanged) {
    changes.push(
      `Path changed from "${comparison.oldPath}" to "${comparison.newPath}"`
    );
  }

  if (comparison.publishStatusChanged) {
    changes.push(
      comparison.newPublishStatus ? "Page published" : "Page unpublished"
    );
  }

  if (comparison.editorTypeChanged) {
    changes.push(
      `Editor type changed from ${comparison.oldEditorType || "none"} to ${comparison.newEditorType || "none"}`
    );
  }

  if (comparison.contentDiff.hasChanges) {
    changes.push(
      `Content changed (+${comparison.contentDiff.additions} -${comparison.contentDiff.deletions} lines)`
    );
  }

  if (comparison.tagsChanged) {
    changes.push("Tags modified");
  }

  return changes.length > 0 ? changes.join(", ") : "No changes detected";
}
