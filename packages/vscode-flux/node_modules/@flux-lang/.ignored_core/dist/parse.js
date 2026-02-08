import path from "node:path";
import { parseArgs } from "../args.js";
import { readFileText, writeFileText } from "../fs-utils.js";
import { parseDocument } from "@flux-lang/core"; // adjust path if needed
export async function runParseCommand(argv) {
    const { flags, positional } = parseArgs(argv);
    const options = {
        outputPath: flags.o ?? flags.output ?? undefined,
        compact: Boolean(flags.compact),
        ndjson: Boolean(flags.ndjson),
        summary: Boolean(flags.summary),
        stdin: Boolean(flags.stdin),
    };
    const outputs = [];
    let hadError = false;
    if (options.stdin) {
        const src = await readAllStdin();
        try {
            const doc = parseDocument(src);
            outputs.push({ file: "<stdin>", doc });
        }
        catch (err) {
            hadError = true;
            printParseError("<stdin>", err);
        }
    }
    else {
        if (positional.length === 0) {
            console.error("flux parse: expected at least one <file> or --stdin");
            process.exitCode = 1;
            return;
        }
        for (const file of positional) {
            let src;
            try {
                src = readFileText(file);
            }
            catch (err) {
                hadError = true;
                console.error(`flux parse: failed to read ${file}: ${err.message}`);
                continue;
            }
            try {
                const doc = parseDocument(src);
                outputs.push({ file: path.resolve(file), doc });
            }
            catch (err) {
                hadError = true;
                printParseError(file, err);
            }
        }
    }
    if (outputs.length > 0) {
        const json = formatOutput(outputs, options);
        if (options.outputPath) {
            writeFileText(options.outputPath, json);
        }
        else {
            process.stdout.write(json + "\n");
        }
    }
    if (hadError) {
        process.exitCode = 1;
    }
}
async function readAllStdin() {
    return new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", (err) => reject(err));
    });
}
function printParseError(file, err) {
    // Your parser errors already include line/column info in the message string.
    console.error(`flux parse: ${file}: ${err.message}`);
}
function formatOutput(files, opts) {
    if (opts.summary) {
        return files.map((f) => summarizeDoc(f.file, f.doc)).join("\n\n");
    }
    if (files.length === 1 && !opts.ndjson) {
        const doc = files[0].doc;
        return JSON.stringify(doc, null, opts.compact ? 0 : 2);
    }
    // NDJSON
    return files
        .map((f) => JSON.stringify({ file: f.file, doc: f.doc }))
        .join("\n");
}
function summarizeDoc(file, doc) {
    const title = doc?.meta?.title ?? "<unnamed>";
    const version = doc?.meta?.version ?? "<unknown>";
    const params = doc?.state?.params?.length ?? 0;
    const grids = doc?.grids?.length ?? 0;
    const rules = doc?.rules?.length ?? 0;
    return [
        file,
        `  title   : ${JSON.stringify(title)}`,
        `  version : ${version}`,
        `  params  : ${params}`,
        `  grids   : ${grids}`,
        `  rules   : ${rules}`,
    ].join("\n");
}
//# sourceMappingURL=parse.js.map