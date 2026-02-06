import type { RefreshPolicy } from "@flux-lang/core";
import type { AssetItem } from "./docService";

export type EditorRuntimeInputs = {
  seed: number;
  timeSec: number;
  docstep: number;
};

export type SlotGeneratorSpec =
  | { kind: "literal"; value: string }
  | { kind: "choose"; values: string[] }
  | { kind: "cycle"; values: string[]; period?: number }
  | { kind: "assetsPick"; tags: string[]; bank?: string }
  | { kind: "poisson"; ratePerSec: number }
  | { kind: "at"; times: number[]; values: string[] }
  | { kind: "every"; amount: number; unit?: string; values?: string[] }
  | { kind: "unknown"; summary: string };

export type TransitionEase = "in" | "out" | "inOut" | "linear";
export type TransitionDirection = "left" | "right" | "up" | "down";

export type SlotTransitionSpec =
  | { kind: "none" }
  | { kind: "appear" }
  | { kind: "fade"; durationMs: number; ease?: TransitionEase }
  | { kind: "wipe"; direction: TransitionDirection; durationMs: number; ease?: TransitionEase }
  | { kind: "flash"; durationMs: number };

export type SlotRefreshPolicy =
  | { kind: "never" }
  | { kind: "docstep" }
  | { kind: "every"; amount: number; unit: string; phase?: number; phaseUnit?: string }
  | { kind: "at"; time: number; unit?: string }
  | { kind: "atEach"; times: number[]; unit?: string }
  | { kind: "poisson"; ratePerSec: number }
  | { kind: "chance"; p: number; every?: { kind: "docstep" } | { kind: "every"; amount: number; unit: string; phase?: number } }
  | ({ kind: "onLoad" } & Record<string, unknown>)
  | ({ kind: "onDocstep" } & Record<string, unknown>)
  | ({ kind: "every" } & Record<string, unknown>)
  | ({ kind: "never" } & Record<string, unknown>);

export type SlotValue = { kind: "text"; text: string } | { kind: "asset"; asset: AssetItem | null; label: string };

export type SlotSimulationRow = {
  bucket: number;
  timeSec: number;
  value: string;
  hash: string;
  eventIndex: number;
  valueKind: SlotValue["kind"];
  assetId?: string;
};

export type SlotPlaybackState = {
  bucket: number;
  eventIndex: number;
  value: SlotValue;
  hash: string;
};

const DEFAULT_BUCKET_SEC = 0.25;
const MAX_EVENT_SCAN = 10000;

export function parseDurationString(value: string): { amount: number; unit: string; seconds: number } | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)\s*(ms|s|m)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2].toLowerCase();
  const seconds = unit === "ms" ? amount / 1000 : unit === "m" ? amount * 60 : amount;
  return { amount, unit, seconds };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0s";
  if (seconds < 1) {
    const ms = Math.round(seconds * 1000);
    return `${ms}ms`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  const rounded = Math.round(seconds * 100) / 100;
  return `${rounded}s`;
}

export function normalizeRefreshPolicy(policy: SlotRefreshPolicy | RefreshPolicy | undefined): SlotRefreshPolicy {
  if (!policy) return { kind: "docstep" };
  if (typeof policy === "string") {
    const parsed = parseRefreshPolicyString(policy);
    return parsed ?? { kind: "docstep" };
  }
  const rawKind = (policy as any).kind;
  if (rawKind === "onLoad") return { kind: "never" };
  if (rawKind === "onDocstep") return { kind: "docstep" };
  if (rawKind === "docstep") return { kind: "docstep" };
  if (rawKind === "never") return { kind: "never" };
  if (rawKind === "every") {
    const amount = Number((policy as any).amount ?? 1);
    const unit = String((policy as any).unit ?? "s");
    const phase = (policy as any).phase;
    const phaseUnit = (policy as any).phaseUnit;
    return { kind: "every", amount: Number.isFinite(amount) ? amount : 1, unit, phase, phaseUnit };
  }
  if (rawKind === "at") {
    const time = Number((policy as any).time ?? (policy as any).times?.[0] ?? 0);
    return { kind: "at", time: Number.isFinite(time) ? time : 0, unit: (policy as any).unit };
  }
  if (rawKind === "atEach") {
    const times = Array.isArray((policy as any).times) ? (policy as any).times.map(Number) : [];
    return { kind: "atEach", times: times.filter((t: number) => Number.isFinite(t)), unit: (policy as any).unit };
  }
  if (rawKind === "poisson") {
    const ratePerSec = Number((policy as any).ratePerSec ?? 0);
    return { kind: "poisson", ratePerSec: Number.isFinite(ratePerSec) ? ratePerSec : 0 };
  }
  if (rawKind === "chance") {
    const p = Number((policy as any).p ?? (policy as any).probability ?? 0);
    const every = (policy as any).every;
    return {
      kind: "chance",
      p: Number.isFinite(p) ? p : 0,
      every: every && typeof every === "object" ? (every as any) : undefined,
    };
  }
  return { kind: "docstep" };
}

export function parseRefreshPolicyString(value: string): SlotRefreshPolicy | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "docstep" || trimmed === "onDocstep") return { kind: "docstep" };
  if (trimmed === "onLoad") return { kind: "never" };
  if (trimmed === "never") return { kind: "never" };

  const everyMatch = trimmed.match(/^every\(([^,\)]+)(?:,\s*([^\)]+))?\)$/i);
  if (everyMatch) {
    const duration = parseDurationString(everyMatch[1]);
    if (!duration) return null;
    const phase = everyMatch[2] ? parseDurationString(everyMatch[2]) : null;
    return { kind: "every", amount: duration.amount, unit: duration.unit, phase: phase?.amount, phaseUnit: phase?.unit };
  }

  const atMatch = trimmed.match(/^at\(([^\)]+)\)$/i);
  if (atMatch) {
    const time = parseDurationString(atMatch[1]);
    if (!time) return null;
    return { kind: "at", time: time.amount, unit: time.unit };
  }

  const atEachMatch = trimmed.match(/^atEach\((.+)\)$/i);
  if (atEachMatch) {
    const raw = atEachMatch[1].replace(/[\[\]]/g, "");
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    const parsed = parts.map((part) => parseDurationString(part)).filter(Boolean) as Array<{
      amount: number;
      unit: string;
      seconds: number;
    }>;
    if (!parsed.length) return null;
    return { kind: "atEach", times: parsed.map((item) => item.amount), unit: parsed[0].unit };
  }

  const poissonMatch = trimmed.match(/^poisson\(([^\)]+)\)$/i);
  if (poissonMatch) {
    const rate = Number(poissonMatch[1]);
    if (!Number.isFinite(rate)) return null;
    return { kind: "poisson", ratePerSec: rate };
  }

  const chanceMatch = trimmed.match(/^chance\(([^,\)]+)(?:,\s*([^\)]+))?\)$/i);
  if (chanceMatch) {
    const p = Number(chanceMatch[1]);
    if (!Number.isFinite(p)) return null;
    const everyRaw = chanceMatch[2]?.trim();
    if (!everyRaw || everyRaw === "docstep") {
      return { kind: "chance", p, every: { kind: "docstep" } };
    }
    const duration = parseDurationString(everyRaw);
    if (!duration) return null;
    return { kind: "chance", p, every: { kind: "every", amount: duration.amount, unit: duration.unit } };
  }

  return null;
}

export function formatRefreshPolicy(policy: SlotRefreshPolicy | RefreshPolicy | undefined): string {
  if (!policy) return "docstep";
  const normalized = normalizeRefreshPolicy(policy as SlotRefreshPolicy);
  if (normalized.kind === "never") return "never";
  if (normalized.kind === "docstep") return "docstep";
  if (normalized.kind === "every") {
    const duration = formatDuration(toSeconds(normalized.amount, normalized.unit));
    if (normalized.phase !== undefined) {
      const phase = formatDuration(toSeconds(normalized.phase, normalized.phaseUnit ?? normalized.unit));
      return `every(${duration}, ${phase})`;
    }
    return `every(${duration})`;
  }
  if (normalized.kind === "at") {
    return `at(${formatDuration(toSeconds(normalized.time, normalized.unit ?? "s"))})`;
  }
  if (normalized.kind === "atEach") {
    const times = (normalized.times ?? []).map((time) => formatDuration(toSeconds(time, normalized.unit ?? "s")));
    return `atEach(${times.join(", ")})`;
  }
  if (normalized.kind === "poisson") return `poisson(${normalized.ratePerSec})`;
  if (normalized.kind === "chance") {
    const base = `chance(${normalized.p}`;
    if (!normalized.every || normalized.every.kind === "docstep") return `${base}, docstep)`;
    const duration = formatDuration(toSeconds(normalized.every.amount, normalized.every.unit));
    return `${base}, ${duration})`;
  }
  return "docstep";
}

export function formatTransitionSpec(spec: SlotTransitionSpec | undefined): string {
  if (!spec || spec.kind === "none") return "none";
  if (spec.kind === "appear") return "appear()";
  if (spec.kind === "fade") return `fade(${spec.durationMs}ms, ${spec.ease ?? "linear"})`;
  if (spec.kind === "wipe") return `wipe(${spec.direction}, ${spec.durationMs}ms, ${spec.ease ?? "linear"})`;
  if (spec.kind === "flash") return `flash(${spec.durationMs}ms)`;
  return "none";
}

export function parseTransitionSpec(value: string): SlotTransitionSpec | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "none") return { kind: "none" };
  if (trimmed.startsWith("appear")) return { kind: "appear" };
  const fadeMatch = trimmed.match(/^fade\((\d+)ms(?:,\s*([a-zA-Z]+))?\)$/i);
  if (fadeMatch) {
    return { kind: "fade", durationMs: Number(fadeMatch[1]), ease: (fadeMatch[2] as TransitionEase) ?? "linear" };
  }
  const wipeMatch = trimmed.match(/^wipe\((left|right|up|down),\s*(\d+)ms(?:,\s*([a-zA-Z]+))?\)$/i);
  if (wipeMatch) {
    return {
      kind: "wipe",
      direction: wipeMatch[1] as TransitionDirection,
      durationMs: Number(wipeMatch[2]),
      ease: (wipeMatch[3] as TransitionEase) ?? "linear",
    };
  }
  const flashMatch = trimmed.match(/^flash\((\d+)ms\)$/i);
  if (flashMatch) {
    return { kind: "flash", durationMs: Number(flashMatch[1]) };
  }
  return null;
}

export function filterAssetsByTags(assets: AssetItem[], tags: string[], bank?: string): AssetItem[] {
  const normalizedBank = bank?.trim();
  if (!tags.length && !normalizedBank) return assets;
  return assets.filter((asset) => {
    if (normalizedBank && asset.bankName && asset.bankName !== normalizedBank) return false;
    if (normalizedBank && !asset.bankName) return false;
    return tags.every((tag) => asset.tags.includes(tag));
  });
}

export function computeSlotValue(
  spec: SlotGeneratorSpec | null,
  refresh: SlotRefreshPolicy | RefreshPolicy | undefined,
  runtime: EditorRuntimeInputs,
  slotId: string,
  assets: AssetItem[],
): { value: SlotValue; hash: string; bucket: number; eventIndex: number } {
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  const { bucket, eventIndex } = getEventIndexForRuntime(normalizedRefresh, runtime, slotId, runtime.seed);
  const value = resolveSlotValueForIndex(spec, runtime.seed, slotId, eventIndex, assets);
  return { value, hash: hashSlotValue(value), bucket, eventIndex };
}

export function resolveSlotValueForIndex(
  spec: SlotGeneratorSpec | null,
  seed: number,
  slotId: string,
  eventIndex: number,
  assets: AssetItem[],
): SlotValue {
  if (!spec) return { kind: "text", text: "" };
  if (spec.kind === "literal") return { kind: "text", text: spec.value ?? "" };
  if (spec.kind === "choose") {
    if (!spec.values.length) return { kind: "text", text: "" };
    const index = seededIndex(seed, slotId, eventIndex, spec.values.length);
    return { kind: "text", text: spec.values[index] ?? "" };
  }
  if (spec.kind === "cycle") {
    if (!spec.values.length) return { kind: "text", text: "" };
    const index = Math.abs(eventIndex) % spec.values.length;
    return { kind: "text", text: spec.values[index] ?? "" };
  }
  if (spec.kind === "assetsPick") {
    const candidates = filterAssetsByTags(assets, spec.tags, spec.bank);
    if (!candidates.length) return { kind: "asset", asset: null, label: "" };
    const index = seededIndex(seed, slotId, eventIndex, candidates.length);
    const asset = candidates[index] ?? candidates[0];
    return { kind: "asset", asset, label: asset?.name ?? asset?.path ?? "" };
  }
  if (spec.kind === "poisson") {
    const rate = Math.max(0, spec.ratePerSec);
    const chance = Math.min(1, rate / 2);
    const random = seededFloat(seed, slotId, eventIndex, 97);
    return { kind: "text", text: random < chance ? "event" : "—" };
  }
  if (spec.kind === "at") {
    if (!spec.values.length) return { kind: "text", text: "" };
    const index = seededIndex(seed, slotId, eventIndex, spec.values.length);
    return { kind: "text", text: spec.values[index] ?? "" };
  }
  if (spec.kind === "every") {
    if (spec.values?.length) {
      const index = seededIndex(seed, slotId, eventIndex, spec.values.length);
      return { kind: "text", text: spec.values[index] ?? "" };
    }
    return { kind: "text", text: "" };
  }
  return { kind: "text", text: "" };
}

export function simulateSlotChanges(
  spec: SlotGeneratorSpec | null,
  refresh: SlotRefreshPolicy | RefreshPolicy | undefined,
  runtime: EditorRuntimeInputs,
  slotId: string,
  assets: AssetItem[],
  count = 12,
): SlotSimulationRow[] {
  if (!spec || count <= 0) return [];
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  const rows: SlotSimulationRow[] = [];
  let cursorRuntime = { ...runtime };
  const isDocstepChance = normalizedRefresh.kind === "chance" && (!normalizedRefresh.every || normalizedRefresh.every.kind === "docstep");

  for (let i = 0; i < count; i += 1) {
    const nextEvent = getNextSlotEvent(normalizedRefresh, cursorRuntime, slotId, runtime.seed);
    if (!nextEvent) break;
    const value = resolveSlotValueForIndex(spec, runtime.seed, slotId, nextEvent.eventIndex, assets);
    rows.push({
      bucket: nextEvent.bucket,
      timeSec: nextEvent.timeSec,
      value: value.kind === "asset" ? value.label : value.text,
      hash: hashSlotValue(value),
      eventIndex: nextEvent.eventIndex,
      valueKind: value.kind,
      assetId: value.kind === "asset" ? value.asset?.id : undefined,
    });
    cursorRuntime = {
      ...cursorRuntime,
      timeSec: nextEvent.timeSec,
      docstep: normalizedRefresh.kind === "docstep" || isDocstepChance ? nextEvent.bucket : cursorRuntime.docstep,
    };
  }

  return rows;
}

export function advanceSlotPlaybackState(
  prev: SlotPlaybackState | undefined,
  spec: SlotGeneratorSpec | null,
  refresh: SlotRefreshPolicy | RefreshPolicy | undefined,
  runtime: EditorRuntimeInputs,
  slotId: string,
  assets: AssetItem[],
): { state: SlotPlaybackState; changed: boolean } {
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  const bucket = getRefreshBucket(normalizedRefresh, runtime);
  if (!spec) {
    const value: SlotValue = { kind: "text", text: "" };
    const state = { bucket, eventIndex: 0, value, hash: hashSlotValue(value) };
    return { state, changed: !prev || prev.hash !== state.hash };
  }

  if (!prev) {
    const { eventIndex } = getEventIndexForRuntime(normalizedRefresh, runtime, slotId, runtime.seed);
    const value = resolveSlotValueForIndex(spec, runtime.seed, slotId, eventIndex, assets);
    const hash = hashSlotValue(value);
    return { state: { bucket, eventIndex, value, hash }, changed: true };
  }

  if (normalizedRefresh.kind === "poisson" || normalizedRefresh.kind === "chance") {
    let eventIndex = prev.eventIndex;
    if (bucket > prev.bucket) {
      for (let current = prev.bucket + 1; current <= bucket; current += 1) {
        if (eventOccurs(normalizedRefresh, slotId, runtime.seed, current)) {
          eventIndex += 1;
        }
      }
    }
    const value = resolveSlotValueForIndex(spec, runtime.seed, slotId, eventIndex, assets);
    const hash = hashSlotValue(value);
    const state = { bucket, eventIndex, value, hash };
    return { state, changed: hash !== prev.hash };
  }

  if (bucket === prev.bucket) {
    return { state: prev, changed: false };
  }

  const eventIndex = bucket;
  const value = resolveSlotValueForIndex(spec, runtime.seed, slotId, eventIndex, assets);
  const hash = hashSlotValue(value);
  const state = { bucket, eventIndex, value, hash };
  return { state, changed: hash !== prev.hash };
}

export function getNextSlotEvent(
  refresh: SlotRefreshPolicy,
  runtime: EditorRuntimeInputs,
  slotId: string,
  seed: number,
): { bucket: number; timeSec: number; eventIndex: number } | null {
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  if (normalizedRefresh.kind === "never") return null;

  if (normalizedRefresh.kind === "docstep") {
    const bucket = Math.floor(runtime.docstep) + 1;
    return { bucket, timeSec: runtime.timeSec, eventIndex: bucket };
  }

  if (normalizedRefresh.kind === "every") {
    const durationSec = toSeconds(normalizedRefresh.amount, normalizedRefresh.unit);
    const phaseSec = normalizedRefresh.phase !== undefined ? toSeconds(normalizedRefresh.phase, normalizedRefresh.phaseUnit ?? normalizedRefresh.unit) : 0;
    const bucket = Math.floor((runtime.timeSec - phaseSec) / durationSec) + 1;
    const timeSec = phaseSec + bucket * durationSec;
    return { bucket, timeSec, eventIndex: bucket };
  }

  if (normalizedRefresh.kind === "at") {
    const timeSec = toSeconds(normalizedRefresh.time, normalizedRefresh.unit ?? "s");
    if (runtime.timeSec >= timeSec) return null;
    return { bucket: 1, timeSec, eventIndex: 1 };
  }

  if (normalizedRefresh.kind === "atEach") {
    const times = [...normalizedRefresh.times].sort((a, b) => a - b).map((time) => toSeconds(time, normalizedRefresh.unit ?? "s"));
    const upcoming = times.findIndex((time) => time > runtime.timeSec);
    if (upcoming < 0) return null;
    const bucket = upcoming + 1;
    return { bucket, timeSec: times[upcoming], eventIndex: bucket };
  }

  if (normalizedRefresh.kind === "poisson" || normalizedRefresh.kind === "chance") {
    const isDocstepChance = normalizedRefresh.kind === "chance" && (!normalizedRefresh.every || normalizedRefresh.every.kind === "docstep");
    const bucketSize = getBucketSize(normalizedRefresh);
    const currentBucket = isDocstepChance ? Math.floor(runtime.docstep) : Math.floor(runtime.timeSec / bucketSize);
    const { eventIndex: currentEventIndex } = getEventIndexForRuntime(normalizedRefresh, runtime, slotId, seed);
    let nextEventIndex = currentEventIndex;
    for (let bucket = currentBucket + 1; bucket < currentBucket + MAX_EVENT_SCAN; bucket += 1) {
      if (eventOccurs(normalizedRefresh, slotId, seed, bucket)) {
        nextEventIndex += 1;
        return { bucket, timeSec: isDocstepChance ? runtime.timeSec : bucket * bucketSize, eventIndex: nextEventIndex };
      }
    }
    return null;
  }

  return null;
}

export function getEventIndexForRuntime(
  refresh: SlotRefreshPolicy,
  runtime: EditorRuntimeInputs,
  slotId: string,
  seed: number,
): { bucket: number; eventIndex: number } {
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  const bucket = getRefreshBucket(normalizedRefresh, runtime);
  if (normalizedRefresh.kind === "poisson" || normalizedRefresh.kind === "chance") {
    const eventIndex = countEvents(normalizedRefresh, slotId, seed, bucket);
    return { bucket, eventIndex };
  }
  return { bucket, eventIndex: bucket };
}

export function getRefreshBucket(refresh: SlotRefreshPolicy, runtime: EditorRuntimeInputs): number {
  const normalizedRefresh = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  if (normalizedRefresh.kind === "never") return 0;
  if (normalizedRefresh.kind === "docstep") return Math.floor(runtime.docstep);
  if (normalizedRefresh.kind === "every") {
    const durationSec = toSeconds(normalizedRefresh.amount, normalizedRefresh.unit);
    const phaseSec = normalizedRefresh.phase !== undefined ? toSeconds(normalizedRefresh.phase, normalizedRefresh.phaseUnit ?? normalizedRefresh.unit) : 0;
    if (durationSec <= 0) return 0;
    return Math.floor((runtime.timeSec - phaseSec) / durationSec);
  }
  if (normalizedRefresh.kind === "at") {
    const timeSec = toSeconds(normalizedRefresh.time, normalizedRefresh.unit ?? "s");
    return runtime.timeSec >= timeSec ? 1 : 0;
  }
  if (normalizedRefresh.kind === "atEach") {
    const times = [...normalizedRefresh.times].sort((a, b) => a - b).map((time) => toSeconds(time, normalizedRefresh.unit ?? "s"));
    return times.filter((time) => runtime.timeSec >= time).length;
  }
  if (normalizedRefresh.kind === "poisson") {
    const bucketSize = getBucketSize(normalizedRefresh);
    if (bucketSize <= 0) return 0;
    return Math.floor(runtime.timeSec / bucketSize);
  }
  if (normalizedRefresh.kind === "chance") {
    const isDocstep = !normalizedRefresh.every || normalizedRefresh.every.kind === "docstep";
    if (isDocstep) return Math.floor(runtime.docstep);
    const bucketSize = getBucketSize(normalizedRefresh);
    if (bucketSize <= 0) return 0;
    return Math.floor(runtime.timeSec / bucketSize);
  }
  return 0;
}

export function hashSlotValue(value: SlotValue): string {
  const base = value.kind === "asset" ? `asset:${value.asset?.id ?? value.asset?.path ?? ""}` : `text:${value.text}`;
  const hashed = hashNumber(hashString(base));
  return Math.abs(hashed).toString(16).padStart(6, "0");
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function hashNumber(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x;
}

function toSeconds(amount: number, unit: string): number {
  if (!Number.isFinite(amount)) return 0;
  const normalized = unit.toLowerCase();
  if (normalized === "ms") return amount / 1000;
  if (normalized === "m") return amount * 60;
  return amount;
}

function seededFloat(seed: number, slotId: string, bucketIndex: number, salt: number): number {
  const base =
    hashString(slotId) +
    Math.imul(seed + salt, 0x9e3779b1) +
    Math.imul(bucketIndex + salt, 0x85ebca6b);
  const hashed = hashNumber(base);
  return (hashed >>> 0) / 4294967295;
}

function seededIndex(seed: number, slotId: string, bucketIndex: number, length: number): number {
  if (length <= 0) return 0;
  const random = seededFloat(seed, slotId, bucketIndex, 11);
  return Math.min(length - 1, Math.floor(random * length));
}

function eventOccurs(refresh: SlotRefreshPolicy, slotId: string, seed: number, bucketIndex: number): boolean {
  const normalized = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  if (normalized.kind === "poisson") {
    const bucketSize = getBucketSize(normalized);
    const p = 1 - Math.exp(-Math.max(0, normalized.ratePerSec) * bucketSize);
    return seededFloat(seed, slotId, bucketIndex, 31) < p;
  }
  if (normalized.kind === "chance") {
    const p = Math.max(0, Math.min(1, normalized.p));
    return seededFloat(seed, slotId, bucketIndex, 41) < p;
  }
  return false;
}

function countEvents(refresh: SlotRefreshPolicy, slotId: string, seed: number, bucket: number): number {
  if (bucket <= 0) return 0;
  let count = 0;
  const limit = Math.min(bucket, MAX_EVENT_SCAN);
  for (let i = 0; i <= limit; i += 1) {
    if (eventOccurs(refresh, slotId, seed, i)) count += 1;
  }
  return count;
}

function getBucketSize(refresh: SlotRefreshPolicy): number {
  const normalized = normalizeRefreshPolicy(refresh as SlotRefreshPolicy);
  if (normalized.kind === "poisson") return DEFAULT_BUCKET_SEC;
  if (normalized.kind === "chance") {
    if (!normalized.every || normalized.every.kind === "docstep") return DEFAULT_BUCKET_SEC;
    return toSeconds(normalized.every.amount, normalized.every.unit);
  }
  return DEFAULT_BUCKET_SEC;
}
