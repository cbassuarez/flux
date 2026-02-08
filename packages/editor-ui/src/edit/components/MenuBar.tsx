import * as Menubar from "@radix-ui/react-menubar";
import { FLUX_TAGLINE, type FluxVersionInfo } from "@flux-lang/brand";
import { FluxBrandHeader } from "@flux-lang/brand/web";
import type { EditorCommand, EditorCommandId } from "../commands/editorCommands";
import { useTheme, type EditorTheme } from "../theme/theme";

type MenuItem =
  | { kind: "command"; id: EditorCommandId }
  | { kind: "checkbox"; id: EditorCommandId }
  | { kind: "separator" }
  | { kind: "theme" }
  | { kind: "submenu"; label: string; items: MenuItem[] };

type MenuDefinition = { label: string; items: MenuItem[] };

type MenuBarProps = {
  commands: Record<EditorCommandId, EditorCommand>;
  checked: Partial<Record<EditorCommandId, boolean>>;
  brandInfo: FluxVersionInfo;
  onBrandVersionClick?: () => void;
};

const MENUS: MenuDefinition[] = [
  {
    label: "Flux",
    items: [
      { kind: "command", id: "app.about" },
      { kind: "command", id: "app.preferences" },
      { kind: "command", id: "app.shortcuts" },
      { kind: "separator" },
      { kind: "command", id: "app.resetLayout" },
      { kind: "separator" },
      { kind: "command", id: "app.openDocs" },
      { kind: "command", id: "app.reportIssue" },
    ],
  },
  {
    label: "File",
    items: [
      { kind: "command", id: "file.new" },
      { kind: "command", id: "file.open" },
      { kind: "command", id: "file.openRecent" },
      { kind: "separator" },
      { kind: "command", id: "file.save" },
      { kind: "command", id: "file.saveAs" },
      { kind: "command", id: "file.revert" },
      { kind: "separator" },
      { kind: "command", id: "file.settings" },
      {
        kind: "submenu",
        label: "Export",
        items: [
          { kind: "command", id: "file.exportPdf" },
          { kind: "command", id: "file.exportPng" },
          { kind: "command", id: "file.exportHtml" },
        ],
      },
      { kind: "separator" },
      { kind: "command", id: "file.close" },
    ],
  },
  {
    label: "Edit",
    items: [
      { kind: "command", id: "edit.undo" },
      { kind: "command", id: "edit.redo" },
      { kind: "separator" },
      { kind: "command", id: "edit.cut" },
      { kind: "command", id: "edit.copy" },
      { kind: "command", id: "edit.paste" },
      { kind: "separator" },
      { kind: "command", id: "edit.duplicate" },
      { kind: "command", id: "edit.delete" },
      { kind: "separator" },
      { kind: "command", id: "edit.find" },
      { kind: "command", id: "edit.palette" },
    ],
  },
  {
    label: "Insert",
    items: [
      { kind: "command", id: "insert.page" },
      { kind: "command", id: "insert.section" },
      { kind: "command", id: "insert.text" },
      { kind: "command", id: "insert.figure" },
      { kind: "command", id: "insert.slot" },
      { kind: "command", id: "insert.callout" },
      { kind: "command", id: "insert.table" },
      { kind: "separator" },
      { kind: "command", id: "insert.template" },
    ],
  },
  {
    label: "Format",
    items: [
      { kind: "command", id: "format.applyStyle" },
      { kind: "separator" },
      { kind: "command", id: "format.tokens" },
      { kind: "command", id: "format.styles" },
    ],
  },
  {
    label: "View",
    items: [
      { kind: "checkbox", id: "view.toggleOutline" },
      { kind: "checkbox", id: "view.toggleInspector" },
      { kind: "checkbox", id: "view.toggleAssets" },
      { kind: "checkbox", id: "view.toggleDiagnostics" },
      { kind: "checkbox", id: "view.toggleConsole" },
      { kind: "separator" },
      { kind: "command", id: "view.zoomIn" },
      { kind: "command", id: "view.zoomOut" },
      { kind: "command", id: "view.fitWidth" },
      { kind: "command", id: "view.fitPage" },
      { kind: "separator" },
      { kind: "command", id: "view.toggleGuides" },
      { kind: "command", id: "view.toggleGrid" },
      { kind: "command", id: "view.toggleRulers" },
      { kind: "separator" },
      { kind: "command", id: "view.previewMode" },
      { kind: "command", id: "view.editMode" },
      { kind: "command", id: "view.sourceMode" },
      { kind: "separator" },
      { kind: "checkbox", id: "view.showStatusBar" },
      { kind: "separator" },
      { kind: "theme" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { kind: "command", id: "runtime.playPause" },
      { kind: "command", id: "runtime.stepBack" },
      { kind: "command", id: "runtime.stepForward" },
      { kind: "separator" },
      { kind: "command", id: "runtime.setSeed" },
      { kind: "command", id: "runtime.randomizeSeed" },
      { kind: "separator" },
      { kind: "command", id: "runtime.jumpTime" },
      { kind: "command", id: "runtime.resetTime" },
    ],
  },
  {
    label: "Window",
    items: [
      { kind: "command", id: "window.defaultLayout" },
      { kind: "command", id: "window.writingLayout" },
      { kind: "command", id: "window.debugLayout" },
      { kind: "separator" },
      { kind: "command", id: "window.focusMode" },
    ],
  },
  {
    label: "Help",
    items: [
      { kind: "command", id: "help.docs" },
      { kind: "command", id: "help.troubleshooting" },
      { kind: "separator" },
      { kind: "command", id: "help.buildInfo" },
      { kind: "command", id: "help.copyDiagnostics" },
    ],
  },
];

const THEME_OPTIONS: Array<{ value: EditorTheme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "blueprint", label: "Blueprint" },
];

export function MenuBar({ commands, checked, brandInfo, onBrandVersionClick }: MenuBarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="editor-menubar">
      <Menubar.Root className="menubar-root">
        {MENUS.map((menu) => (
          <Menubar.Menu key={menu.label}>
            <Menubar.Trigger
              className={`menubar-trigger${menu.label === "Flux" ? " menubar-trigger-brand" : ""}`}
              title={menu.label === "Flux" ? FLUX_TAGLINE : undefined}
            >
              {menu.label === "Flux" ? (
                // Brand comes from @flux-lang/brand; do not fork.
                <FluxBrandHeader
                  info={brandInfo}
                  variant="menu"
                  markPath="/edit/flux-mark-favicon.svg"
                  showTagline={false}
                  onVersionClick={onBrandVersionClick}
                />
              ) : (
                menu.label
              )}
            </Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content className="menubar-content" align="start" sideOffset={6}>
                {menu.items.map((item, index) => (
                  <MenuItemRenderer
                    key={`${menu.label}-${index}`}
                    item={item}
                    commands={commands}
                    checked={checked}
                    theme={theme}
                    onThemeChange={setTheme}
                  />
                ))}
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>
        ))}
      </Menubar.Root>
    </div>
  );
}

function MenuItemRenderer({
  item,
  commands,
  checked,
  theme,
  onThemeChange,
}: {
  item: MenuItem;
  commands: Record<EditorCommandId, EditorCommand>;
  checked: Partial<Record<EditorCommandId, boolean>>;
  theme: EditorTheme;
  onThemeChange: (theme: EditorTheme) => void;
}) {
  if (item.kind === "separator") {
    return <Menubar.Separator className="menubar-separator" />;
  }
  if (item.kind === "theme") {
    return (
      <Menubar.Sub>
        <Menubar.SubTrigger className="menubar-item menubar-subtrigger">
          <span>Theme</span>
          <span className="menubar-chevron">›</span>
        </Menubar.SubTrigger>
        <Menubar.Portal>
          <Menubar.SubContent className="menubar-content" alignOffset={-6}>
            <Menubar.RadioGroup value={theme} onValueChange={(value) => onThemeChange(value as EditorTheme)}>
              {THEME_OPTIONS.map((option) => (
                <Menubar.RadioItem key={option.value} value={option.value} className="menubar-item menubar-radio">
                  <span className="menubar-check">
                    <Menubar.ItemIndicator>✓</Menubar.ItemIndicator>
                  </span>
                  <span className="menubar-label">{option.label}</span>
                </Menubar.RadioItem>
              ))}
            </Menubar.RadioGroup>
          </Menubar.SubContent>
        </Menubar.Portal>
      </Menubar.Sub>
    );
  }
  if (item.kind === "submenu") {
    return (
      <Menubar.Sub>
        <Menubar.SubTrigger className="menubar-item menubar-subtrigger">
          <span>{item.label}</span>
          <span className="menubar-chevron">›</span>
        </Menubar.SubTrigger>
        <Menubar.Portal>
          <Menubar.SubContent className="menubar-content" alignOffset={-6}>
            {item.items.map((child, index) => (
              <MenuItemRenderer
                key={`${item.label}-child-${index}`}
                item={child}
                commands={commands}
                checked={checked}
                theme={theme}
                onThemeChange={onThemeChange}
              />
            ))}
          </Menubar.SubContent>
        </Menubar.Portal>
      </Menubar.Sub>
    );
  }

  const command = commands[item.id];
  if (!command) return null;

  if (item.kind === "checkbox") {
    return (
      <Menubar.CheckboxItem
        className="menubar-item menubar-checkbox"
        checked={Boolean(checked[item.id])}
        onCheckedChange={() => {
          if (command.enabled) command.run();
        }}
        disabled={!command.enabled}
      >
        <span className="menubar-check">{checked[item.id] ? "✓" : ""}</span>
        <span className="menubar-label">{command.label}</span>
        {command.shortcut ? <span className="menubar-shortcut">{command.shortcut}</span> : null}
      </Menubar.CheckboxItem>
    );
  }

  return (
    <Menubar.Item
      className="menubar-item"
      disabled={!command.enabled}
      onSelect={() => {
        if (command.enabled) command.run();
      }}
    >
      <span className="menubar-label">{command.label}</span>
      {command.shortcut ? <span className="menubar-shortcut">{command.shortcut}</span> : null}
    </Menubar.Item>
  );
}
