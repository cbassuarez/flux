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
export declare function parseArgs(argv: string[]): ParsedArgs;
//# sourceMappingURL=args.d.ts.map