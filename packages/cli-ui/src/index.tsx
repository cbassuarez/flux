import React from "react";
import { render } from "ink";
import type { FluxVersionInfo } from "@flux-lang/brand";
import { App } from "./ui/app.js";

export interface CliUiOptions {
  cwd: string;
  mode?: "new";
  initialArgs?: string[];
  detach?: boolean;
  helpCommand?: string;
  versionInfo: FluxVersionInfo;
  showVersionModal?: boolean;
}

export async function runCliUi(options: CliUiOptions): Promise<void> {
  const { waitUntilExit } = render(<App {...options} />, { exitOnCtrlC: true });
  await waitUntilExit();
}

export * from "./state/dashboard-machine.js";
