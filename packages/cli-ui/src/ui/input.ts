const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

export function isPrintableInput(input?: string): input is string {
  return Boolean(input) && !CONTROL_CHARS.test(input as string);
}

export function sanitizePrintableInput(input?: string) {
  return isPrintableInput(input) ? input : "";
}

export function hasControlChars(input?: string) {
  return Boolean(input) && CONTROL_CHARS.test(input as string);
}
