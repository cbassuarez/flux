export type DiagnosticsSummary = {
  pass: number;
  warn: number;
  fail: number;
};

export type DiagnosticItem = {
  level: "pass" | "warn" | "fail";
  message: string;
  code?: string;
  file?: string;
  range?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
  excerpt?: {
    line: number;
    text: string;
    caret: string;
  };
  suggestion?: string;
  nodeId?: string;
  location?: string;
  raw?: unknown;
};

function normalizeLevel(value: unknown): "pass" | "warn" | "fail" {
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (["ok", "pass", "info", "success"].includes(lowered)) return "pass";
    if (["warn", "warning"].includes(lowered)) return "warn";
    if (["fail", "error", "fatal"].includes(lowered)) return "fail";
  }
  return "pass";
}

function toSummary(pass: number, warn: number, fail: number): DiagnosticsSummary {
  return { pass, warn, fail };
}

export function extractDiagnosticsSummary(raw?: unknown): DiagnosticsSummary {
  if (!raw) return toSummary(0, 0, 0);
  if (typeof raw === "object" && raw) {
    const record = raw as Record<string, unknown>;
    if (record.summary && typeof record.summary === "object") {
      const summary = record.summary as Record<string, unknown>;
      return toSummary(
        Number(summary.pass ?? 0),
        Number(summary.warn ?? 0),
        Number(summary.fail ?? 0)
      );
    }
    if (typeof record.pass === "number" || typeof record.warn === "number" || typeof record.fail === "number") {
      return toSummary(Number(record.pass ?? 0), Number(record.warn ?? 0), Number(record.fail ?? 0));
    }
  }

  const items = extractDiagnosticsItems(raw);
  if (!items.length) return toSummary(0, 0, 0);

  return items.reduce(
    (acc, item) => {
      acc[item.level] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 } as DiagnosticsSummary
  );
}

export function extractDiagnosticsItems(raw?: unknown): DiagnosticItem[] {
  if (!raw) return [];
  const source = (() => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object" && raw) {
      const record = raw as Record<string, unknown>;
      return (record.items ?? record.diagnostics ?? record.entries ?? record.messages) as unknown;
    }
    return null;
  })();

  if (!Array.isArray(source)) return [];

  return source.map((item, index) => {
    if (typeof item === "string") {
      return { level: "warn", message: item, raw: item } as DiagnosticItem;
    }
    if (!item || typeof item !== "object") {
      return { level: "warn", message: `Diagnostic ${index + 1}`, raw: item } as DiagnosticItem;
    }
    const record = item as Record<string, unknown>;
    return {
      level: normalizeLevel(record.level ?? record.severity ?? record.status),
      message:
        (typeof record.message === "string" && record.message) ||
        (typeof record.msg === "string" && record.msg) ||
        (typeof record.description === "string" && record.description) ||
        `Diagnostic ${index + 1}`,
      code: typeof record.code === "string" ? record.code : typeof record.rule === "string" ? record.rule : undefined,
      file:
        typeof record.file === "string"
          ? record.file
          : typeof record.path === "string"
            ? record.path
            : undefined,
      range: typeof record.range === "object" ? (record.range as DiagnosticItem["range"]) : undefined,
      excerpt: typeof record.excerpt === "object" ? (record.excerpt as DiagnosticItem["excerpt"]) : undefined,
      suggestion: typeof record.suggestion === "string" ? record.suggestion : undefined,
      nodeId: typeof record.nodeId === "string" ? record.nodeId : undefined,
      location:
        typeof record.location === "string"
          ? record.location
          : typeof record.path === "string"
            ? record.path
            : undefined,
      raw: record
    };
  });
}
