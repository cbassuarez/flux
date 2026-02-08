require("ts-node/register");

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { channelFromVersion, isCanaryVersion, versionFromTag } = require("../version.ts");

test("tag v0.2.1 resolves to stable", () => {
  const version = versionFromTag("v0.2.1");
  assert.equal(version, "0.2.1");
  assert.equal(channelFromVersion(version), "stable");
  assert.equal(isCanaryVersion(version), false);
});

test("tag v0.2.1-canary.abc123 resolves to canary", () => {
  const version = versionFromTag("v0.2.1-canary.abc123");
  assert.equal(version, "0.2.1-canary.abc123");
  assert.equal(channelFromVersion(version), "canary");
  assert.equal(isCanaryVersion(version), true);
});
