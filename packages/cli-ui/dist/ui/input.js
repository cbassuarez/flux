const CONTROL_CHARS = /[\x00-\x1F\x7F]/;
export function isPrintableInput(input) {
    return Boolean(input) && !CONTROL_CHARS.test(input);
}
export function sanitizePrintableInput(input) {
    return isPrintableInput(input) ? input : "";
}
export function hasControlChars(input) {
    return Boolean(input) && CONTROL_CHARS.test(input);
}
//# sourceMappingURL=input.js.map