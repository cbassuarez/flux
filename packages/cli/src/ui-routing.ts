export interface UiRoutingInput {
  stdoutIsTTY: boolean;
  stdinIsTTY?: boolean;
  json: boolean;
  noUi: boolean;
  env: NodeJS.ProcessEnv;
}

export function shouldLaunchUi(input: UiRoutingInput): boolean {
  const envNoUi = input.env.FLUX_NO_UI === "1";
  const stdinOk = input.stdinIsTTY !== false;
  return Boolean(input.stdoutIsTTY && stdinOk && !input.json && !input.noUi && !envNoUi);
}
