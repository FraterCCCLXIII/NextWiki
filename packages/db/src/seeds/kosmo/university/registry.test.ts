import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyRegistry,
  findPrerequisiteCycle,
  kindOfId,
  resolveTree,
  syncRegistry,
  validateTree,
  type TreeStage,
} from "./registry.js";

const tree = (): TreeStage[] => [
  {
    id: "primary",
    name: "Primary",
    programs: [
      {
        name: "Sky",
        modules: [
          { name: "Moon", req: [], lessons: ["Phases", { t: "Craters", pedia: "Moon" }, "Phases"] },
          { name: "Tides", req: ["Moon"], lessons: ["Why tides"] },
        ],
      },
    ],
  },
];

test("ids are assigned once and never change", () => {
  const first = syncRegistry(tree(), emptyRegistry());
  assert.equal(first.added.length, 1 + 1 + 2 + 4);
  const again = syncRegistry(tree(), first.registry);
  assert.equal(again.added.length, 0);
  assert.deepEqual(again.registry.ids, first.registry.ids);
});

test("new nodes get new ids and old ones are untouched", () => {
  const first = syncRegistry(tree(), emptyRegistry());
  const grown = tree();
  grown[0]!.programs[0]!.modules.unshift({ name: "Sun", req: [], lessons: ["Sunspots"] });
  const next = syncRegistry(grown, first.registry);
  assert.equal(next.registry.ids["mod|Moon"], first.registry.ids["mod|Moon"]);
  assert.equal(next.registry.ids["mod|Sun"], "KU-M0003");
});

test("a renamed node is reported as orphaned, not deleted", () => {
  const first = syncRegistry(tree(), emptyRegistry());
  const renamed = tree();
  renamed[0]!.programs[0]!.modules[0]!.name = "The Moon";
  renamed[0]!.programs[0]!.modules[1]!.req = ["The Moon"];
  const next = syncRegistry(renamed, first.registry);
  assert.ok(next.orphaned.includes("mod|Moon"));
  assert.ok(next.registry.ids["mod|Moon"]);
});

test("repeated lesson titles in one module stay distinct", () => {
  const { registry } = syncRegistry(tree(), emptyRegistry());
  assert.ok(registry.ids["les|Moon|Phases"]);
  assert.ok(registry.ids["les|Moon|Phases#2"]);
  assert.notEqual(registry.ids["les|Moon|Phases"], registry.ids["les|Moon|Phases#2"]);
});

test("prerequisites resolve to stable module ids", () => {
  const { registry } = syncRegistry(tree(), emptyRegistry());
  const [stage] = resolveTree(tree(), registry);
  const [moon, tides] = stage!.programmes[0]!.modules;
  assert.deepEqual(tides!.requires, [moon!.id]);
  assert.equal(kindOfId(moon!.id), "module");
  assert.equal(moon!.lessons[1]!.pedia, "Moon");
});

test("validation catches duplicate modules, unknown and cyclic prerequisites", () => {
  const dup = tree();
  dup[0]!.programs[0]!.modules.push({ name: "Moon", req: [], lessons: [] });
  assert.match(validateTree(dup).join(), /duplicate module/);

  const unknown = tree();
  unknown[0]!.programs[0]!.modules[1]!.req = ["Nope"];
  assert.match(validateTree(unknown).join(), /unknown module/);

  const cyc = tree();
  cyc[0]!.programs[0]!.modules[0]!.req = ["Tides"];
  assert.deepEqual(findPrerequisiteCycle(cyc), ["Moon", "Tides", "Moon"]);
  assert.equal(findPrerequisiteCycle(tree()), null);
});
