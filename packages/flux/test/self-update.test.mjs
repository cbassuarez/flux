import assert from "node:assert/strict";
import { test } from "node:test";
import { pickVersionFromDistTags } from "../src/self-update.ts";

test("stable uses stable tag when present", () => {
  const version = pickVersionFromDistTags("stable", { stable: "1.2.3", latest: "1.2.2" });
  assert.equal(version, "1.2.3");
});

test("stable falls back to latest when stable missing", () => {
  const version = pickVersionFromDistTags("stable", { latest: "2.0.0" });
  assert.equal(version, "2.0.0");
});

test("canary uses canary tag", () => {
  const version = pickVersionFromDistTags("canary", { canary: "3.0.0-canary.abc123" });
  assert.equal(version, "3.0.0-canary.abc123");
});

test("stable refuses canary version", () => {
  assert.throws(
    () => pickVersionFromDistTags("stable", { stable: "4.0.0-canary.abc123" }),
    /Stable dist-tag resolved to canary version/,
  );
});
