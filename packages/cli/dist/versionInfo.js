import { promises as fs } from "node:fs";
import path from "node:path";
import { coerceVersionInfo } from "@flux-lang/brand";
import cliPkg from "../package.json" with { type: "json" };
const VERSION_FILENAME = "version.json";
function inferChannelFromSemver(version) {
    return /-canary(?:\.|$)/i.test(version) ? "canary" : "stable";
}
async function findVersionJson(startDir) {
    let current = path.resolve(startDir);
    while (true) {
        const candidate = path.join(current, VERSION_FILENAME);
        try {
            await fs.access(candidate);
            return candidate;
        }
        catch {
            // keep walking
        }
        const parent = path.dirname(current);
        if (parent === current)
            return null;
        current = parent;
    }
}
export async function getFluxVersionInfoCli(cwd = process.cwd()) {
    const fromRepo = await findVersionJson(cwd);
    if (fromRepo) {
        try {
            const raw = await fs.readFile(fromRepo, "utf8");
            const parsed = JSON.parse(raw);
            return coerceVersionInfo({
                version: parsed.baseVersion ?? parsed.version,
                channel: parsed.channel,
            });
        }
        catch {
            // Fall through to package fallback.
        }
    }
    const packageVersion = String(cliPkg.version ?? "0.0.0");
    return coerceVersionInfo({
        version: packageVersion,
        channel: inferChannelFromSemver(packageVersion),
    });
}
