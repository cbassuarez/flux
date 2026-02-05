export function okResult(data, logs = [], warnings = []) {
    return { ok: true, data, logs: logs.length ? logs : undefined, warnings: warnings.length ? warnings : undefined };
}
export function errorResult(message, code, detail) {
    return { ok: false, error: { message, code, detail } };
}
//# sourceMappingURL=types.js.map