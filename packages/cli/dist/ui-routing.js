export function shouldLaunchUi(input) {
    const envNoUi = input.env.FLUX_NO_UI === "1";
    const stdinOk = input.stdinIsTTY !== false;
    return Boolean(input.stdoutIsTTY && stdinOk && !input.json && !input.noUi && !envNoUi);
}
