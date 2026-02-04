/**
 * Token types for the Flux lexer.
 * We keep keywords mostly as identifiers, except for a few special literals.
 */
var TokenType;
(function (TokenType) {
    // Structural
    TokenType[TokenType["LBrace"] = 0] = "LBrace";
    TokenType[TokenType["RBrace"] = 1] = "RBrace";
    TokenType[TokenType["LBracket"] = 2] = "LBracket";
    TokenType[TokenType["RBracket"] = 3] = "RBracket";
    TokenType[TokenType["LParen"] = 4] = "LParen";
    TokenType[TokenType["RParen"] = 5] = "RParen";
    TokenType[TokenType["Comma"] = 6] = "Comma";
    TokenType[TokenType["Semicolon"] = 7] = "Semicolon";
    TokenType[TokenType["Colon"] = 8] = "Colon";
    TokenType[TokenType["Equals"] = 9] = "Equals";
    TokenType[TokenType["At"] = 10] = "At";
    // Single-char operators / punctuation
    TokenType[TokenType["Dot"] = 11] = "Dot";
    TokenType[TokenType["Greater"] = 12] = "Greater";
    TokenType[TokenType["Less"] = 13] = "Less";
    TokenType[TokenType["Bang"] = 14] = "Bang";
    TokenType[TokenType["Plus"] = 15] = "Plus";
    TokenType[TokenType["Minus"] = 16] = "Minus";
    TokenType[TokenType["Star"] = 17] = "Star";
    TokenType[TokenType["Slash"] = 18] = "Slash";
    TokenType[TokenType["Percent"] = 19] = "Percent";
    // Multi-char operators
    TokenType[TokenType["AndAnd"] = 20] = "AndAnd";
    TokenType[TokenType["OrOr"] = 21] = "OrOr";
    TokenType[TokenType["EqualEqual"] = 22] = "EqualEqual";
    TokenType[TokenType["EqualEqualEqual"] = 23] = "EqualEqualEqual";
    TokenType[TokenType["BangEqual"] = 24] = "BangEqual";
    TokenType[TokenType["BangEqualEqual"] = 25] = "BangEqualEqual";
    TokenType[TokenType["LessEqual"] = 26] = "LessEqual";
    TokenType[TokenType["GreaterEqual"] = 27] = "GreaterEqual";
    // Literals
    TokenType[TokenType["Int"] = 28] = "Int";
    TokenType[TokenType["Float"] = 29] = "Float";
    TokenType[TokenType["String"] = 30] = "String";
    TokenType[TokenType["Bool"] = 31] = "Bool";
    TokenType[TokenType["Inf"] = 32] = "Inf";
    TokenType[TokenType["Identifier"] = 33] = "Identifier";
    TokenType[TokenType["EOF"] = 34] = "EOF";
})(TokenType || (TokenType = {}));
/**
 * Simple lexer for Flux.
 * - Distinguishes Int vs Float.
 * - Handles "inf" as a dedicated keyword token.
 * - Handles true/false as Bool tokens.
 * - Supports both line (//) and block comments.
 */
class Lexer {
    src;
    pos = 0;
    line = 1;
    col = 1;
    constructor(source) {
        this.src = source;
    }
    tokenize() {
        const tokens = [];
        while (!this.isAtEnd()) {
            const ch = this.peekChar();
            if (this.isWhitespace(ch)) {
                this.skipWhitespace();
                continue;
            }
            if (ch === "/" && this.peekChar(1) === "/") {
                this.skipLineComment();
                continue;
            }
            if (ch === "/" && this.peekChar(1) === "*") {
                this.skipBlockComment();
                continue;
            }
            const startLine = this.line;
            const startCol = this.col;
            if (this.isAlpha(ch) || ch === "_") {
                const ident = this.readIdentifier();
                const lower = ident.toLowerCase();
                if (lower === "true" || lower === "false") {
                    tokens.push({
                        type: TokenType.Bool,
                        lexeme: ident,
                        value: lower === "true",
                        line: startLine,
                        column: startCol,
                    });
                }
                else if (lower === "inf") {
                    tokens.push({
                        type: TokenType.Inf,
                        lexeme: ident,
                        value: "inf",
                        line: startLine,
                        column: startCol,
                    });
                }
                else {
                    tokens.push({
                        type: TokenType.Identifier,
                        lexeme: ident,
                        value: ident,
                        line: startLine,
                        column: startCol,
                    });
                }
                continue;
            }
            if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.peekChar(1)))) {
                tokens.push(this.readNumberToken());
                continue;
            }
            if (ch === '"' || ch === "'") {
                tokens.push(this.readStringToken());
                continue;
            }
            // Single-character tokens
            switch (ch) {
                case "{":
                    this.advanceChar();
                    tokens.push({ type: TokenType.LBrace, lexeme: "{", line: startLine, column: startCol });
                    break;
                case "}":
                    this.advanceChar();
                    tokens.push({ type: TokenType.RBrace, lexeme: "}", line: startLine, column: startCol });
                    break;
                case "[":
                    this.advanceChar();
                    tokens.push({ type: TokenType.LBracket, lexeme: "[", line: startLine, column: startCol });
                    break;
                case "]":
                    this.advanceChar();
                    tokens.push({ type: TokenType.RBracket, lexeme: "]", line: startLine, column: startCol });
                    break;
                case "(":
                    this.advanceChar();
                    tokens.push({ type: TokenType.LParen, lexeme: "(", line: startLine, column: startCol });
                    break;
                case ")":
                    this.advanceChar();
                    tokens.push({ type: TokenType.RParen, lexeme: ")", line: startLine, column: startCol });
                    break;
                case ",":
                    this.advanceChar();
                    tokens.push({ type: TokenType.Comma, lexeme: ",", line: startLine, column: startCol });
                    break;
                case ";":
                    this.advanceChar();
                    tokens.push({ type: TokenType.Semicolon, lexeme: ";", line: startLine, column: startCol });
                    break;
                case ":":
                    this.advanceChar();
                    tokens.push({ type: TokenType.Colon, lexeme: ":", line: startLine, column: startCol });
                    break;
                case "=": {
                    this.advanceChar();
                    if (this.peekChar() === "=") {
                        this.advanceChar(); // second '='
                        if (this.peekChar() === "=") {
                            this.advanceChar(); // third '='
                            tokens.push({
                                type: TokenType.EqualEqualEqual,
                                lexeme: "===",
                                line: startLine,
                                column: startCol,
                            });
                        }
                        else {
                            tokens.push({
                                type: TokenType.EqualEqual,
                                lexeme: "==",
                                line: startLine,
                                column: startCol,
                            });
                        }
                    }
                    else {
                        tokens.push({
                            type: TokenType.Equals,
                            lexeme: "=",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    break;
                }
                case "@":
                    this.advanceChar();
                    tokens.push({ type: TokenType.At, lexeme: "@", line: startLine, column: startCol });
                    break;
                case ".":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Dot,
                        lexeme: ".",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case ">":
                    this.advanceChar();
                    if (this.peekChar() === "=") {
                        this.advanceChar();
                        tokens.push({
                            type: TokenType.GreaterEqual,
                            lexeme: ">=",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    else {
                        tokens.push({
                            type: TokenType.Greater,
                            lexeme: ">",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    break;
                case "<":
                    this.advanceChar();
                    if (this.peekChar() === "=") {
                        this.advanceChar();
                        tokens.push({
                            type: TokenType.LessEqual,
                            lexeme: "<=",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    else {
                        tokens.push({
                            type: TokenType.Less,
                            lexeme: "<",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    break;
                case "!":
                    this.advanceChar();
                    if (this.peekChar() === "=") {
                        this.advanceChar();
                        if (this.peekChar() === "=") {
                            this.advanceChar();
                            tokens.push({
                                type: TokenType.BangEqualEqual,
                                lexeme: "!==",
                                line: startLine,
                                column: startCol,
                            });
                        }
                        else {
                            tokens.push({
                                type: TokenType.BangEqual,
                                lexeme: "!=",
                                line: startLine,
                                column: startCol,
                            });
                        }
                    }
                    else {
                        tokens.push({
                            type: TokenType.Bang,
                            lexeme: "!",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    break;
                case "+":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Plus,
                        lexeme: "+",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "-":
                    // Note: "-<digit>" is handled by readNumberToken() earlier.
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Minus,
                        lexeme: "-",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "*":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Star,
                        lexeme: "*",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "/":
                    // bare '/' (comments handled above)
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Slash,
                        lexeme: "/",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "%":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Percent,
                        lexeme: "%",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "&":
                    if (this.peekChar(1) === "&") {
                        this.advanceChar(); // first '&'
                        this.advanceChar(); // second '&'
                        tokens.push({
                            type: TokenType.AndAnd,
                            lexeme: "&&",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    else {
                        throw this.error("Unexpected '&' (did you mean '&&'?)", startLine, startCol);
                    }
                    break;
                case "|":
                    if (this.peekChar(1) === "|") {
                        this.advanceChar(); // first '|'
                        this.advanceChar(); // second '|'
                        tokens.push({
                            type: TokenType.OrOr,
                            lexeme: "||",
                            line: startLine,
                            column: startCol,
                        });
                    }
                    else {
                        throw this.error("Unexpected '|' (did you mean '||'?)", startLine, startCol);
                    }
                    break;
                default:
                    throw this.error(`Unexpected character '${ch}'`, startLine, startCol);
            }
        }
        tokens.push({
            type: TokenType.EOF,
            lexeme: "",
            line: this.line,
            column: this.col,
        });
        return tokens;
    }
    isAtEnd() {
        return this.pos >= this.src.length;
    }
    peekChar(offset = 0) {
        const idx = this.pos + offset;
        if (idx >= this.src.length)
            return "\0";
        return this.src[idx];
    }
    advanceChar() {
        const ch = this.src[this.pos++] ?? "\0";
        if (ch === "\n") {
            this.line += 1;
            this.col = 1;
        }
        else {
            this.col += 1;
        }
        return ch;
    }
    isWhitespace(ch) {
        return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
    }
    skipWhitespace() {
        while (!this.isAtEnd() && this.isWhitespace(this.peekChar())) {
            this.advanceChar();
        }
    }
    skipLineComment() {
        // assume starting at first '/'
        this.advanceChar(); // '/'
        this.advanceChar(); // second '/'
        while (!this.isAtEnd() && this.peekChar() !== "\n") {
            this.advanceChar();
        }
    }
    skipBlockComment() {
        this.advanceChar(); // '/'
        this.advanceChar(); // '*'
        while (!this.isAtEnd()) {
            if (this.peekChar() === "*" && this.peekChar(1) === "/") {
                this.advanceChar(); // '*'
                this.advanceChar(); // '/'
                break;
            }
            this.advanceChar();
        }
    }
    isAlpha(ch) {
        return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
    }
    isDigit(ch) {
        return ch >= "0" && ch <= "9";
    }
    readIdentifier() {
        let result = "";
        while (!this.isAtEnd()) {
            const ch = this.peekChar();
            if (this.isAlpha(ch) || this.isDigit(ch) || ch === "_") {
                result += this.advanceChar();
            }
            else {
                break;
            }
        }
        return result;
    }
    readNumberToken() {
        const startLine = this.line;
        const startCol = this.col;
        let text = "";
        let hasDot = false;
        // optional leading '-'
        if (this.peekChar() === "-") {
            text += this.advanceChar();
        }
        while (!this.isAtEnd() && this.isDigit(this.peekChar())) {
            text += this.advanceChar();
        }
        if (this.peekChar() === "." && this.isDigit(this.peekChar(1))) {
            hasDot = true;
            text += this.advanceChar(); // '.'
            while (!this.isAtEnd() && this.isDigit(this.peekChar())) {
                text += this.advanceChar();
            }
        }
        const num = Number(text);
        if (Number.isNaN(num)) {
            throw this.error(`Invalid numeric literal '${text}'`, startLine, startCol);
        }
        return {
            type: hasDot ? TokenType.Float : TokenType.Int,
            lexeme: text,
            value: num,
            line: startLine,
            column: startCol,
        };
    }
    readStringToken() {
        const quote = this.advanceChar(); // consume opening quote
        const startLine = this.line;
        const startCol = this.col;
        let text = "";
        while (!this.isAtEnd()) {
            const ch = this.peekChar();
            if (ch === quote) {
                this.advanceChar(); // closing quote
                return {
                    type: TokenType.String,
                    lexeme: text,
                    value: text,
                    line: startLine,
                    column: startCol,
                };
            }
            if (ch === "\n") {
                // allow multiline? for now, yes
                text += this.advanceChar();
            }
            else if (ch === "\\") {
                // simple escape handling: \" and \\ only
                this.advanceChar(); // '\'
                const next = this.peekChar();
                if (next === quote || next === "\\") {
                    text += this.advanceChar();
                }
                else {
                    text += "\\" + this.advanceChar();
                }
            }
            else {
                text += this.advanceChar();
            }
        }
        throw this.error("Unterminated string literal", startLine, startCol);
    }
    error(message, line, column) {
        return new Error(`Lexer error at ${line}:${column} - ${message}`);
    }
}
/**
 * Parser
 */
class Parser {
    tokens;
    current = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parseDocument() {
        // document { ... }
        this.expectIdentifier("document", "Expected 'document' at start of file");
        this.consume(TokenType.LBrace, "Expected '{' after 'document'");
        const meta = { version: "0.1.0" };
        const state = { params: [] };
        let pageConfig;
        const grids = [];
        const rules = [];
        let runtime;
        let materials;
        let assets;
        let body;
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("meta")) {
                const blockMeta = this.parseMetaBlock();
                Object.assign(meta, blockMeta);
            }
            else if (this.checkIdentifier("state")) {
                const st = this.parseStateBlock();
                state.params.push(...st.params);
            }
            else if (this.checkIdentifier("pageConfig")) {
                pageConfig = this.parsePageConfigBlock();
            }
            else if (this.checkIdentifier("grid")) {
                grids.push(this.parseGridBlock());
            }
            else if (this.checkIdentifier("rule")) {
                rules.push(this.parseRuleDecl());
            }
            else if (this.checkIdentifier("runtime")) {
                runtime = this.parseRuntimeBlock();
            }
            else if (this.checkIdentifier("assets")) {
                assets = this.parseAssetsBlock();
            }
            else if (this.checkIdentifier("materials")) {
                materials = this.parseMaterialsBlock();
            }
            else if (this.checkIdentifier("body")) {
                body = this.parseBodyBlock();
            }
            else {
                const tok = this.peek();
                throw this.errorAtToken(tok, `Unexpected top-level construct '${tok.lexeme}'`);
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' at end of document");
        const doc = {
            meta,
            state,
            pageConfig,
            grids,
            rules,
            runtime,
            materials,
            assets,
            body,
        };
        return doc;
    }
    // --- Meta ---
    parseMetaBlock() {
        this.expectIdentifier("meta", "Expected 'meta'");
        this.consume(TokenType.LBrace, "Expected '{' after 'meta'");
        const meta = { version: "0.1.0" };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            const keyTok = this.consume(TokenType.Identifier, "Expected meta field name");
            const key = String(keyTok.value);
            this.consume(TokenType.Equals, "Expected '=' after meta field name");
            const valueTok = this.consume(TokenType.String, "Expected string value for meta field");
            meta[key] = String(valueTok.value);
            this.consumeOptional(TokenType.Semicolon);
        }
        this.consume(TokenType.RBrace, "Expected '}' after meta block");
        return meta;
    }
    // --- State ---
    parseStateBlock() {
        this.expectIdentifier("state", "Expected 'state'");
        this.consume(TokenType.LBrace, "Expected '{' after 'state'");
        const params = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("param")) {
                params.push(this.parseParamDecl());
            }
            else {
                // Tolerant skip of unknown statements inside state
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after state block");
        return { params };
    }
    parseParamDecl() {
        this.expectIdentifier("param", "Expected 'param'");
        const nameTok = this.consume(TokenType.Identifier, "Expected parameter name");
        const name = String(nameTok.value);
        this.consume(TokenType.Colon, "Expected ':' after parameter name");
        const typeTok = this.consume(TokenType.Identifier, "Expected parameter type");
        const typeName = String(typeTok.value);
        const validTypes = ["int", "float", "bool", "string", "enum"];
        if (!validTypes.includes(typeName)) {
            throw this.errorAtToken(typeTok, `Unknown parameter type '${typeName}'`);
        }
        let min;
        let max;
        // Optional range
        if (this.match(TokenType.LBracket)) {
            const minLit = this.parseLiteral();
            min = minLit;
            this.consume(TokenType.Comma, "Expected ',' in range");
            if (this.match(TokenType.Inf)) {
                max = "inf";
            }
            else {
                const maxLit = this.parseLiteral();
                max = maxLit;
            }
            this.consume(TokenType.RBracket, "Expected ']' to close range");
        }
        this.consume(TokenType.At, "Expected '@' before initial value");
        const initLit = this.parseLiteral();
        this.consumeOptional(TokenType.Semicolon);
        const param = {
            name,
            type: typeName,
            min,
            max,
            initial: initLit,
        };
        return param;
    }
    // --- PageConfig ---
    parsePageConfigBlock() {
        this.expectIdentifier("pageConfig", "Expected 'pageConfig'");
        this.consume(TokenType.LBrace, "Expected '{' after 'pageConfig'");
        let size;
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("size")) {
                size = this.parsePageSizeBlock();
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after pageConfig block");
        if (!size) {
            throw this.errorAtToken(this.peek(), "pageConfig must contain a size block");
        }
        return { size };
    }
    parsePageSizeBlock() {
        this.expectIdentifier("size", "Expected 'size'");
        this.consume(TokenType.LBrace, "Expected '{' after 'size'");
        let width;
        let height;
        let units;
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("width")) {
                this.advance(); // width
                this.consume(TokenType.Equals, "Expected '=' after 'width'");
                const valTok = this.consumeNumber("Expected numeric width");
                width = Number(valTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("height")) {
                this.advance(); // height
                this.consume(TokenType.Equals, "Expected '=' after 'height'");
                const valTok = this.consumeNumber("Expected numeric height");
                height = Number(valTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("units")) {
                this.advance(); // units
                this.consume(TokenType.Equals, "Expected '=' after 'units'");
                const valTok = this.consume(TokenType.String, "Expected string for units");
                units = String(valTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after size block");
        if (width === undefined || height === undefined || units === undefined) {
            throw this.errorAtToken(this.peek(), "Incomplete page size (width/height/units required)");
        }
        return { width, height, units };
    }
    // --- Grid & Cell ---
    parseGridBlock() {
        this.expectIdentifier("grid", "Expected 'grid'");
        const nameTok = this.consume(TokenType.Identifier, "Expected grid name");
        const name = String(nameTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after grid name");
        let topology;
        let page;
        let rows;
        let cols;
        const cells = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("topology")) {
                this.advance(); // topology
                this.consume(TokenType.Equals, "Expected '=' after 'topology'");
                const topTok = this.consume(TokenType.Identifier, "Expected topology kind");
                topology = String(topTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("page")) {
                this.advance(); // page
                this.consume(TokenType.Equals, "Expected '=' after 'page'");
                const numTok = this.consumeNumber("Expected page number");
                page = Number(numTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("size")) {
                const size = this.parseGridSizeBlock();
                rows = size.rows;
                cols = size.cols;
            }
            else if (this.checkIdentifier("cell")) {
                cells.push(this.parseCellBlock());
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after grid block");
        if (!topology) {
            throw this.errorAtToken(this.peek(), "Grid must declare a topology");
        }
        const grid = {
            name,
            topology: topology,
            page,
            size: { rows, cols },
            cells,
        };
        return grid;
    }
    parseGridSizeBlock() {
        this.expectIdentifier("size", "Expected 'size'");
        this.consume(TokenType.LBrace, "Expected '{' after 'size'");
        let rows;
        let cols;
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("rows")) {
                this.advance(); // rows
                this.consume(TokenType.Equals, "Expected '=' after 'rows'");
                const numTok = this.consumeNumber("Expected integer for rows");
                rows = Number(numTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("cols")) {
                this.advance(); // cols
                this.consume(TokenType.Equals, "Expected '=' after 'cols'");
                const numTok = this.consumeNumber("Expected integer for cols");
                cols = Number(numTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after size block");
        return { rows, cols };
    }
    parseCellBlock() {
        this.expectIdentifier("cell", "Expected 'cell'");
        const idTok = this.consume(TokenType.Identifier, "Expected cell id");
        const id = String(idTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after cell id");
        const cell = {
            id,
            tags: [],
        };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("tags")) {
                this.advance(); // tags
                this.consume(TokenType.Equals, "Expected '=' after 'tags'");
                this.consume(TokenType.LBracket, "Expected '[' after 'tags ='");
                const tags = [];
                if (!this.check(TokenType.RBracket)) {
                    // at least one tag
                    const first = this.consume(TokenType.Identifier, "Expected tag identifier");
                    tags.push(String(first.value));
                    while (this.match(TokenType.Comma)) {
                        const t = this.consume(TokenType.Identifier, "Expected tag identifier");
                        tags.push(String(t.value));
                    }
                }
                this.consume(TokenType.RBracket, "Expected ']' after tag list");
                this.consumeOptional(TokenType.Semicolon);
                cell.tags = tags;
            }
            else if (this.checkIdentifier("content")) {
                this.advance(); // content
                this.consume(TokenType.Equals, "Expected '=' after 'content'");
                const strTok = this.consume(TokenType.String, "Expected string for content");
                cell.content = String(strTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("dynamic")) {
                this.advance(); // dynamic
                this.consume(TokenType.Equals, "Expected '=' after 'dynamic'");
                const numTok = this.consumeNumber("Expected numeric value for dynamic");
                cell.dynamic = Number(numTok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                // Tolerant skip of unknown fields inside cell
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after cell block");
        return cell;
    }
    // --- Materials ---
    parseMaterialsBlock() {
        this.expectIdentifier("materials", "Expected 'materials'");
        this.consume(TokenType.LBrace, "Expected '{' after 'materials'");
        const materials = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("material")) {
                materials.push(this.parseMaterialDecl());
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after materials block");
        return { materials };
    }
    parseMaterialDecl() {
        this.expectIdentifier("material", "Expected 'material'");
        const nameTok = this.consume(TokenType.Identifier, "Expected material name");
        const name = String(nameTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after material name");
        const material = { name, tags: [] };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("tags")) {
                material.tags = this.parseIdentifierList();
            }
            else if (this.checkIdentifier("label")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'label'");
                const tok = this.consume(TokenType.String, "Expected string for label");
                material.label = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("description")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'description'");
                const tok = this.consume(TokenType.String, "Expected string for description");
                material.description = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("color")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'color'");
                const tok = this.consume(TokenType.String, "Expected string for color");
                material.color = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("score")) {
                material.score = this.parseMaterialScoreBlock();
            }
            else if (this.checkIdentifier("midi")) {
                material.midi = this.parseMaterialMidiBlock();
            }
            else if (this.checkIdentifier("video")) {
                material.video = this.parseMaterialVideoBlock();
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after material block");
        return material;
    }
    parseMaterialScoreBlock() {
        this.expectIdentifier("score", "Expected 'score'");
        this.consume(TokenType.LBrace, "Expected '{' after 'score'");
        const score = {};
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("text")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'text'");
                const tok = this.consume(TokenType.String, "Expected string for text");
                score.text = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("staff")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'staff'");
                const tok = this.consume(TokenType.String, "Expected string for staff");
                score.staff = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("clef")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'clef'");
                const tok = this.consume(TokenType.String, "Expected string for clef");
                score.clef = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after score block");
        return score;
    }
    parseMaterialMidiBlock() {
        this.expectIdentifier("midi", "Expected 'midi'");
        this.consume(TokenType.LBrace, "Expected '{' after 'midi'");
        const midi = {};
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("channel")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'channel'");
                const tok = this.consumeNumber("Expected numeric channel");
                midi.channel = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("pitch")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'pitch'");
                const tok = this.consumeNumber("Expected numeric pitch");
                midi.pitch = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("velocity")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'velocity'");
                const tok = this.consumeNumber("Expected numeric velocity");
                midi.velocity = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("durationSeconds")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'durationSeconds'");
                const tok = this.consumeNumber("Expected numeric durationSeconds");
                midi.durationSeconds = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after midi block");
        return midi;
    }
    parseMaterialVideoBlock() {
        this.expectIdentifier("video", "Expected 'video'");
        this.consume(TokenType.LBrace, "Expected '{' after 'video'");
        const video = { clip: "" };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("clip")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'clip'");
                const tok = this.consume(TokenType.String, "Expected string for clip");
                video.clip = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("inSeconds")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'inSeconds'");
                const tok = this.consumeNumber("Expected numeric inSeconds");
                video.inSeconds = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("outSeconds")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'outSeconds'");
                const tok = this.consumeNumber("Expected numeric outSeconds");
                video.outSeconds = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("layer")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'layer'");
                const tok = this.consume(TokenType.String, "Expected string for layer");
                video.layer = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after video block");
        return video;
    }
    // --- Assets (v0.2) ---
    parseAssetsBlock() {
        this.expectIdentifier("assets", "Expected 'assets'");
        this.consume(TokenType.LBrace, "Expected '{' after 'assets'");
        const assets = [];
        const banks = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("asset")) {
                assets.push(this.parseAssetDecl());
            }
            else if (this.checkIdentifier("bank")) {
                banks.push(this.parseAssetBankDecl());
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after assets block");
        return { assets, banks };
    }
    parseAssetDecl() {
        this.expectIdentifier("asset", "Expected 'asset'");
        const nameTok = this.consume(TokenType.Identifier, "Expected asset name");
        const name = String(nameTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after asset name");
        const asset = {
            name,
            kind: "",
            path: "",
            tags: [],
        };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("kind")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'kind'");
                const tok = this.peek();
                if (tok.type === TokenType.String || tok.type === TokenType.Identifier) {
                    this.advance();
                    asset.kind = String(tok.value ?? tok.lexeme);
                }
                else {
                    throw this.errorAtToken(tok, "Expected kind identifier or string");
                }
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("path")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'path'");
                const tok = this.consume(TokenType.String, "Expected string for path");
                asset.path = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("tags")) {
                asset.tags = this.parseIdentifierList();
            }
            else if (this.checkIdentifier("weight")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'weight'");
                const tok = this.consumeNumber("Expected numeric weight");
                asset.weight = Number(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("meta")) {
                asset.meta = this.parseMetaMapBlock();
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after asset block");
        return asset;
    }
    parseAssetBankDecl() {
        this.expectIdentifier("bank", "Expected 'bank'");
        const nameTok = this.consume(TokenType.Identifier, "Expected bank name");
        const name = String(nameTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after bank name");
        const bank = {
            name,
            kind: "",
            root: "",
            include: "",
            tags: [],
        };
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("kind")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'kind'");
                const tok = this.peek();
                if (tok.type === TokenType.String || tok.type === TokenType.Identifier) {
                    this.advance();
                    bank.kind = String(tok.value ?? tok.lexeme);
                }
                else {
                    throw this.errorAtToken(tok, "Expected kind identifier or string");
                }
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("root")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'root'");
                const tok = this.consume(TokenType.String, "Expected string for root");
                bank.root = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("include")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'include'");
                const tok = this.consume(TokenType.String, "Expected string for include");
                bank.include = String(tok.value);
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("tags")) {
                bank.tags = this.parseIdentifierList();
            }
            else if (this.checkIdentifier("strategy")) {
                this.advance();
                this.consume(TokenType.Equals, "Expected '=' after 'strategy'");
                const tok = this.peek();
                if (tok.type !== TokenType.Identifier && tok.type !== TokenType.String) {
                    throw this.errorAtToken(tok, "Expected strategy identifier or string");
                }
                this.advance();
                const raw = String(tok.value ?? tok.lexeme);
                if (raw !== "weighted" && raw !== "uniform") {
                    throw this.errorAtToken(tok, `Unknown asset strategy '${raw}'`);
                }
                bank.strategy = raw;
                this.consumeOptional(TokenType.Semicolon);
            }
            else {
                this.skipStatement();
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after bank block");
        return bank;
    }
    parseMetaMapBlock() {
        this.expectIdentifier("meta", "Expected 'meta'");
        this.consume(TokenType.LBrace, "Expected '{' after 'meta'");
        const meta = {};
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            const keyTok = this.consume(TokenType.Identifier, "Expected meta field name");
            const key = String(keyTok.value);
            this.consume(TokenType.Equals, "Expected '=' after meta field name");
            const value = this.parseValueLiteral();
            meta[key] = value;
            this.consumeOptional(TokenType.Semicolon);
        }
        this.consume(TokenType.RBrace, "Expected '}' after meta block");
        return meta;
    }
    // --- Body (v0.2) ---
    parseBodyBlock() {
        this.expectIdentifier("body", "Expected 'body'");
        this.consume(TokenType.LBrace, "Expected '{' after 'body'");
        const nodes = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            const node = this.parseDocumentNode();
            if (node.kind !== "page") {
                throw this.errorAtToken(this.peek(), "Body block must contain page nodes at the top level");
            }
            nodes.push(node);
        }
        this.consume(TokenType.RBrace, "Expected '}' after body block");
        return { nodes };
    }
    parseDocumentNode() {
        const kindTok = this.consume(TokenType.Identifier, "Expected node kind");
        const kind = String(kindTok.value);
        const idTok = this.consume(TokenType.Identifier, "Expected node id");
        const id = String(idTok.value);
        this.consume(TokenType.LBrace, "Expected '{' after node id");
        const props = {};
        const children = [];
        let refresh;
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("refresh")) {
                refresh = this.parseRefreshPolicy();
                continue;
            }
            if (this.looksLikeNodeDecl()) {
                children.push(this.parseDocumentNode());
                continue;
            }
            if (this.check(TokenType.Identifier)) {
                const keyTok = this.advance();
                const key = String(keyTok.value);
                this.consume(TokenType.Equals, "Expected '=' after property name");
                if (this.match(TokenType.At)) {
                    const expr = this.parseExpr();
                    props[key] = { kind: "DynamicValue", expr };
                }
                else {
                    const value = this.parseValueLiteral();
                    props[key] = { kind: "LiteralValue", value };
                }
                this.consumeOptional(TokenType.Semicolon);
                continue;
            }
            this.skipStatement();
        }
        this.consume(TokenType.RBrace, "Expected '}' after node block");
        return { id, kind, props, children, refresh };
    }
    parseRefreshPolicy() {
        this.expectIdentifier("refresh", "Expected 'refresh'");
        this.consume(TokenType.Equals, "Expected '=' after 'refresh'");
        if (this.checkIdentifier("onLoad")) {
            this.advance();
            this.consumeOptional(TokenType.Semicolon);
            return { kind: "onLoad" };
        }
        if (this.checkIdentifier("onDocstep")) {
            this.advance();
            this.consumeOptional(TokenType.Semicolon);
            return { kind: "onDocstep" };
        }
        if (this.checkIdentifier("never")) {
            this.advance();
            this.consumeOptional(TokenType.Semicolon);
            return { kind: "never" };
        }
        if (this.checkIdentifier("every")) {
            this.advance();
            this.consume(TokenType.LParen, "Expected '(' after 'every'");
            const { amount, unit } = this.parseDurationSpec();
            this.consume(TokenType.RParen, "Expected ')' after every(...)");
            this.consumeOptional(TokenType.Semicolon);
            return { kind: "every", amount, unit };
        }
        throw this.errorAtToken(this.peek(), "Invalid refresh policy");
    }
    looksLikeNodeDecl() {
        return (this.check(TokenType.Identifier) &&
            this.peek(1).type === TokenType.Identifier &&
            this.peek(2).type === TokenType.LBrace);
    }
    parseIdentifierList() {
        this.advance(); // identifier keyword already checked
        this.consume(TokenType.Equals, "Expected '=' after identifier list key");
        this.consume(TokenType.LBracket, "Expected '[' to start identifier list");
        const values = [];
        if (!this.check(TokenType.RBracket)) {
            const first = this.consume(TokenType.Identifier, "Expected identifier");
            values.push(String(first.value));
            while (this.match(TokenType.Comma)) {
                const t = this.consume(TokenType.Identifier, "Expected identifier");
                values.push(String(t.value));
            }
        }
        this.consume(TokenType.RBracket, "Expected ']' after identifier list");
        this.consumeOptional(TokenType.Semicolon);
        return values;
    }
    // --- Expressions ---
    parseExpr() {
        return this.parseOr();
    }
    parseOr() {
        let expr = this.parseAnd();
        while (true) {
            if (this.matchKeyword("or") || this.match(TokenType.OrOr)) {
                const right = this.parseAnd();
                expr = this.makeBinary(expr, "or", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseAnd() {
        let expr = this.parseEquality();
        while (true) {
            if (this.matchKeyword("and") || this.match(TokenType.AndAnd)) {
                const right = this.parseEquality();
                expr = this.makeBinary(expr, "and", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseEquality() {
        let expr = this.parseComparison();
        while (true) {
            if (this.match(TokenType.EqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "==", right);
            }
            else if (this.match(TokenType.BangEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "!=", right);
            }
            else if (this.match(TokenType.EqualEqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "===", right);
            }
            else if (this.match(TokenType.BangEqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "!==", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseComparison() {
        let expr = this.parseTerm();
        while (true) {
            if (this.match(TokenType.Less)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, "<", right);
            }
            else if (this.match(TokenType.LessEqual)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, "<=", right);
            }
            else if (this.match(TokenType.Greater)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, ">", right);
            }
            else if (this.match(TokenType.GreaterEqual)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, ">=", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseTerm() {
        let expr = this.parseFactor();
        while (true) {
            if (this.match(TokenType.Plus)) {
                const right = this.parseFactor();
                expr = this.makeBinary(expr, "+", right);
            }
            else if (this.match(TokenType.Minus)) {
                const right = this.parseFactor();
                expr = this.makeBinary(expr, "-", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseFactor() {
        let expr = this.parseUnary();
        while (true) {
            if (this.match(TokenType.Star)) {
                const right = this.parseUnary();
                expr = this.makeBinary(expr, "*", right);
            }
            else if (this.match(TokenType.Slash)) {
                const right = this.parseUnary();
                expr = this.makeBinary(expr, "/", right);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseUnary() {
        if (this.matchKeyword("not") || this.match(TokenType.Bang)) {
            const argument = this.parseUnary();
            const op = "not";
            return {
                kind: "UnaryExpression",
                op,
                argument,
            };
        }
        if (this.match(TokenType.Minus)) {
            const argument = this.parseUnary();
            const op = "-";
            return {
                kind: "UnaryExpression",
                op,
                argument,
            };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.match(TokenType.Dot)) {
                const nameTok = this.consume(TokenType.Identifier, "Expected property name after '.'");
                const property = String(nameTok.value);
                expr = {
                    kind: "MemberExpression",
                    object: expr,
                    property,
                };
            }
            else if (this.match(TokenType.LParen)) {
                const args = this.parseArgumentList();
                expr = this.maybeNeighborsCall(expr, args);
            }
            else {
                break;
            }
        }
        return expr;
    }
    parsePrimary() {
        const tok = this.peek();
        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value,
                };
            }
            case TokenType.String: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value,
                };
            }
            case TokenType.Bool: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value,
                };
            }
            case TokenType.LBracket: {
                this.advance(); // '['
                const items = [];
                if (!this.check(TokenType.RBracket)) {
                    items.push(this.parseExpr());
                    while (this.match(TokenType.Comma)) {
                        items.push(this.parseExpr());
                    }
                }
                this.consume(TokenType.RBracket, "Expected ']' after list literal");
                return {
                    kind: "ListExpression",
                    items,
                };
            }
            case TokenType.Identifier: {
                this.advance();
                return {
                    kind: "Identifier",
                    name: tok.lexeme,
                };
            }
            case TokenType.LBrace: {
                // Allow curly-braced grouping in expression position, e.g.:
                //   when { neighbors.all().dynamic > 0.5 } then { ... }
                this.advance(); // consume '{'
                const expr = this.parseExpr();
                this.consume(TokenType.RBrace, "Expected '}' after expression group");
                return expr;
            }
            default:
                break;
        }
        if (this.match(TokenType.LParen)) {
            const expr = this.parseExpr();
            this.consume(TokenType.RParen, "Expected ')' after expression");
            return expr;
        }
        throw this.errorAtToken(tok, "Expected expression");
    }
    parseArgumentList() {
        const args = [];
        if (this.check(TokenType.RParen)) {
            this.consume(TokenType.RParen, "Expected ')' after argument list");
            return args;
        }
        args.push(this.parseCallArg());
        while (this.match(TokenType.Comma)) {
            args.push(this.parseCallArg());
        }
        this.consume(TokenType.RParen, "Expected ')' after argument list");
        return args;
    }
    parseCallArg() {
        if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.Equals) {
            const nameTok = this.advance();
            const name = String(nameTok.value);
            this.consume(TokenType.Equals, "Expected '=' after argument name");
            const value = this.parseExpr();
            return { kind: "NamedArg", name, value };
        }
        return this.parseExpr();
    }
    maybeNeighborsCall(callee, args) {
        if (callee.kind === "MemberExpression" &&
            callee.object.kind === "Identifier" &&
            callee.object.name === "neighbors") {
            return {
                kind: "NeighborsCallExpression",
                namespace: "neighbors",
                method: callee.property,
                args,
            };
        }
        return {
            kind: "CallExpression",
            callee,
            args,
        };
    }
    makeBinary(left, op, right) {
        return {
            kind: "BinaryExpression",
            op,
            left,
            right,
        };
    }
    // --- Rule & Runtime (placeholders for now) ---
    // --- Rules ---
    parseRuleDecl() {
        this.expectIdentifier("rule", "Expected 'rule'");
        const nameTok = this.consume(TokenType.Identifier, "Expected rule name");
        const name = String(nameTok.value);
        const { mode, scope, onEventType } = this.parseRuleHeader();
        // Enforce event header constraints
        if (mode === "event" && !onEventType) {
            throw this.errorAtToken(this.peek(), "Event rules must specify an 'on=\"...\"' event type");
        }
        this.consume(TokenType.LBrace, "Expected '{' to start rule body");
        // First branch: when ... then { ... }
        this.expectIdentifier("when", "Expected 'when' in rule body");
        const firstCondition = this.parseExpr();
        this.expectIdentifier("then", "Expected 'then' after rule condition");
        const firstThen = this.parseStatementBlock();
        const branches = [
            { condition: firstCondition, thenBranch: firstThen },
        ];
        let elseBranch;
        // Optional: else when ... { ... } chains and final else { ... }
        while (this.checkIdentifier("else")) {
            this.advance(); // 'else'
            if (this.checkIdentifier("when")) {
                // else when ...
                this.advance(); // 'when'
                const cond = this.parseExpr();
                this.expectIdentifier("then", "Expected 'then' after 'else when' condition");
                const thenBlock = this.parseStatementBlock();
                branches.push({ condition: cond, thenBranch: thenBlock });
            }
            else {
                // plain else { ... }
                elseBranch = this.parseStatementBlock();
                break;
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after rule body");
        return {
            name,
            mode,
            scope,
            onEventType,
            branches,
            // convenience mirrors of the first branch
            condition: branches[0].condition,
            thenBranch: branches[0].thenBranch,
            elseBranch,
        };
    }
    parseRuleHeader() {
        let mode = "docstep";
        let scope;
        let onEventType;
        if (this.match(TokenType.LParen)) {
            if (!this.check(TokenType.RParen)) {
                while (true) {
                    const keyTok = this.consume(TokenType.Identifier, "Expected header key");
                    const key = String(keyTok.value);
                    this.consume(TokenType.Equals, "Expected '=' after header key");
                    if (key === "mode") {
                        const valTok = this.consume(TokenType.Identifier, "Expected mode value");
                        const val = String(valTok.value);
                        if (val !== "docstep" && val !== "event" && val !== "timer") {
                            throw this.errorAtToken(valTok, `Invalid rule mode '${val}'`);
                        }
                        mode = val;
                    }
                    else if (key === "grid") {
                        const valTok = this.consume(TokenType.Identifier, "Expected grid name");
                        const gridName = String(valTok.value);
                        scope = { grid: gridName };
                    }
                    else if (key === "on") {
                        const valTok = this.consume(TokenType.String, "Expected string for 'on'");
                        onEventType = String(valTok.value);
                    }
                    else {
                        throw this.errorAtToken(keyTok, `Unknown rule header key '${key}'`);
                    }
                    if (!this.match(TokenType.Comma))
                        break;
                }
            }
            this.consume(TokenType.RParen, "Expected ')' after rule header");
        }
        return { mode, scope, onEventType };
    }
    parseStatementBlock() {
        this.consume(TokenType.LBrace, "Expected '{' to start block");
        const statements = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        this.consume(TokenType.RBrace, "Expected '}' to close block");
        return statements;
    }
    parseStatement() {
        if (this.checkIdentifier("let")) {
            return this.parseLetStatement();
        }
        if (this.checkIdentifier("advanceDocstep")) {
            return this.parseAdvanceDocstepStatement();
        }
        // For v0.1: only assignments beyond 'let' and 'advanceDocstep'
        const lhs = this.parseExpr();
        if (!this.match(TokenType.Equals)) {
            throw this.errorAtToken(this.peek(), "Only assignment, 'let', and 'advanceDocstep()' statements are allowed in rule bodies in v0.1");
        }
        const value = this.parseExpr();
        this.consumeOptional(TokenType.Semicolon);
        if (lhs.kind !== "Identifier" && lhs.kind !== "MemberExpression") {
            throw this.errorAtToken(this.peek(), "Invalid assignment target");
        }
        const stmt = {
            kind: "AssignmentStatement",
            target: lhs,
            value,
        };
        return stmt;
    }
    parseLetStatement() {
        this.expectIdentifier("let", "Expected 'let'");
        const nameTok = this.consume(TokenType.Identifier, "Expected identifier after 'let'");
        const name = String(nameTok.value);
        this.consume(TokenType.Equals, "Expected '=' after let name");
        const value = this.parseExpr();
        this.consumeOptional(TokenType.Semicolon);
        return {
            kind: "LetStatement",
            name,
            value,
        };
    }
    parseAdvanceDocstepStatement() {
        this.expectIdentifier("advanceDocstep", "Expected 'advanceDocstep'");
        this.consume(TokenType.LParen, "Expected '(' after 'advanceDocstep'");
        this.consume(TokenType.RParen, "Expected ')' after 'advanceDocstep('");
        this.consumeOptional(TokenType.Semicolon);
        return {
            kind: "AdvanceDocstepStatement",
        };
    }
    // --- Runtime ---
    parseRuntimeBlock() {
        this.expectIdentifier("runtime", "Expected 'runtime'");
        this.consume(TokenType.LBrace, "Expected '{' after 'runtime'");
        const config = {};
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("eventsApply")) {
                this.advance(); // eventsApply
                this.consume(TokenType.Equals, "Expected '=' after 'eventsApply'");
                const valTok = this.consume(TokenType.String, "Expected string value for eventsApply");
                const raw = String(valTok.value);
                const value = raw;
                if (value !== "immediate" &&
                    value !== "deferred" &&
                    value !== "cellImmediateParamsDeferred") {
                    throw this.errorAtToken(valTok, `Invalid eventsApply policy '${value}'`);
                }
                config.eventsApply = value;
                this.consumeOptional(TokenType.Semicolon);
            }
            else if (this.checkIdentifier("docstepAdvance")) {
                this.advance(); // docstepAdvance
                this.consume(TokenType.Equals, "Expected '=' after 'docstepAdvance'");
                this.consume(TokenType.LBracket, "Expected '[' after 'docstepAdvance ='");
                const specs = [];
                if (!this.check(TokenType.RBracket)) {
                    specs.push(this.parseDocstepAdvanceSpec());
                    while (this.match(TokenType.Comma)) {
                        specs.push(this.parseDocstepAdvanceSpec());
                    }
                }
                this.consume(TokenType.RBracket, "Expected ']' after docstepAdvance list");
                this.consumeOptional(TokenType.Semicolon);
                config.docstepAdvance = specs;
            }
            else {
                const tok = this.peek();
                throw this.errorAtToken(tok, `Unknown field '${tok.lexeme}' in runtime block`);
            }
        }
        this.consume(TokenType.RBrace, "Expected '}' after runtime block");
        return config;
    }
    parseDocstepAdvanceSpec() {
        // v0.1: only timer(...) supported
        this.expectIdentifier("timer", "Expected 'timer' in docstepAdvance spec");
        this.consume(TokenType.LParen, "Expected '(' after 'timer'");
        const { amount, unit } = this.parseDurationSpec();
        this.consume(TokenType.RParen, "Expected ')' after timer(...)");
        const spec = {
            kind: "timer",
            amount,
            unit,
        };
        return spec;
    }
    parseDurationSpec() {
        const numTok = this.consumeNumber("Expected numeric duration");
        const amount = Number(numTok.value);
        // Default unit if omitted: seconds
        let unit = "s";
        if (this.check(TokenType.Identifier)) {
            const unitTok = this.advance();
            const raw = String(unitTok.value);
            const lowered = raw.toLowerCase();
            const unitMap = {
                s: "s",
                sec: "s",
                secs: "s",
                second: "s",
                seconds: "s",
                ms: "ms",
                millisecond: "ms",
                milliseconds: "ms",
                m: "m",
                min: "m",
                mins: "m",
                minute: "m",
                minutes: "m",
                h: "h",
                hr: "h",
                hrs: "h",
                hour: "h",
                hours: "h",
                beat: "beats",
                beats: "beats",
                bar: "bars",
                bars: "bars",
                measure: "bars",
                measures: "bars",
                sub: "subs",
                subs: "subs",
                subdivision: "subs",
                subdivisions: "subs",
                tick: "ticks",
                ticks: "ticks",
            };
            const mapped = unitMap[lowered];
            if (!mapped) {
                throw this.errorAtToken(unitTok, `Unknown duration unit '${unitTok.lexeme}'`);
            }
            unit = mapped;
        }
        return { amount, unit };
    }
    skipRuleBlock() {
        // rule <name> ( ... ) { ... }
        this.expectIdentifier("rule", "Expected 'rule'");
        // consume name
        this.consume(TokenType.Identifier, "Expected rule name");
        // optional header args: (...)
        if (this.match(TokenType.LParen)) {
            this.skipUntilMatchingParen();
        }
        // body block
        this.consume(TokenType.LBrace, "Expected '{' to start rule body");
        this.skipBlock();
    }
    skipRuntimeBlock() {
        this.expectIdentifier("runtime", "Expected 'runtime'");
        this.consume(TokenType.LBrace, "Expected '{' after 'runtime'");
        this.skipBlock();
        return undefined; // runtime config to be implemented later
    }
    // --- Helpers: skipping ---
    skipBlock() {
        let depth = 1; // assume we've just consumed '{'
        while (!this.isAtEnd() && depth > 0) {
            const tok = this.advance();
            if (tok.type === TokenType.LBrace)
                depth++;
            else if (tok.type === TokenType.RBrace)
                depth--;
        }
    }
    skipUntilMatchingParen() {
        let depth = 1; // starting after '('
        while (!this.isAtEnd() && depth > 0) {
            const tok = this.advance();
            if (tok.type === TokenType.LParen)
                depth++;
            else if (tok.type === TokenType.RParen)
                depth--;
        }
    }
    /**
     * Skip a "field" or statement until we hit a semicolon or closing brace.
     * Used for tolerant skipping of unknown fields inside known blocks.
     */
    skipStatement() {
        while (!this.isAtEnd()) {
            if (this.check(TokenType.Semicolon)) {
                this.advance();
                return;
            }
            if (this.check(TokenType.RBrace)) {
                // caller is responsible for consuming the '}' if needed
                return;
            }
            this.advance();
        }
    }
    // --- Literal & utility parsing ---
    parseLiteral() {
        const tok = this.peek();
        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float:
                this.advance();
                return tok.value;
            case TokenType.String:
                this.advance();
                return tok.value;
            case TokenType.Bool:
                this.advance();
                return tok.value;
            case TokenType.Identifier:
                // enum literal or bare identifier; treat as string
                this.advance();
                return tok.lexeme;
            default:
                throw this.errorAtToken(tok, "Expected literal");
        }
    }
    parseValueLiteral() {
        const tok = this.peek();
        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float:
                this.advance();
                return tok.value;
            case TokenType.String:
                this.advance();
                return tok.value;
            case TokenType.Bool:
                this.advance();
                return tok.value;
            case TokenType.Identifier:
                this.advance();
                return tok.lexeme;
            case TokenType.LBracket: {
                this.advance();
                const items = [];
                if (!this.check(TokenType.RBracket)) {
                    items.push(this.parseValueLiteral());
                    while (this.match(TokenType.Comma)) {
                        items.push(this.parseValueLiteral());
                    }
                }
                this.consume(TokenType.RBracket, "Expected ']' after list literal");
                return items;
            }
            default:
                throw this.errorAtToken(tok, "Expected literal value");
        }
    }
    consumeNumber(message) {
        const tok = this.peek();
        if (tok.type === TokenType.Int || tok.type === TokenType.Float) {
            return this.advance();
        }
        throw this.errorAtToken(tok, message);
    }
    // --- Token navigation ---
    peek(offset = 0) {
        const idx = this.current + offset;
        if (idx >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1];
        }
        return this.tokens[idx];
    }
    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.tokens[this.current - 1];
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    match(...types) {
        for (const t of types) {
            if (this.check(t)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw this.errorAtToken(this.peek(), message);
    }
    consumeOptional(type) {
        if (this.check(type)) {
            this.advance();
        }
    }
    // --- Identifier/keyword helpers ---
    matchKeyword(value) {
        if (this.checkIdentifier(value)) {
            this.advance();
            return true;
        }
        return false;
    }
    checkIdentifier(value) {
        const tok = this.peek();
        return tok.type === TokenType.Identifier && tok.lexeme === value;
    }
    expectIdentifier(value, message) {
        const tok = this.peek();
        if (tok.type === TokenType.Identifier && tok.lexeme === value) {
            this.advance();
            return;
        }
        throw this.errorAtToken(tok, message);
    }
    // --- Error helper ---
    errorAtToken(token, message) {
        return new Error(`Parse error at ${token.line}:${token.column} near '${token.lexeme}': ${message}`);
    }
}
// Public API
export function parseDocument(source) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parseDocument();
}
//# sourceMappingURL=parser.js.map