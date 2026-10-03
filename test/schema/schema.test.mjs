import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixtureDataset } from "../../src/lib/pit-store.mjs";
import { validateAgainstSchema, loadSchema } from "../../src/lib/schema-validate.mjs";

test("fixtures validate against schemas and forbid generic date", () => {
  const ds = loadFixtureDataset();
  assert.ok(ds.meta.session_dates.length >= 60);
  for (const id of ds.meta.security_ids) {
    const b = ds.securities[id];
    assert.ok(!("date" in b.security));
    for (const bar of b.bars) {
      assert.ok(!("date" in bar));
      assert.ok(bar.trading_date);
      assert.ok(bar.available_at);
    }
  }
});

test("adversarial object with date field fails validation", () => {
  const schema = loadSchema("bar.schema.json");
  const errors = validateAgainstSchema(
    schema,
    {
      date: "2024-01-01",
      trading_date: "2024-01-01",
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
      available_at: "2024-01-01T15:30:00+05:30",
      source_timestamp_type: "derived",
    },
    "bad",
  );
  assert.ok(errors.some((e) => e.includes("date")));
});
