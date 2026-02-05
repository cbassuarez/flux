import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { color } from "../theme/index.js";
export function NewWizardScreen({ width, step, stepIndex, stepsCount, values, selectedIndex, created, openChoice, outputDir, debug, }) {
    if (created) {
        return (_jsxs(Card, { title: "Document created", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: [_jsx(Text, { color: color.muted, children: created.docPath }), _jsx(Text, { color: color.fg, children: "Open viewer now?" }), _jsxs(Text, { color: openChoice === 0 ? color.fg : color.muted, children: [openChoice === 0 ? ">" : " ", " Yes"] }), _jsxs(Text, { color: openChoice === 1 ? color.fg : color.muted, children: [openChoice === 1 ? ">" : " ", " No"] }), _jsx(Text, { color: color.muted, children: "Enter to confirm \u00B7 Esc to close" })] }));
    }
    if (!step) {
        return (_jsx(Card, { title: "New document", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: _jsx(Text, { color: color.muted, children: "Loading wizard\u2026" }) }));
    }
    if (step.kind === "summary") {
        const title = values.template;
        const outputPath = outputDir ? path.join(outputDir, `${title}.flux`) : `${title}.flux`;
        return (_jsxs(Card, { title: "Summary", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: [_jsxs(Text, { color: color.muted, children: ["Template: ", values.template] }), _jsxs(Text, { color: color.muted, children: ["Page: ", values.page] }), _jsxs(Text, { color: color.muted, children: ["Theme: ", values.theme] }), _jsxs(Text, { color: color.muted, children: ["Fonts: ", values.fonts] }), _jsxs(Text, { color: color.muted, children: ["Fallback: ", values.fontFallback] }), _jsxs(Text, { color: color.muted, children: ["Assets: ", values.assets ? "yes" : "no"] }), _jsxs(Text, { color: color.muted, children: ["Chapters: ", values.chaptersEnabled ? values.chapters : "no"] }), _jsxs(Text, { color: color.muted, children: ["Live: ", values.live ? "yes" : "no"] }), _jsxs(Text, { color: color.muted, children: ["Output: ", outputPath] }), _jsx(Text, { color: color.muted, children: "Enter to create \u00B7 Backspace to edit \u00B7 Esc to cancel" })] }));
    }
    return (_jsxs(Card, { title: "New document", meta: `${step.label} ${stepIndex + 1}/${stepsCount}`, accent: true, ruleWidth: width - 6, debug: debug, children: [_jsx(Box, { flexDirection: "column", gap: 1, children: step.options.map((opt, idx) => {
                    const selected = idx === selectedIndex;
                    return (_jsxs(Text, { color: selected ? color.fg : color.muted, children: [selected ? ">" : " ", " ", opt.label, " ", opt.hint ? `· ${opt.hint}` : ""] }, `${step.label}-${opt.label}`));
                }) }), _jsx(Text, { color: color.muted, children: "Enter to continue \u00B7 Backspace to go back \u00B7 Esc to cancel" })] }));
}
//# sourceMappingURL=NewWizardScreen.js.map