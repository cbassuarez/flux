import React from "react";
import { render } from "ink";
import { App } from "./ui/app.js";

export interface CliUiOptions {
  cwd: string;
  mode?: "new";
  initialArgs?: string[];
  detach?: boolean;
  helpCommand?: string;
  version?: string;
}

export async function runCliUi(options: CliUiOptions): Promise<void> {
  const { waitUntilExit } = render(<App {...options} />, { exitOnCtrlC: true });
  await waitUntilExit();
}

export * from "./state/dashboard-machine.js";
