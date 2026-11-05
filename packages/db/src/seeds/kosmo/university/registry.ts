/**
 * Stable identity for the University curriculum.
 *
 * university-tree.js identifies things by name: modules by their name, lessons by their
 * position. Names get edited and positions shift, so neither can be a primary key.
 * `ids.json` is the append-only ledger that fixes this. Every stage, programme, module
 * and lesson gets an opaque id the first time it is seen and keeps it forever:
 *
 *   KU-S01 stage · KU-P001 programme · KU-M0001 module · KU-L00001 lesson
 *
 * The ledger maps a *natural key* (built from names) to the id. To rename a node, edit the
 * key in ids.json by hand; the id, and everything that references it, stays. A key that
 * is in the ledger but no longer in the tree is reported as `orphaned`, never deleted.
 *
 * This file is pure (no database, no filesystem) so it can be tested and reused.
 */

export type TreeLesson = string | { t: string; go?: string; sim?: unknown; pedia?: string };
export type TreeModule = { name: string; req: string[]; lessons: TreeLesson[] };
export type TreeProgramme = { name: string; modules: TreeModule[] };
export type TreeStage = {
  id: string;
  name: string;
  ages?: string;
  color?: string;
  blurb?: string;
  programs: TreeProgramme[];
};

export type NodeKind = "stage" | "programme" | "module" | "lesson";

export type Registry = {
  version: 1;
  /** Next number to hand out per kind. Only ever grows. */
  next: Record<NodeKind, number>;
  /** natural key -> stable id */
  ids: Record<string, string>;
};

const PREFIX: Record<NodeKind, { letter: string; width: number }> = {
  stage: { letter: "S", width: 2 },
  programme: { letter: "P", width: 3 },
  module: { letter: "M", width: 4 },
  lesson: { letter: "L", width: 5 },
};

export function emptyRegistry(): Registry {
  return { version: 1, next: { stage: 1, programme: 1, module: 1, lesson: 1 }, ids: {} };
}

export function formatId(kind: NodeKind, n: number): string {
  const { letter, width } = PREFIX[kind];
  return `KU-${letter}${String(n).padStart(width, "0")}`;
}

export function kindOfId(id: string): NodeKind | null {
  const m = /^KU-([SPML])\d+$/.exec(id);
  if (!m) return null;
  return (["stage", "programme", "module", "lesson"] as const).find(
    (k) => PREFIX[k].letter === m[1],
  )!;
}

export function lessonTitle(lesson: TreeLesson): string {
  return typeof lesson === "string" ? lesson : lesson.t;
}

// --- natural keys -------------------------------------------------------------------------

export const stageKey = (stage: TreeStage) => `stage|${stage.id}`;
export const programmeKey = (stage: TreeStage, prog: TreeProgramme) =>
  `prog|${stage.id}|${prog.name}`;
/** Module names are unique across the whole tree (the tree's own rule, enforced below). */
export const moduleKey = (mod: TreeModule) => `mod|${mod.name}`;
/** A repeated title inside one module gets "#2", "#3" so keys stay unique. */
export function lessonKeys(mod: TreeModule): string[] {
  const seen = new Map<string, number>();
  return mod.lessons.map((lesson) => {
    const title = lessonTitle(lesson);
    const n = (seen.get(title) ?? 0) + 1;
    seen.set(title, n);
    return `les|${mod.name}|${title}${n > 1 ? `#${n}` : ""}`;
  });
}

/** Every natural key in the tree, in tree order, with its kind. */
export function enumerateKeys(tree: TreeStage[]): { key: string; kind: NodeKind }[] {
  const out: { key: string; kind: NodeKind }[] = [];
  for (const stage of tree) {
    out.push({ key: stageKey(stage), kind: "stage" });
    for (const prog of stage.programs) {
      out.push({ key: programmeKey(stage, prog), kind: "programme" });
      for (const mod of prog.modules) {
        out.push({ key: moduleKey(mod), kind: "module" });
        for (const key of lessonKeys(mod)) out.push({ key, kind: "lesson" });
      }
    }
  }
  return out;
}

export type SyncResult = {
  registry: Registry;
  /** Keys given an id on this run. */
  added: string[];
  /** In the ledger but absent from the tree: renamed or removed. Ids are kept. */
  orphaned: string[];
};

/** Assigns ids to every key that lacks one. Never reassigns or deletes. */
export function syncRegistry(tree: TreeStage[], previous: Registry): SyncResult {
  const registry: Registry = {
    version: 1,
    next: { ...previous.next },
    ids: { ...previous.ids },
  };
  const added: string[] = [];
  const present = new Set<string>();
  for (const { key, kind } of enumerateKeys(tree)) {
    present.add(key);
    if (registry.ids[key]) continue;
    registry.ids[key] = formatId(kind, registry.next[kind]++);
    added.push(key);
  }
  const orphaned = Object.keys(registry.ids).filter((k) => !present.has(k));
  return { registry, added, orphaned };
}

// --- the resolved graph -------------------------------------------------------------------

export type ResolvedLesson = {
  id: string;
  title: string;
  order: number;
  go?: string;
  sim?: unknown;
  pedia?: string;
};
export type ResolvedModule = {
  id: string;
  name: string;
  order: number;
  /** Stable ids of the modules this one builds on. */
  requires: string[];
  lessons: ResolvedLesson[];
};
export type ResolvedProgramme = { id: string; name: string; order: number; modules: ResolvedModule[] };
export type ResolvedStage = {
  id: string;
  /** The tree's stage id ("preschool"), used in URLs. */
  key: string;
  name: string;
  ages?: string;
  color?: string;
  blurb?: string;
  order: number;
  programmes: ResolvedProgramme[];
};

/** Problems that make the tree unusable as a graph. An empty list means it is sound. */
export function validateTree(tree: TreeStage[]): string[] {
  const problems: string[] = [];
  const modules = new Map<string, string>();
  for (const stage of tree) {
    for (const prog of stage.programs) {
      for (const mod of prog.modules) {
        if (modules.has(mod.name)) {
          problems.push(`duplicate module name "${mod.name}" (in ${stage.id} and ${modules.get(mod.name)})`);
        }
        modules.set(mod.name, stage.id);
      }
    }
  }
  for (const stage of tree) {
    for (const prog of stage.programs) {
      for (const mod of prog.modules) {
        for (const req of mod.req ?? []) {
          if (!modules.has(req)) problems.push(`"${mod.name}" requires unknown module "${req}"`);
          if (req === mod.name) problems.push(`"${mod.name}" requires itself`);
        }
      }
    }
  }
  return problems;
}

/** Finds a cycle among module prerequisites, or null. Returns module names along the cycle. */
export function findPrerequisiteCycle(tree: TreeStage[]): string[] | null {
  const reqs = new Map<string, string[]>();
  for (const s of tree)
    for (const p of s.programs) for (const m of p.modules) reqs.set(m.name, m.req ?? []);
  const state = new Map<string, 1 | 2>(); // 1 = on the stack, 2 = done
  const stack: string[] = [];
  const visit = (name: string): string[] | null => {
    if (state.get(name) === 2) return null;
    if (state.get(name) === 1) return [...stack.slice(stack.indexOf(name)), name];
    state.set(name, 1);
    stack.push(name);
    for (const r of reqs.get(name) ?? []) {
      const found = reqs.has(r) ? visit(r) : null;
      if (found) return found;
    }
    stack.pop();
    state.set(name, 2);
    return null;
  };
  for (const name of reqs.keys()) {
    const found = visit(name);
    if (found) return found;
  }
  return null;
}

/** Joins the tree to the ledger. Throws if any node has no id: run syncRegistry first. */
export function resolveTree(tree: TreeStage[], registry: Registry): ResolvedStage[] {
  const id = (key: string): string => {
    const v = registry.ids[key];
    if (!v) throw new Error(`no stable id for ${key}; run the registry sync`);
    return v;
  };
  const moduleIdByName = new Map<string, string>();
  for (const s of tree)
    for (const p of s.programs) for (const m of p.modules) moduleIdByName.set(m.name, id(moduleKey(m)));

  return tree.map((stage, stageIndex) => ({
    id: id(stageKey(stage)),
    key: stage.id,
    name: stage.name,
    ages: stage.ages,
    color: stage.color,
    blurb: stage.blurb,
    order: stageIndex,
    programmes: stage.programs.map((prog, progIndex) => ({
      id: id(programmeKey(stage, prog)),
      name: prog.name,
      order: progIndex,
      modules: prog.modules.map((mod, modIndex) => {
        const keys = lessonKeys(mod);
        return {
          id: id(moduleKey(mod)),
          name: mod.name,
          order: modIndex,
          requires: (mod.req ?? [])
            .map((r) => moduleIdByName.get(r))
            .filter((v): v is string => !!v && v !== id(moduleKey(mod))),
          lessons: mod.lessons.map((lesson, i) => {
            const spec = typeof lesson === "string" ? { t: lesson } : lesson;
            return {
              id: id(keys[i]!),
              title: spec.t,
              order: i,
              go: "go" in spec ? spec.go : undefined,
              sim: "sim" in spec ? spec.sim : undefined,
              pedia: "pedia" in spec ? spec.pedia : undefined,
            };
          }),
        };
      }),
    })),
  }));
}
