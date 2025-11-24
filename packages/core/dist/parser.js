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
        args.push(this.parseExpr());
        while (this.match(TokenType.Comma)) {
            args.push(this.parseExpr());
        }
        this.consume(TokenType.RParen, "Expected ')' after argument list");
        return args;
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
        this.consume(TokenType.LBrace, "Expected '{' to start rule body");
        this.expectIdentifier("when", "Expected 'when' in rule body");
        const condition = this.parseExpr();
        this.expectIdentifier("then", "Expected 'then' after rule condition");
        const thenBranch = this.parseStatementBlock();
        let elseBranch;
        if (this.checkIdentifier("else")) {
            this.advance(); // 'else'
            elseBranch = this.parseStatementBlock();
        }
        this.consume(TokenType.RBrace, "Expected '}' after rule body");
        return {
            name,
            mode,
            scope,
            onEventType,
            condition,
            thenBranch,
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
                const tok = this.peek();
                let raw;
                if (tok.type === TokenType.String || tok.type === TokenType.Identifier) {
                    this.advance();
                    raw = String(tok.value ?? tok.lexeme);
                }
                else {
                    throw this.errorAtToken(tok, "Expected identifier or string value for eventsApply");
                }
                const value = raw;
                if (value !== "immediate" &&
                    value !== "deferred" &&
                    value !== "cellImmediateParamsDeferred") {
                    throw this.errorAtToken(tok, `Invalid eventsApply policy '${value}'`);
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
        const intervalSeconds = this.parseDurationSpec();
        this.consume(TokenType.RParen, "Expected ')' after timer(...)");
        const spec = {
            kind: "timer",
            intervalSeconds,
        };
        return spec;
    }
    parseDurationSpec() {
        const numTok = this.consumeNumber("Expected numeric duration");
        const amount = Number(numTok.value);
        // Default: seconds
        if (this.check(TokenType.Identifier)) {
            const unitTok = this.advance();
            const raw = String(unitTok.value).toLowerCase();
            // time units
            if (raw === "s" || raw === "sec" || raw === "secs" || raw === "second" || raw === "seconds") {
                return amount;
            }
            if (raw === "ms" || raw === "millisecond" || raw === "milliseconds") {
                return amount / 1000;
            }
            if (raw === "m" || raw === "min" || raw === "mins" || raw === "minute" || raw === "minutes") {
                return amount * 60;
            }
            if (raw === "h" || raw === "hr" || raw === "hrs" || raw === "hour" || raw === "hours") {
                return amount * 3600;
            }
            // musical units – for now we keep them as abstract "seconds-like" quantities
            if (raw === "bar" || raw === "bars" || raw === "measure" || raw === "measures") {
                return amount;
            }
            if (raw === "beat" || raw === "beats") {
                return amount;
            }
            if (raw === "sub" || raw === "subs" || raw === "subdivision" || raw === "subdivisions") {
                return amount;
            }
            if (raw === "tick" || raw === "ticks") {
                return amount;
            }
            throw this.errorAtToken(unitTok, `Unknown duration unit '${unitTok.lexeme}'`);
        }
        // no unit → interpret as seconds
        return amount;
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