import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatYear, instant, interval, precisionForYear } from "./time.js";

describe("time axis", () => {
  it("holds a point and a span on one numeric coordinate", () => {
    assert.deepEqual(instant(1969), {
      start: 1969,
      end: null,
      precisionYears: 1,
      kind: "instant",
    });
    const mesozoic = interval(-252.2e6, -66e6);
    assert.equal(mesozoic.start, -252.2e6);
    assert.equal(mesozoic.end, -66e6);
    assert.equal(mesozoic.kind, "interval");
    assert.ok(mesozoic.precisionYears > 0);
  });

  it("orders bounds even when the source gives them backwards", () => {
    const t = interval(100, -100);
    assert.equal(t.start, -100);
    assert.equal(t.end, 100);
  });

  it("derives precision from how coarse the year is", () => {
    assert.equal(precisionForYear(1969), 1);
    assert.equal(precisionForYear(-3300), 1);
    assert.equal(precisionForYear(-3300000), 100000);
    assert.equal(precisionForYear(13.8e9), 1e8);
  });

  it("formats BCE and deep time without inventing precision", () => {
    assert.equal(formatYear(1969), "1969 CE");
    assert.equal(formatYear(-44), "44 BCE");
    assert.equal(formatYear(-541e6), "541 Ma");
    assert.equal(formatYear(13.8e9), "13.8 Ga");
  });

  it("keeps year 0 as 1 BCE rather than printing a year that never existed", () => {
    assert.equal(formatYear(0), "1 BCE");
  });
});
