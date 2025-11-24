// packages/cli/src/args.ts

export interface FlagMap {
  [key: string]: string | number | boolean;
}

export interface ParsedArgs {
  flags: FlagMap;
  positional: string[];
}

/**
 * Very small, predictable argv parser.
 * Supports:
 *   --flag
 *   --flag=value
 *   --flag value
 *   -q  (single-char flags)
 * Everything else is treated as positional.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: FlagMap = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eqIdx = body.indexOf("=");
      if (eqIdx !== -1) {
        const key = body.slice(0, eqIdx);
        const value = coerce(body.slice(eqIdx + 1));
        flags[key] = value;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[body] = coerce(next);
          i++;
        } else {
          flags[body] = true;
        }
      }
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      const letters = arg.slice(1).split("");
      for (const ch of letters) {
        flags[ch] = true;
      }
      continue;
    }

    positional.push(arg);
  }

  return { flags, positional };
}

function coerce(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

