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
    // NEW:
    TokenType[TokenType["Dot"] = 11] = "Dot";
    TokenType[TokenType["Greater"] = 12] = "Greater";
    TokenType[TokenType["Less"] = 13] = "Less";
    TokenType[TokenType["Bang"] = 14] = "Bang";
    // Literals
    TokenType[TokenType["Int"] = 15] = "Int";
    TokenType[TokenType["Float"] = 16] = "Float";
    TokenType[TokenType["String"] = 17] = "String";
    TokenType[TokenType["Bool"] = 18] = "Bool";
    TokenType[TokenType["Inf"] = 19] = "Inf";
    TokenType[TokenType["Identifier"] = 20] = "Identifier";
    TokenType[TokenType["EOF"] = 21] = "EOF";
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
                case "=":
                    this.advanceChar();
                    tokens.push({ type: TokenType.Equals, lexeme: "=", line: startLine, column: startCol });
                    break;
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
                    tokens.push({
                        type: TokenType.Greater,
                        lexeme: ">",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "<":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Less,
                        lexeme: "<",
                        line: startLine,
                        column: startCol,
                    });
                    break;
                case "!":
                    this.advanceChar();
                    tokens.push({
                        type: TokenType.Bang,
                        lexeme: "!",
                        line: startLine,
                        column: startCol,
                    });
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
        const rules = []; // we'll fill proper types when we implement rules
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
                // Recognized but not implemented yet.
                this.skipRuleBlock();
            }
            else if (this.checkIdentifier("runtime")) {
                // Recognized but not implemented yet.
                runtime = this.skipRuntimeBlock();
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
            rules: rules, // will be proper FluxRule[] later
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
    // --- Rule & Runtime (placeholders for now) ---
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