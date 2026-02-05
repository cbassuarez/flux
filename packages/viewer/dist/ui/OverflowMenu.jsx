import { toolbarButton } from "./ToolbarButton.js";
export const renderOverflowMenu = () => {
    const trigger = toolbarButton({
        id: "viewer-overflow",
        label: "More",
        icon: "⋯",
        title: "More options",
        ariaLabel: "More options",
        iconOnly: true,
        attributes: {
            "aria-haspopup": "menu",
            "aria-expanded": "false",
        },
    });
    return [
        '<div class="toolbar-overflow" id="viewer-overflow-wrapper">',
        `  ${trigger}`,
        '  <div class="toolbar-menu" id="viewer-overflow-menu" role="menu" aria-hidden="true">',
        '    <div class="toolbar-menu__section">',
        '      <div class="toolbar-menu__title">Details</div>',
        '      <div class="toolbar-menu__row">',
        '        <span class="toolbar-menu__label">Document</span>',
        '        <span class="toolbar-menu__value" id="viewer-doc-path">—</span>',
        "      </div>",
        '      <div class="toolbar-menu__row">',
        '        <span class="toolbar-menu__label">Seed</span>',
        '        <span class="toolbar-menu__value" id="viewer-seed">0</span>',
        "      </div>",
        "    </div>",
        '    <div class="toolbar-menu__section">',
        '      <div class="toolbar-menu__title">Debug</div>',
        '      <label class="toolbar-menu__toggle">',
        '        <input type="checkbox" id="viewer-debug-slots">',
        '        <span>Show slot outlines</span>',
        "      </label>",
        '      <label class="toolbar-menu__toggle">',
        '        <input type="checkbox" id="viewer-debug-ids">',
        '        <span>Show slot ids</span>',
        "      </label>",
        '      <label class="toolbar-menu__toggle">',
        '        <input type="checkbox" id="viewer-debug-patches">',
        '        <span>Log patch payloads</span>',
        "      </label>",
        "    </div>",
        "  </div>",
        "</div>",
    ].join("\n");
};
//# sourceMappingURL=OverflowMenu.jsx.map