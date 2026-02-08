!/usr/bin / env;
node;
import { FLUX_CLI_VERSION } from "../version.js";
import { runParseCommand } from "../commands/parse.js";
import { runCheckCommand } from "../commands/check.js";
import { runRepl } from "../commands/repl.js";
function printGlobalHelp() {
    // Keep in sync with the spec we agreed on
    // (you can factor this into a template if needed)
    const text = `
Flux language CLI v0.1

Usage:
  flux <command> [options]

Commands:
  parse   Parse one or more .flux files and print their IR
  check   Parse and statically check .flux files
  repl    Interactive Flux scratchpad (paste snippets, see IR)
  help    Show help for a command

Global options:
  -h, --help       Show this help and exit
  -V, --version    Show version and exit
      --color      Force colored output
      --no-color   Disable colored output

Run \`flux help <command>\` for more details on a specific command.
If run with no arguments, \`flux\` starts the interactive \`repl\` mode.
`.trimStart();
    // eslint-disable-next-line no-console
    console.log(text);
}
function printCommandHelp(command) {
    switch (command) {
        case "parse": {
            const text = `
Usage:
  flux parse [options] <file...>

Description:
  Parse one or more Flux source files and print their canonical IR.

  For a single file, the default output is pretty-printed JSON to stdout.
  For multiple files, the default output is NDJSON:
    {"file":"path/to/file1.flux","doc":{...}}
    {"file":"path/to/file2.flux","doc":{...}}

Options:
  -o, --output <path>   Write output to a file instead of stdout
      --compact         Emit compact JSON (no pretty-printing)
      --ndjson          Force NDJSON output even for a single file
      --summary         Print a human-readable summary instead of JSON
      --stdin           Read source from stdin (file list is ignored)
`.trimStart();
            console.log(text);
            return;
        }
        case "check": {
            const text = `
Usage:
  flux check [options] [paths...]

Description:
  Parse and statically check Flux source files.

  By default, checks all *.flux files under the given paths.
  If no paths are provided, '.' is assumed.

Options:
  -q, --quiet          Suppress normal output; use exit code only
      --json           Emit machine-readable diagnostics as JSON
      --max-errors N   Stop after reporting N errors (default: unlimited)
      --no-recursive   Do not recurse into subdirectories
      --stdin          Read a single Flux source from stdin

Exit codes:
  0  All files parsed and checked successfully
  1  Parse/check errors in at least one file
  2  Internal CLI error
`.trimStart();
            console.log(text);
            return;
        }
        case "repl": {
            const text = `
Usage:
  flux repl

Description:
  Interactive Flux scratchpad.

  - Paste or type a Flux document and press Ctrl+D (EOF) to parse.
  - On success, prints a summary and optionally the IR.
  - On failure, prints the parse error with location.

Notes:
  Running \`flux\` with no arguments is equivalent to \`flux repl\`.
`.trimStart();
            console.log(text);
            return;
        }
        default:
            console.error(`Unknown command '${command}' for 'flux help'.`);
    }
}
async function main() {
    const [, , ...argv] = process.argv;
    if (argv.length === 0) {
        await runRepl();
        return;
    }
    const first = argv[0];
    if (first === "-h" || first === "--help") {
        printGlobalHelp();
        return;
    }
    if (first === "-V" || first === "--version") {
        console.log(`flux v${FLUX_CLI_VERSION}`);
        return;
    }
    if (first === "help") {
        const sub = argv[1];
        if (!sub) {
            printGlobalHelp();
        }
        else {
            printCommandHelp(sub);
        }
        return;
    }
    const command = first;
    const commandArgs = argv.slice(1);
    try {
        switch (command) {
            case "parse":
                await runParseCommand(commandArgs);
                break;
            case "check":
                await runCheckCommand(commandArgs);
                break;
            case "repl":
                await runRepl();
                break;
            default:
                console.error(`Unknown command '${command}'.`);
                printGlobalHelp();
                process.exitCode = 1;
        }
    }
    catch (err) {
        console.error(`flux: internal error: ${err.message}`);
        process.exitCode = 2;
    }
}
void main();
//# sourceMappingURL=flux.js.map