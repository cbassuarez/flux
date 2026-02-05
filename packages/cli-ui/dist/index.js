import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "ink";
import { App } from "./ui/app.js";
export async function runCliUi(options) {
    const { waitUntilExit } = render(_jsx(App, { ...options }), { exitOnCtrlC: true });
    await waitUntilExit();
}
//# sourceMappingURL=index.js.map