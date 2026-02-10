import fs from "node:fs";
import path from "node:path";
import {
    FluxDocument,
    FluxMeta,
    FluxState,
    FluxParam,
    FluxType,
    PageConfig,
    PageSize,
    FluxGrid,
    FluxCell,
    MaterialsBlock,
    Material,
    MaterialScore,
    MaterialMidi,
    MaterialVideo,
    AssetsBlock,
    AssetDefinition,
    AssetBank,
    TokensBlock,
    StylesBlock,
    StyleDef,
    ThemeBlock,
    BodyBlock,
    DocumentNode,
    NodePropValue,
    RefreshPolicy,
    TransitionDirection,
    TransitionEase,
    TransitionSpec,
    // rules / expressions / statements
    FluxRule,
    RuleMode,
    RuleScope,
    FluxExpr,
    CallArg,
    FluxStmt,
    BinaryOp,
    UnaryOp,
    AssignmentStmt,
    LetStmt,
    AdvanceDocstepStmt,
    ExpressionStmt,
    // runtime
    FluxRuntimeConfig,
    DocstepAdvanceSpec,
    DocstepAdvanceTimer,
    EventsApplyPolicy,
    TimerUnit,
} from "./ast.js";

/**
 * Token types for the Flux lexer.
 * We keep keywords mostly as identifiers, except for a few special literals.
 */
enum TokenType {
    // Structural
    LBrace,
    RBrace,
    LBracket,
    RBracket,
    LParen,
    RParen,
    Comma,
    Semicolon,
    Colon,
    Equals,
    At,

    // Single-char operators / punctuation
    Dot,     // .
    Greater, // >
    Less,    // <
    Bang,    // !
    Plus,    // +
    Minus,   // -
    Star,    // *
    Slash,   // /
    Percent, // %

    // Multi-char operators
    AndAnd,          // &&
    OrOr,            // ||
    EqualEqual,      // ==
    EqualEqualEqual, // ===
    BangEqual,       // !=
    BangEqualEqual,  // !==
    LessEqual,       // <=
    GreaterEqual,    // >=

    // Literals
    Int,
    Float,
    String,
    Bool,
    Inf,

    Identifier,
    EOF,
}

interface Token {
  type: TokenType;
  lexeme: string;
  value?: unknown;
  line: number;
  column: number;
}

/**
 * Simple lexer for Flux.
 * - Distinguishes Int vs Float.
 * - Handles "inf" as a dedicated keyword token.
 * - Handles true/false as Bool tokens.
 * - Supports both line (//) and block comments.
 */
class Lexer {
  private src: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(source: string) {
    this.src = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
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
        } else if (lower === "inf") {
          tokens.push({
            type: TokenType.Inf,
            lexeme: ident,
            value: "inf",
            line: startLine,
            column: startCol,
          });
        } else {
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
                    } else {
                        tokens.push({
                            type: TokenType.EqualEqual,
                            lexeme: "==",
                            line: startLine,
                            column: startCol,
                        });
                    }
                } else {
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
                } else {
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
                } else {
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
                    } else {
                        tokens.push({
                            type: TokenType.BangEqual,
                            lexeme: "!=",
                            line: startLine,
                            column: startCol,
                        });
                    }
                } else {
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
                } else {
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
                } else {
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

  private isAtEnd(): boolean {
    return this.pos >= this.src.length;
  }

  private peekChar(offset = 0): string {
    const idx = this.pos + offset;
    if (idx >= this.src.length) return "\0";
    return this.src[idx];
  }

  private advanceChar(): string {
    const ch = this.src[this.pos++] ?? "\0";
    if (ch === "\n") {
      this.line += 1;
      this.col = 1;
    } else {
      this.col += 1;
    }
    return ch;
  }

  private isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && this.isWhitespace(this.peekChar())) {
      this.advanceChar();
    }
  }

  private skipLineComment(): void {
    // assume starting at first '/'
    this.advanceChar(); // '/'
    this.advanceChar(); // second '/'
    while (!this.isAtEnd() && this.peekChar() !== "\n") {
      this.advanceChar();
    }
  }

  private skipBlockComment(): void {
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

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private readIdentifier(): string {
    let result = "";
    while (!this.isAtEnd()) {
      const ch = this.peekChar();
      if (this.isAlpha(ch) || this.isDigit(ch) || ch === "_") {
        result += this.advanceChar();
      } else {
        break;
      }
    }
    return result;
  }

  private readNumberToken(): Token {
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

  private readStringToken(): Token {
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
      } else if (ch === "\\") {
        // simple escape handling: \" and \\ only
        this.advanceChar(); // '\'
        const next = this.peekChar();
        if (next === quote || next === "\\") {
          text += this.advanceChar();
        } else {
          text += "\\" + this.advanceChar();
        }
      } else {
        text += this.advanceChar();
      }
    }
    throw this.error("Unterminated string literal", startLine, startCol);
  }

  private error(message: string, line: number, column: number): Error {
    return new Error(`Lexer error at ${line}:${column} - ${message}`);
  }
}

/**
 * Parser
 */

class Parser {
  private tokens: Token[];
  private current = 0;
  private allowBodyFragments = false;

  constructor(tokens: Token[], options: { allowBodyFragments?: boolean } = {}) {
    this.tokens = tokens;
    this.allowBodyFragments = options.allowBodyFragments ?? false;
  }

  parseDocument(): FluxDocument {
    // document { ... }
    this.expectIdentifier("document", "Expected 'document' at start of file");
    this.consume(TokenType.LBrace, "Expected '{' after 'document'");

    const meta: FluxMeta = { version: "0.1.0" };
    const state: FluxState = { params: [] };
    let pageConfig: PageConfig | undefined;
      const grids: FluxGrid[] = [];
      const rules: FluxRule[] = [];
      let runtime: FluxRuntimeConfig | undefined;
      let materials: MaterialsBlock | undefined;
      let assets: AssetsBlock | undefined;
      let tokens: TokensBlock | undefined;
      let styles: StylesBlock | undefined;
      const themes: ThemeBlock[] = [];
      let body: BodyBlock | undefined;

      while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("meta")) {
        const blockMeta = this.parseMetaBlock();
        Object.assign(meta, blockMeta);
      } else if (this.checkIdentifier("state")) {
        const st = this.parseStateBlock();
        state.params.push(...st.params);
      } else if (this.checkIdentifier("pageConfig")) {
        pageConfig = this.parsePageConfigBlock();
      } else if (this.checkIdentifier("grid")) {
          grids.push(this.parseGridBlock());
      } else if (this.checkIdentifier("rule")) {
          rules.push(this.parseRuleDecl());
      } else if (this.checkIdentifier("runtime")) {
          runtime = this.parseRuntimeBlock();
      } else if (this.checkIdentifier("assets")) {
          assets = this.parseAssetsBlock();
      } else if (this.checkIdentifier("materials")) {
          materials = this.parseMaterialsBlock();
      } else if (this.checkIdentifier("tokens")) {
          tokens = this.parseTokensBlock();
      } else if (this.checkIdentifier("styles")) {
          styles = this.parseStylesBlock();
      } else if (this.checkIdentifier("theme")) {
          themes.push(this.parseThemeBlock());
      } else if (this.checkIdentifier("body")) {
          body = this.parseBodyBlock();
      } else {
        const tok = this.peek();
        throw this.errorAtToken(tok, `Unexpected top-level construct '${tok.lexeme}'`);
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' at end of document");

      const doc: FluxDocument = {
          meta,
          state,
          pageConfig,
          grids,
          rules,
          runtime,
          materials,
          assets,
          tokens,
          styles,
          themes,
          body,
      };

      return doc;
  }

  // --- Meta ---

  private parseMetaBlock(): FluxMeta {
    this.expectIdentifier("meta", "Expected 'meta'");
    this.consume(TokenType.LBrace, "Expected '{' after 'meta'");

    const meta: FluxMeta = { version: "0.1.0" };

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const key = this.parseKeyPath("Expected meta field name");
      this.consume(TokenType.Equals, "Expected '=' after meta field name");
      const value = this.parseValueLiteral();
      meta[key] = value;
      this.consumeOptional(TokenType.Semicolon);
    }

    this.consume(TokenType.RBrace, "Expected '}' after meta block");
    return meta;
  }

  // --- State ---

  private parseStateBlock(): FluxState {
    this.expectIdentifier("state", "Expected 'state'");
    this.consume(TokenType.LBrace, "Expected '{' after 'state'");

    const params: FluxParam[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("param")) {
        params.push(this.parseParamDecl());
      } else {
        // Tolerant skip of unknown statements inside state
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after state block");
    return { params };
  }

  private parseParamDecl(): FluxParam {
    this.expectIdentifier("param", "Expected 'param'");
    const nameTok = this.consume(TokenType.Identifier, "Expected parameter name");
    const name = String(nameTok.value);

    this.consume(TokenType.Colon, "Expected ':' after parameter name");

    const typeTok = this.consume(TokenType.Identifier, "Expected parameter type");
    const typeName = String(typeTok.value) as FluxType;

    const validTypes: FluxType[] = ["int", "float", "bool", "string", "enum"];
    if (!validTypes.includes(typeName)) {
      throw this.errorAtToken(typeTok, `Unknown parameter type '${typeName}'`);
    }

    let min: number | string | undefined;
    let max: number | string | undefined;

    // Optional range
    if (this.match(TokenType.LBracket)) {
      const minLit = this.parseLiteral();
      min = minLit as any;
      this.consume(TokenType.Comma, "Expected ',' in range");
      if (this.match(TokenType.Inf)) {
        max = "inf";
      } else {
        const maxLit = this.parseLiteral();
        max = maxLit as any;
      }
      this.consume(TokenType.RBracket, "Expected ']' to close range");
    }

    this.consume(TokenType.At, "Expected '@' before initial value");
    const initLit = this.parseLiteral();

    this.consumeOptional(TokenType.Semicolon);

    const param: FluxParam = {
      name,
      type: typeName,
      min,
      max,
      initial: initLit as any,
    };

    return param;
  }

  // --- PageConfig ---

  private parsePageConfigBlock(): PageConfig {
    this.expectIdentifier("pageConfig", "Expected 'pageConfig'");
    this.consume(TokenType.LBrace, "Expected '{' after 'pageConfig'");

    let size: PageSize | undefined;

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("size")) {
        size = this.parsePageSizeBlock();
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after pageConfig block");

    if (!size) {
      throw this.errorAtToken(this.peek(), "pageConfig must contain a size block");
    }

    return { size };
  }

  private parsePageSizeBlock(): PageSize {
    this.expectIdentifier("size", "Expected 'size'");
    this.consume(TokenType.LBrace, "Expected '{' after 'size'");

    let width: number | undefined;
    let height: number | undefined;
    let units: string | undefined;

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("width")) {
        this.advance(); // width
        this.consume(TokenType.Equals, "Expected '=' after 'width'");
        const valTok = this.consumeNumber("Expected numeric width");
        width = Number(valTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("height")) {
        this.advance(); // height
        this.consume(TokenType.Equals, "Expected '=' after 'height'");
        const valTok = this.consumeNumber("Expected numeric height");
        height = Number(valTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("units")) {
        this.advance(); // units
        this.consume(TokenType.Equals, "Expected '=' after 'units'");
        const valTok = this.consume(TokenType.String, "Expected string for units");
        units = String(valTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
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

  private parseGridBlock(): FluxGrid {
    this.expectIdentifier("grid", "Expected 'grid'");
    const nameTok = this.consume(TokenType.Identifier, "Expected grid name");
    const name = String(nameTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after grid name");

    let topology: string | undefined;
    let page: number | undefined;
    let rows: number | undefined;
    let cols: number | undefined;
    const cells: FluxCell[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("topology")) {
        this.advance(); // topology
        this.consume(TokenType.Equals, "Expected '=' after 'topology'");
        const topTok = this.consume(TokenType.Identifier, "Expected topology kind");
        topology = String(topTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("page")) {
        this.advance(); // page
        this.consume(TokenType.Equals, "Expected '=' after 'page'");
        const numTok = this.consumeNumber("Expected page number");
        page = Number(numTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("size")) {
        const size = this.parseGridSizeBlock();
        rows = size.rows;
        cols = size.cols;
      } else if (this.checkIdentifier("cell")) {
        cells.push(this.parseCellBlock());
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after grid block");

    if (!topology) {
      throw this.errorAtToken(this.peek(), "Grid must declare a topology");
    }

    const grid: FluxGrid = {
      name,
      topology: topology as any,
      page,
      size: { rows, cols },
      cells,
    };

    return grid;
  }

  private parseGridSizeBlock(): { rows?: number; cols?: number } {
    this.expectIdentifier("size", "Expected 'size'");
    this.consume(TokenType.LBrace, "Expected '{' after 'size'");

    let rows: number | undefined;
    let cols: number | undefined;

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("rows")) {
        this.advance(); // rows
        this.consume(TokenType.Equals, "Expected '=' after 'rows'");
        const numTok = this.consumeNumber("Expected integer for rows");
        rows = Number(numTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("cols")) {
        this.advance(); // cols
        this.consume(TokenType.Equals, "Expected '=' after 'cols'");
        const numTok = this.consumeNumber("Expected integer for cols");
        cols = Number(numTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after size block");
    return { rows, cols };
  }

  private parseCellBlock(): FluxCell {
    this.expectIdentifier("cell", "Expected 'cell'");
    const idTok = this.consume(TokenType.Identifier, "Expected cell id");
    const id = String(idTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after cell id");

    const cell: FluxCell = {
      id,
      tags: [],
    };

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("tags")) {
        this.advance(); // tags
        this.consume(TokenType.Equals, "Expected '=' after 'tags'");
        this.consume(TokenType.LBracket, "Expected '[' after 'tags ='");
        const tags: string[] = [];
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
      } else if (this.checkIdentifier("content")) {
        this.advance(); // content
        this.consume(TokenType.Equals, "Expected '=' after 'content'");
        const strTok = this.consume(TokenType.String, "Expected string for content");
        cell.content = String(strTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("dynamic")) {
        this.advance(); // dynamic
        this.consume(TokenType.Equals, "Expected '=' after 'dynamic'");
        const numTok = this.consumeNumber("Expected numeric value for dynamic");
        cell.dynamic = Number(numTok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
        // Tolerant skip of unknown fields inside cell
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after cell block");
    return cell;
  }

  // --- Materials ---

  private parseMaterialsBlock(): MaterialsBlock {
    this.expectIdentifier("materials", "Expected 'materials'");
    this.consume(TokenType.LBrace, "Expected '{' after 'materials'");

    const materials: Material[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("material")) {
        materials.push(this.parseMaterialDecl());
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after materials block");
    return { materials };
  }

  private parseMaterialDecl(): Material {
    this.expectIdentifier("material", "Expected 'material'");
    const nameTok = this.consume(TokenType.Identifier, "Expected material name");
    const name = String(nameTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after material name");

    const material: Material = { name, tags: [] };

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("tags")) {
        material.tags = this.parseIdentifierList();
      } else if (this.checkIdentifier("label")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'label'");
        const tok = this.consume(TokenType.String, "Expected string for label");
        material.label = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("description")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'description'");
        const tok = this.consume(TokenType.String, "Expected string for description");
        material.description = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("color")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'color'");
        const tok = this.consume(TokenType.String, "Expected string for color");
        material.color = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("score")) {
        material.score = this.parseMaterialScoreBlock();
      } else if (this.checkIdentifier("midi")) {
        material.midi = this.parseMaterialMidiBlock();
      } else if (this.checkIdentifier("video")) {
        material.video = this.parseMaterialVideoBlock();
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after material block");
    return material;
  }

  private parseMaterialScoreBlock(): MaterialScore {
    this.expectIdentifier("score", "Expected 'score'");
    this.consume(TokenType.LBrace, "Expected '{' after 'score'");

    const score: MaterialScore = {};

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("text")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'text'");
        const tok = this.consume(TokenType.String, "Expected string for text");
        score.text = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("staff")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'staff'");
        const tok = this.consume(TokenType.String, "Expected string for staff");
        score.staff = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("clef")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'clef'");
        const tok = this.consume(TokenType.String, "Expected string for clef");
        score.clef = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after score block");
    return score;
  }

  private parseMaterialMidiBlock(): MaterialMidi {
    this.expectIdentifier("midi", "Expected 'midi'");
    this.consume(TokenType.LBrace, "Expected '{' after 'midi'");

    const midi: MaterialMidi = {};

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("channel")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'channel'");
        const tok = this.consumeNumber("Expected numeric channel");
        midi.channel = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("pitch")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'pitch'");
        const tok = this.consumeNumber("Expected numeric pitch");
        midi.pitch = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("velocity")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'velocity'");
        const tok = this.consumeNumber("Expected numeric velocity");
        midi.velocity = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("durationSeconds")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'durationSeconds'");
        const tok = this.consumeNumber("Expected numeric durationSeconds");
        midi.durationSeconds = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after midi block");
    return midi;
  }

  private parseMaterialVideoBlock(): MaterialVideo {
    this.expectIdentifier("video", "Expected 'video'");
    this.consume(TokenType.LBrace, "Expected '{' after 'video'");

    const video: MaterialVideo = { clip: "" };

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("clip")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'clip'");
        const tok = this.consume(TokenType.String, "Expected string for clip");
        video.clip = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("inSeconds")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'inSeconds'");
        const tok = this.consumeNumber("Expected numeric inSeconds");
        video.inSeconds = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("outSeconds")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'outSeconds'");
        const tok = this.consumeNumber("Expected numeric outSeconds");
        video.outSeconds = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("layer")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'layer'");
        const tok = this.consume(TokenType.String, "Expected string for layer");
        video.layer = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after video block");
    return video;
  }

  // --- Assets (v0.2) ---

  private parseAssetsBlock(): AssetsBlock {
    this.expectIdentifier("assets", "Expected 'assets'");
    this.consume(TokenType.LBrace, "Expected '{' after 'assets'");

    const assets: AssetDefinition[] = [];
    const banks: AssetBank[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("asset")) {
        assets.push(this.parseAssetDecl());
      } else if (this.checkIdentifier("bank")) {
        banks.push(this.parseAssetBankDecl());
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after assets block");
    return { assets, banks };
  }

  private parseAssetDecl(): AssetDefinition {
    this.expectIdentifier("asset", "Expected 'asset'");
    const nameTok = this.consume(TokenType.Identifier, "Expected asset name");
    const name = String(nameTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after asset name");

    const asset: AssetDefinition = {
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
        } else {
          throw this.errorAtToken(tok, "Expected kind identifier or string");
        }
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("path")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'path'");
        const tok = this.consume(TokenType.String, "Expected string for path");
        asset.path = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("tags")) {
        asset.tags = this.parseIdentifierList();
      } else if (this.checkIdentifier("weight")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'weight'");
        const tok = this.consumeNumber("Expected numeric weight");
        asset.weight = Number(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("meta")) {
        asset.meta = this.parseMetaMapBlock();
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after asset block");
    return asset;
  }

  private parseAssetBankDecl(): AssetBank {
    this.expectIdentifier("bank", "Expected 'bank'");
    const nameTok = this.consume(TokenType.Identifier, "Expected bank name");
    const name = String(nameTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after bank name");

    const bank: AssetBank = {
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
        } else {
          throw this.errorAtToken(tok, "Expected kind identifier or string");
        }
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("root")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'root'");
        const tok = this.consume(TokenType.String, "Expected string for root");
        bank.root = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("include")) {
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'include'");
        const tok = this.consume(TokenType.String, "Expected string for include");
        bank.include = String(tok.value);
        this.consumeOptional(TokenType.Semicolon);
      } else if (this.checkIdentifier("tags")) {
        bank.tags = this.parseIdentifierList();
      } else if (this.checkIdentifier("strategy")) {
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
        bank.strategy = raw as "weighted" | "uniform";
        this.consumeOptional(TokenType.Semicolon);
      } else {
        this.skipStatement();
      }
    }

    this.consume(TokenType.RBrace, "Expected '}' after bank block");
    return bank;
  }

  private parseMetaMapBlock(): Record<string, any> {
    this.expectIdentifier("meta", "Expected 'meta'");
    this.consume(TokenType.LBrace, "Expected '{' after 'meta'");

    const meta: Record<string, any> = {};
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const key = this.parseKeyPath("Expected meta field name");
      this.consume(TokenType.Equals, "Expected '=' after meta field name");
      const value = this.parseValueLiteral();
      meta[key] = value;
      this.consumeOptional(TokenType.Semicolon);
    }

    this.consume(TokenType.RBrace, "Expected '}' after meta block");
    return meta;
  }

  // --- Body (v0.2) ---

  private parseBodyBlock(): BodyBlock {
    this.expectIdentifier("body", "Expected 'body'");
    this.consume(TokenType.LBrace, "Expected '{' after 'body'");

    const nodes: DocumentNode[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const node = this.parseDocumentNode();
      if (!this.allowBodyFragments && node.kind !== "page") {
        throw this.errorAtToken(this.peek(), "Body block must contain page nodes at the top level");
      }
      nodes.push(node);
    }

    this.consume(TokenType.RBrace, "Expected '}' after body block");
    return { nodes };
  }

  private parseDocumentNode(): DocumentNode {
    const kindTok = this.consume(TokenType.Identifier, "Expected node kind");
    const kind = String(kindTok.value);
    const idTok = this.consume(TokenType.Identifier, "Expected node id");
    const id = String(idTok.value);

    this.consume(TokenType.LBrace, "Expected '{' after node id");

    const props: Record<string, NodePropValue> = {};
    const children: DocumentNode[] = [];
    let refresh: RefreshPolicy | undefined;
    let transition: TransitionSpec | undefined;

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("refresh")) {
        refresh = this.parseRefreshPolicy();
        continue;
      }
      if (this.checkIdentifier("transition")) {
        transition = this.parseTransitionSpec();
        continue;
      }

      if (this.looksLikeNodeDecl()) {
        children.push(this.parseDocumentNode());
        continue;
      }

      if (this.check(TokenType.Identifier)) {
        const key = this.parseKeyPath("Expected property name");
        this.consume(TokenType.Equals, "Expected '=' after property name");

        if (this.match(TokenType.At)) {
          const expr = this.parseExpr();
          props[key] = { kind: "DynamicValue", expr };
        } else {
          const value = this.parseValueLiteral();
          props[key] = { kind: "LiteralValue", value };
        }

        this.consumeOptional(TokenType.Semicolon);
        continue;
      }

      this.skipStatement();
    }

    const endTok = this.consume(TokenType.RBrace, "Expected '}' after node block");
    return {
      id,
      kind,
      props,
      children,
      refresh,
      transition,
      loc: { line: kindTok.line, column: kindTok.column, endLine: endTok.line, endColumn: endTok.column },
    };
  }

  private parseTokensBlock(): TokensBlock {
    this.expectIdentifier("tokens", "Expected 'tokens'");
    this.consume(TokenType.LBrace, "Expected '{' after 'tokens'");
    const tokens: Record<string, any> = {};
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const key = this.parseKeyPath("Expected token name");
      this.consume(TokenType.Equals, "Expected '=' after token name");
      const value = this.parseValueLiteral();
      tokens[key] = value;
      this.consumeOptional(TokenType.Semicolon);
    }
    this.consume(TokenType.RBrace, "Expected '}' after tokens block");
    return { tokens };
  }

  private parseStylesBlock(): StylesBlock {
    this.expectIdentifier("styles", "Expected 'styles'");
    this.consume(TokenType.LBrace, "Expected '{' after 'styles'");
    const styles: StyleDef[] = [];

    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const nameTok = this.consume(TokenType.Identifier, "Expected style name");
      const name = String(nameTok.value);
      let extendsName: string | undefined;
      if (this.match(TokenType.Colon)) {
        const baseTok = this.consume(TokenType.Identifier, "Expected base style name");
        extendsName = String(baseTok.value);
      }
      this.consume(TokenType.LBrace, "Expected '{' after style name");
      const props = this.parsePropertyMap();
      this.consume(TokenType.RBrace, "Expected '}' after style block");
      styles.push({ name, extends: extendsName, props });
    }

    this.consume(TokenType.RBrace, "Expected '}' after styles block");
    return { styles };
  }

  private parseThemeBlock(): ThemeBlock {
    this.expectIdentifier("theme", "Expected 'theme'");
    let name: string;
    if (this.check(TokenType.String)) {
      name = String(this.advance().value);
    } else if (this.check(TokenType.Identifier)) {
      name = String(this.advance().value);
    } else {
      throw this.errorAtToken(this.peek(), "Expected theme name");
    }

    this.consume(TokenType.LBrace, "Expected '{' after theme name");
    let tokens: TokensBlock | undefined;
    let styles: StylesBlock | undefined;
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.checkIdentifier("tokens")) {
        tokens = this.parseTokensBlock();
      } else if (this.checkIdentifier("styles")) {
        styles = this.parseStylesBlock();
      } else {
        const tok = this.peek();
        throw this.errorAtToken(tok, `Unexpected theme field '${tok.lexeme}'`);
      }
    }
    this.consume(TokenType.RBrace, "Expected '}' after theme block");
    return { name, tokens, styles };
  }

  private parseRefreshPolicy(): RefreshPolicy {
    this.expectIdentifier("refresh", "Expected 'refresh'");
    this.consume(TokenType.Equals, "Expected '=' after 'refresh'");

    if (this.checkIdentifier("never")) {
      this.advance();
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "never" };
    }
    if (this.checkIdentifier("docstep") || this.checkIdentifier("onDocstep")) {
      this.advance();
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "docstep" };
    }
    if (this.checkIdentifier("onLoad")) {
      this.advance();
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "never" };
    }
    if (this.checkIdentifier("every")) {
      this.advance();
      this.consume(TokenType.LParen, "Expected '(' after 'every'");
      const intervalSec = this.parseTimeSeconds("Expected refresh interval");
      let phaseSec = 0;
      if (this.match(TokenType.Comma)) {
        if (!this.checkIdentifier("phase")) {
          throw this.errorAtToken(this.peek(), "Expected 'phase' in every(...)");
        }
        this.advance();
        this.consume(TokenType.Equals, "Expected '=' after 'phase'");
        phaseSec = this.parseTimeSeconds("Expected phase duration", true);
      }
      this.consume(TokenType.RParen, "Expected ')' after every(...)");
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "every", intervalSec, phaseSec };
    }
    if (this.checkIdentifier("atEach")) {
      this.advance();
      this.consume(TokenType.LParen, "Expected '(' after 'atEach'");
      this.consume(TokenType.LBracket, "Expected '[' to start atEach list");
      const timesSec: number[] = [];
      if (!this.check(TokenType.RBracket)) {
        timesSec.push(this.parseTimeSeconds("Expected atEach time", true));
        while (this.match(TokenType.Comma)) {
          timesSec.push(this.parseTimeSeconds("Expected atEach time", true));
        }
      }
      this.consume(TokenType.RBracket, "Expected ']' after atEach list");
      this.consume(TokenType.RParen, "Expected ')' after atEach(...)");
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "atEach", timesSec };
    }
    if (this.checkIdentifier("at")) {
      this.advance();
      this.consume(TokenType.LParen, "Expected '(' after 'at'");
      const timeSec = this.parseTimeSeconds("Expected at(...) time", true);
      this.consume(TokenType.RParen, "Expected ')' after at(...)");
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "at", timeSec };
    }
    if (this.checkIdentifier("poisson")) {
      this.advance();
      this.consume(TokenType.LParen, "Expected '(' after 'poisson'");
      let ratePerSec: number | null = null;
      while (!this.check(TokenType.RParen) && !this.isAtEnd()) {
        if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.Equals) {
          const nameTok = this.advance();
          this.consume(TokenType.Equals, "Expected '=' after argument name");
          if (nameTok.lexeme !== "ratePerSec") {
            throw this.errorAtToken(nameTok, `Unknown poisson argument '${nameTok.lexeme}'`);
          }
          const valueTok = this.consumeNumber("Expected numeric ratePerSec");
          ratePerSec = Number(valueTok.value);
        } else {
          const valueTok = this.consumeNumber("Expected numeric ratePerSec");
          ratePerSec = Number(valueTok.value);
        }
        if (!this.match(TokenType.Comma)) break;
      }
      this.consume(TokenType.RParen, "Expected ')' after poisson(...)");
      this.consumeOptional(TokenType.Semicolon);
      if (ratePerSec == null) {
        throw this.errorAtToken(this.peek(), "poisson(ratePerSec=...) requires ratePerSec");
      }
      return { kind: "poisson", ratePerSec };
    }
    if (this.checkIdentifier("chance")) {
      this.advance();
      this.consume(TokenType.LParen, "Expected '(' after 'chance'");
      let p: number | null = null;
      let every: { kind: "docstep" } | { kind: "time"; intervalSec: number } | null = null;
      while (!this.check(TokenType.RParen) && !this.isAtEnd()) {
        if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.Equals) {
          const nameTok = this.advance();
          this.consume(TokenType.Equals, "Expected '=' after argument name");
          if (nameTok.lexeme === "p") {
            const valueTok = this.consumeNumber("Expected numeric p");
            p = Number(valueTok.value);
          } else if (nameTok.lexeme === "every") {
            every = this.parseChanceEvery();
          } else {
            throw this.errorAtToken(nameTok, `Unknown chance argument '${nameTok.lexeme}'`);
          }
        } else if (p == null) {
          const valueTok = this.consumeNumber("Expected numeric p");
          p = Number(valueTok.value);
        } else {
          throw this.errorAtToken(this.peek(), "Unexpected chance(...) argument");
        }
        if (!this.match(TokenType.Comma)) break;
      }
      this.consume(TokenType.RParen, "Expected ')' after chance(...)");
      this.consumeOptional(TokenType.Semicolon);
      if (p == null) {
        throw this.errorAtToken(this.peek(), "chance(p=..., every=...) requires p");
      }
      if (!every) {
        every = { kind: "docstep" };
      }
      return { kind: "chance", p, every };
    }
    if (this.checkIdentifier("beat")) {
      throw this.errorAtToken(this.peek(), "beat(...) refresh is not supported yet");
    }

    throw this.errorAtToken(this.peek(), "Invalid refresh policy");
  }

  private parseTransitionSpec(): TransitionSpec {
    this.expectIdentifier("transition", "Expected 'transition'");
    this.consume(TokenType.Equals, "Expected '=' after 'transition'");

    if (this.checkIdentifier("none")) {
      this.advance();
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "none" };
    }

    if (this.checkIdentifier("appear")) {
      this.advance();
      if (this.match(TokenType.LParen)) {
        this.consume(TokenType.RParen, "Expected ')' after appear(");
      }
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "appear" };
    }

    if (this.checkIdentifier("fade")) {
      this.advance();
      const args = this.parseTransitionArgs(["duration", "ease"]);
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "fade", durationMs: args.durationMs, ease: args.ease };
    }

    if (this.checkIdentifier("wipe")) {
      this.advance();
      const args = this.parseTransitionArgs(["duration", "ease", "direction"]);
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "wipe", durationMs: args.durationMs, ease: args.ease, direction: args.direction };
    }

    if (this.checkIdentifier("flash")) {
      this.advance();
      const args = this.parseTransitionArgs(["duration"]);
      this.consumeOptional(TokenType.Semicolon);
      return { kind: "flash", durationMs: args.durationMs };
    }

    throw this.errorAtToken(this.peek(), "Invalid transition spec");
  }

  private parseTransitionArgs(allowed: string[]): {
    durationMs?: number;
    ease?: TransitionEase;
    direction?: TransitionDirection;
  } {
    const args: { durationMs?: number; ease?: TransitionEase; direction?: TransitionDirection } = {};
    this.consume(TokenType.LParen, "Expected '(' after transition");
    while (!this.check(TokenType.RParen) && !this.isAtEnd()) {
      if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.Equals) {
        const nameTok = this.advance();
        const name = nameTok.lexeme;
        this.consume(TokenType.Equals, "Expected '=' after argument name");
        if (!allowed.includes(name)) {
          throw this.errorAtToken(nameTok, `Unknown transition argument '${name}'`);
        }
        if (name === "duration") {
          args.durationMs = this.parseDurationMs("Expected transition duration");
        } else if (name === "ease") {
          const ease = this.parseTransitionString("Expected transition ease");
          if (!isTransitionEase(ease)) {
            throw this.errorAtToken(nameTok, `Unknown transition ease '${ease}'`);
          }
          args.ease = ease;
        } else if (name === "direction") {
          const direction = this.parseTransitionString("Expected wipe direction");
          if (!isTransitionDirection(direction)) {
            throw this.errorAtToken(nameTok, `Unknown wipe direction '${direction}'`);
          }
          args.direction = direction;
        }
      } else {
        throw this.errorAtToken(this.peek(), "Expected named transition argument");
      }
      if (!this.match(TokenType.Comma)) break;
    }
    this.consume(TokenType.RParen, "Expected ')' after transition arguments");
    return args;
  }

  private parseTransitionString(message: string): string {
    const tok = this.peek();
    if (tok.type === TokenType.String || tok.type === TokenType.Identifier) {
      this.advance();
      return String(tok.value ?? tok.lexeme);
    }
    throw this.errorAtToken(tok, message);
  }

  private parseChanceEvery(): { kind: "docstep" } | { kind: "time"; intervalSec: number } {
    if (this.check(TokenType.Identifier)) {
      const tok = this.peek();
      if (tok.lexeme === "docstep") {
        this.advance();
        return { kind: "docstep" };
      }
    }
    if (this.check(TokenType.String)) {
      const tok = this.advance();
      const raw = String(tok.value ?? tok.lexeme);
      if (raw === "docstep") {
        return { kind: "docstep" };
      }
      const seconds = parseTimeString(raw);
      if (seconds == null) {
        throw this.errorAtToken(tok, `Invalid duration '${raw}'`);
      }
      if (seconds <= 0) {
        throw this.errorAtToken(tok, "Duration must be positive");
      }
      return { kind: "time", intervalSec: seconds };
    }
    if (this.check(TokenType.Int) || this.check(TokenType.Float)) {
      const seconds = this.parseTimeSeconds("Expected duration");
      return { kind: "time", intervalSec: seconds };
    }
    throw this.errorAtToken(this.peek(), "Expected 'docstep' or duration for chance every");
  }

  private parseTimeSeconds(message: string, allowZero = false): number {
    const tok = this.peek();
    if (tok.type === TokenType.String) {
      this.advance();
      const raw = String(tok.value ?? tok.lexeme);
      const seconds = parseTimeString(raw);
      if (seconds == null) {
        throw this.errorAtToken(tok, `Invalid duration '${raw}'`);
      }
      if (seconds < 0 || (!allowZero && seconds === 0)) {
        throw this.errorAtToken(tok, allowZero ? "Duration must be non-negative" : "Duration must be positive");
      }
      return seconds;
    }
    if (tok.type === TokenType.Int || tok.type === TokenType.Float) {
      const { amount, unit } = this.parseDurationSpec();
      const seconds = durationToSeconds(amount, unit);
      if (seconds == null) {
        throw this.errorAtToken(tok, `Unsupported duration unit '${unit}'`);
      }
      if (seconds < 0 || (!allowZero && seconds === 0)) {
        throw this.errorAtToken(tok, allowZero ? "Duration must be non-negative" : "Duration must be positive");
      }
      return seconds;
    }
    throw this.errorAtToken(tok, message);
  }

  private parseDurationMs(message: string): number {
    const tok = this.peek();
    if (tok.type === TokenType.String) {
      this.advance();
      const raw = String(tok.value ?? tok.lexeme);
      const seconds = parseTimeString(raw);
      if (seconds == null) {
        throw this.errorAtToken(tok, `Invalid duration '${raw}'`);
      }
      if (seconds < 0) {
        throw this.errorAtToken(tok, "Duration must be non-negative");
      }
      return seconds * 1000;
    }
    if (tok.type === TokenType.Int || tok.type === TokenType.Float) {
      if (this.peek(1).type === TokenType.Identifier) {
        const { amount, unit } = this.parseDurationSpec();
        const seconds = durationToSeconds(amount, unit);
        if (seconds == null) {
          throw this.errorAtToken(tok, `Unsupported duration unit '${unit}'`);
        }
        if (seconds < 0) {
          throw this.errorAtToken(tok, "Duration must be non-negative");
        }
        return seconds * 1000;
      }
      this.advance();
      const amount = Number(tok.value);
      if (!Number.isFinite(amount)) {
        throw this.errorAtToken(tok, message);
      }
      if (amount < 0) {
        throw this.errorAtToken(tok, "Duration must be non-negative");
      }
      return amount;
    }
    throw this.errorAtToken(tok, message);
  }

  private looksLikeNodeDecl(): boolean {
    return (
      this.check(TokenType.Identifier) &&
      this.peek(1).type === TokenType.Identifier &&
      this.peek(2).type === TokenType.LBrace
    );
  }

  private parseIdentifierList(): string[] {
    this.advance(); // identifier keyword already checked
    this.consume(TokenType.Equals, "Expected '=' after identifier list key");
    this.consume(TokenType.LBracket, "Expected '[' to start identifier list");

    const values: string[] = [];
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

  private parseKeyPath(message: string): string {
    const first = this.consume(TokenType.Identifier, message);
    const parts = [String(first.value)];
    while (this.match(TokenType.Dot)) {
      const next = this.consume(TokenType.Identifier, "Expected identifier after '.'");
      parts.push(String(next.value));
    }
    return parts.join(".");
  }

  private parsePropertyMap(): Record<string, NodePropValue> {
    const props: Record<string, NodePropValue> = {};
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const key = this.parseKeyPath("Expected property name");
      this.consume(TokenType.Equals, "Expected '=' after property name");

      if (this.match(TokenType.At)) {
        const expr = this.parseExpr();
        props[key] = { kind: "DynamicValue", expr };
      } else {
        const value = this.parseValueLiteral();
        props[key] = { kind: "LiteralValue", value };
      }

      this.consumeOptional(TokenType.Semicolon);
    }
    return props;
  }

    // --- Expressions ---

    private parseExpr(): FluxExpr {
        return this.parseOr();
    }

    private parseOr(): FluxExpr {
        let expr = this.parseAnd();
        while (true) {
            if (this.matchKeyword("or") || this.match(TokenType.OrOr)) {
                const right = this.parseAnd();
                expr = this.makeBinary(expr, "or", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseAnd(): FluxExpr {
        let expr = this.parseEquality();
        while (true) {
            if (this.matchKeyword("and") || this.match(TokenType.AndAnd)) {
                const right = this.parseEquality();
                expr = this.makeBinary(expr, "and", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseEquality(): FluxExpr {
        let expr = this.parseComparison();
        while (true) {
            if (this.match(TokenType.EqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "==", right);
            } else if (this.match(TokenType.BangEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "!=", right);
            } else if (this.match(TokenType.EqualEqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "===", right);
            } else if (this.match(TokenType.BangEqualEqual)) {
                const right = this.parseComparison();
                expr = this.makeBinary(expr, "!==", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseComparison(): FluxExpr {
        let expr = this.parseTerm();
        while (true) {
            if (this.match(TokenType.Less)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, "<", right);
            } else if (this.match(TokenType.LessEqual)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, "<=", right);
            } else if (this.match(TokenType.Greater)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, ">", right);
            } else if (this.match(TokenType.GreaterEqual)) {
                const right = this.parseTerm();
                expr = this.makeBinary(expr, ">=", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseTerm(): FluxExpr {
        let expr = this.parseFactor();
        while (true) {
            if (this.match(TokenType.Plus)) {
                const right = this.parseFactor();
                expr = this.makeBinary(expr, "+", right);
            } else if (this.match(TokenType.Minus)) {
                const right = this.parseFactor();
                expr = this.makeBinary(expr, "-", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseFactor(): FluxExpr {
        let expr = this.parseUnary();
        while (true) {
            if (this.match(TokenType.Star)) {
                const right = this.parseUnary();
                expr = this.makeBinary(expr, "*", right);
            } else if (this.match(TokenType.Slash)) {
                const right = this.parseUnary();
                expr = this.makeBinary(expr, "/", right);
            } else {
                break;
            }
        }
        return expr;
    }

    private parseUnary(): FluxExpr {
        if (this.matchKeyword("not") || this.match(TokenType.Bang)) {
            const argument = this.parseUnary();
            const op: UnaryOp = "not";
            return {
                kind: "UnaryExpression",
                op,
                argument,
                loc: argument?.loc,
            };
        }
        if (this.match(TokenType.Minus)) {
            const argument = this.parseUnary();
            const op: UnaryOp = "-";
            return {
                kind: "UnaryExpression",
                op,
                argument,
                loc: argument?.loc,
            };
        }
        return this.parsePostfix();
    }

    private parsePostfix(): FluxExpr {
        let expr = this.parsePrimary();

        while (true) {
            if (this.match(TokenType.Dot)) {
                const nameTok = this.consume(TokenType.Identifier, "Expected property name after '.'");
                const property = String(nameTok.value);
                expr = {
                    kind: "MemberExpression",
                    object: expr,
                    property,
                    loc: expr?.loc,
                };
            } else if (this.match(TokenType.LParen)) {
                const args = this.parseArgumentList();
                const callExpr = this.maybeNeighborsCall(expr, args) as FluxExpr;
                (callExpr as any).loc = expr?.loc;
                expr = callExpr;
            } else {
                break;
            }
        }

        return expr;
    }

    private parsePrimary(): FluxExpr {
        const tok = this.peek();

        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value as number,
                    loc: { line: tok.line, column: tok.column },
                };
            }
            case TokenType.String: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value as string,
                    loc: { line: tok.line, column: tok.column },
                };
            }
            case TokenType.Bool: {
                this.advance();
                return {
                    kind: "Literal",
                    value: tok.value as boolean,
                    loc: { line: tok.line, column: tok.column },
                };
            }
            case TokenType.LBracket: {
                this.advance(); // '['
                const items: FluxExpr[] = [];
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
                    loc: { line: tok.line, column: tok.column },
                };
            }
            case TokenType.Identifier: {
                this.advance();
                return {
                    kind: "Identifier",
                    name: tok.lexeme,
                    loc: { line: tok.line, column: tok.column },
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

    private parseArgumentList(): CallArg[] {
        const args: CallArg[] = [];
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

    private parseCallArg(): CallArg {
        if (this.check(TokenType.Identifier) && this.peek(1).type === TokenType.Equals) {
            const nameTok = this.advance();
            const name = String(nameTok.value);
            this.consume(TokenType.Equals, "Expected '=' after argument name");
            const value = this.parseExpr();
            return { kind: "NamedArg", name, value };
        }
        return this.parseExpr();
    }

    private maybeNeighborsCall(callee: FluxExpr, args: CallArg[]): FluxExpr {
        if (
            callee.kind === "MemberExpression" &&
            callee.object.kind === "Identifier" &&
            callee.object.name === "neighbors"
        ) {
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

    private makeBinary(left: FluxExpr, op: BinaryOp, right: FluxExpr): FluxExpr {
        return {
            kind: "BinaryExpression",
            op,
            left,
            right,
            loc: left?.loc,
        };
    }

    // --- Rule & Runtime (placeholders for now) ---
    // --- Rules ---

    private parseRuleDecl(): FluxRule {
        this.expectIdentifier("rule", "Expected 'rule'");
        const nameTok = this.consume(TokenType.Identifier, "Expected rule name");
        const name = String(nameTok.value);

        const { mode, scope, onEventType } = this.parseRuleHeader();

        // Enforce event header constraints
        if (mode === "event" && !onEventType) {
            throw this.errorAtToken(
                this.peek(),
                "Event rules must specify an 'on=\"...\"' event type",
            );
        }

        this.consume(TokenType.LBrace, "Expected '{' to start rule body");

        // First branch: when ... then { ... }
        this.expectIdentifier("when", "Expected 'when' in rule body");
        const firstCondition = this.parseExpr();

        this.expectIdentifier("then", "Expected 'then' after rule condition");
        const firstThen = this.parseStatementBlock();

        const branches: { condition: FluxExpr; thenBranch: FluxStmt[] }[] = [
            { condition: firstCondition, thenBranch: firstThen },
        ];

        let elseBranch: FluxStmt[] | undefined;

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
            } else {
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

    private parseRuleHeader(): {
        mode: RuleMode;
        scope?: RuleScope;
        onEventType?: string;
    } {
        let mode: RuleMode = "docstep";
        let scope: RuleScope | undefined;
        let onEventType: string | undefined;

        if (this.match(TokenType.LParen)) {
            if (!this.check(TokenType.RParen)) {
                while (true) {
                    const keyTok = this.consume(TokenType.Identifier, "Expected header key");
                    const key = String(keyTok.value);

                    this.consume(TokenType.Equals, "Expected '=' after header key");

                    if (key === "mode") {
                        const valTok = this.consume(TokenType.Identifier, "Expected mode value");
                        const val = String(valTok.value) as RuleMode;
                        if (val !== "docstep" && val !== "event" && val !== "timer") {
                            throw this.errorAtToken(valTok, `Invalid rule mode '${val}'`);
                        }
                        mode = val;
                    } else if (key === "grid") {
                        const valTok = this.consume(TokenType.Identifier, "Expected grid name");
                        const gridName = String(valTok.value);
                        scope = { grid: gridName };
                    } else if (key === "on") {
                        const valTok = this.consume(TokenType.String, "Expected string for 'on'");
                        onEventType = String(valTok.value);
                    } else {
                        throw this.errorAtToken(keyTok, `Unknown rule header key '${key}'`);
                    }

                    if (!this.match(TokenType.Comma)) break;
                }
            }
            this.consume(TokenType.RParen, "Expected ')' after rule header");
        }

        return { mode, scope, onEventType };
    }

    private parseStatementBlock(): FluxStmt[] {
        this.consume(TokenType.LBrace, "Expected '{' to start block");
        const statements: FluxStmt[] = [];
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        this.consume(TokenType.RBrace, "Expected '}' to close block");
        return statements;
    }

    private parseStatement(): FluxStmt {
        if (this.checkIdentifier("let")) {
            return this.parseLetStatement();
        }

        if (this.checkIdentifier("advanceDocstep")) {
            return this.parseAdvanceDocstepStatement();
        }

        // For v0.1: only assignments beyond 'let' and 'advanceDocstep'
        const lhs = this.parseExpr();

        if (!this.match(TokenType.Equals)) {
            throw this.errorAtToken(
                this.peek(),
                "Only assignment, 'let', and 'advanceDocstep()' statements are allowed in rule bodies in v0.1",
            );
        }

        const value = this.parseExpr();
        this.consumeOptional(TokenType.Semicolon);

        if (lhs.kind !== "Identifier" && lhs.kind !== "MemberExpression") {
            throw this.errorAtToken(this.peek(), "Invalid assignment target");
        }

        const stmt: AssignmentStmt = {
            kind: "AssignmentStatement",
            target: lhs,
            value,
        };

        return stmt;
    }

    private parseLetStatement(): LetStmt {
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

    private parseAdvanceDocstepStatement(): AdvanceDocstepStmt {
        this.expectIdentifier("advanceDocstep", "Expected 'advanceDocstep'");
        this.consume(TokenType.LParen, "Expected '(' after 'advanceDocstep'");
        this.consume(TokenType.RParen, "Expected ')' after 'advanceDocstep('");
        this.consumeOptional(TokenType.Semicolon);
        return {
            kind: "AdvanceDocstepStatement",
        };
    }

    // --- Runtime ---

    private parseRuntimeBlock(): FluxRuntimeConfig {
        this.expectIdentifier("runtime", "Expected 'runtime'");
        this.consume(TokenType.LBrace, "Expected '{' after 'runtime'");

        const config: FluxRuntimeConfig = {};

        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            if (this.checkIdentifier("eventsApply")) {
                this.advance(); // eventsApply
                this.consume(TokenType.Equals, "Expected '=' after 'eventsApply'");

                const valTok = this.consume(
                    TokenType.String,
                    "Expected string value for eventsApply",
                );
                const raw = String(valTok.value);
                const value = raw as EventsApplyPolicy;

                if (
                    value !== "immediate" &&
                    value !== "deferred" &&
                    value !== "cellImmediateParamsDeferred"
                ) {
                    throw this.errorAtToken(valTok, `Invalid eventsApply policy '${value}'`);
                }

                config.eventsApply = value;
                this.consumeOptional(TokenType.Semicolon);
            } else if (this.checkIdentifier("docstepAdvance")) {
                this.advance(); // docstepAdvance
                this.consume(TokenType.Equals, "Expected '=' after 'docstepAdvance'");
                this.consume(TokenType.LBracket, "Expected '[' after 'docstepAdvance ='");

                const specs: DocstepAdvanceSpec[] = [];
                if (!this.check(TokenType.RBracket)) {
                    specs.push(this.parseDocstepAdvanceSpec());
                    while (this.match(TokenType.Comma)) {
                        specs.push(this.parseDocstepAdvanceSpec());
                    }
                }

                this.consume(TokenType.RBracket, "Expected ']' after docstepAdvance list");
                this.consumeOptional(TokenType.Semicolon);
                config.docstepAdvance = specs;
            } else {
                const tok = this.peek();
                throw this.errorAtToken(tok, `Unknown field '${tok.lexeme}' in runtime block`);
            }
        }

        this.consume(TokenType.RBrace, "Expected '}' after runtime block");
        return config;
    }

    private parseDocstepAdvanceSpec(): DocstepAdvanceSpec {
        // v0.1: only timer(...) supported
        this.expectIdentifier("timer", "Expected 'timer' in docstepAdvance spec");
        this.consume(TokenType.LParen, "Expected '(' after 'timer'");
        const { amount, unit } = this.parseDurationSpec();
        this.consume(TokenType.RParen, "Expected ')' after timer(...)");

        const spec: DocstepAdvanceTimer = {
            kind: "timer",
            amount,
            unit,
        };

        return spec;
    }

    private parseDurationSpec(): { amount: number; unit: TimerUnit } {
        const numTok = this.consumeNumber("Expected numeric duration");
        const amount = Number(numTok.value);

        // Default unit if omitted: seconds
        let unit: TimerUnit = "s";

        if (this.check(TokenType.Identifier)) {
            const unitTok = this.advance();
            const raw = String(unitTok.value);
            const lowered = raw.toLowerCase();

            const unitMap: Record<string, TimerUnit> = {
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

    private skipRuleBlock(): void {
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

  private skipRuntimeBlock(): any {
    this.expectIdentifier("runtime", "Expected 'runtime'");
    this.consume(TokenType.LBrace, "Expected '{' after 'runtime'");
    this.skipBlock();
    return undefined; // runtime config to be implemented later
  }

  // --- Helpers: skipping ---

  private skipBlock(): void {
    let depth = 1; // assume we've just consumed '{'
    while (!this.isAtEnd() && depth > 0) {
      const tok = this.advance();
      if (tok.type === TokenType.LBrace) depth++;
      else if (tok.type === TokenType.RBrace) depth--;
    }
  }

  private skipUntilMatchingParen(): void {
    let depth = 1; // starting after '('
    while (!this.isAtEnd() && depth > 0) {
      const tok = this.advance();
      if (tok.type === TokenType.LParen) depth++;
      else if (tok.type === TokenType.RParen) depth--;
    }
  }

  /**
   * Skip a "field" or statement until we hit a semicolon or closing brace.
   * Used for tolerant skipping of unknown fields inside known blocks.
   */
  private skipStatement(): void {
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

  private parseLiteral(): unknown {
    const tok = this.peek();
    switch (tok.type) {
      case TokenType.Int:
      case TokenType.Float:
        this.advance();
        return tok.value as number;
      case TokenType.String:
        this.advance();
        return tok.value as string;
      case TokenType.Bool:
        this.advance();
        return tok.value as boolean;
      case TokenType.Identifier:
        // enum literal or bare identifier; treat as string
        this.advance();
        return tok.lexeme;
      default:
        throw this.errorAtToken(tok, "Expected literal");
    }
  }

  private parseValueLiteral(): any {
    const tok = this.peek();
    switch (tok.type) {
      case TokenType.Int:
      case TokenType.Float:
        this.advance();
        return tok.value as number;
      case TokenType.String:
        this.advance();
        return tok.value as string;
      case TokenType.Bool:
        this.advance();
        return tok.value as boolean;
      case TokenType.Identifier:
        this.advance();
        return tok.lexeme;
      case TokenType.LBracket: {
        this.advance();
        const items: any[] = [];
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

  private consumeNumber(message: string): Token {
    const tok = this.peek();
    if (tok.type === TokenType.Int || tok.type === TokenType.Float) {
      return this.advance();
    }
    throw this.errorAtToken(tok, message);
  }

  // --- Token navigation ---

  private peek(offset = 0): Token {
    const idx = this.current + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[idx];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.errorAtToken(this.peek(), message);
  }

  private consumeOptional(type: TokenType): void {
    if (this.check(type)) {
      this.advance();
    }
  }

  // --- Identifier/keyword helpers ---

    private matchKeyword(value: string): boolean {
        if (this.checkIdentifier(value)) {
            this.advance();
            return true;
        }
        return false;
    }

  private checkIdentifier(value: string): boolean {
    const tok = this.peek();
    return tok.type === TokenType.Identifier && tok.lexeme === value;
  }

  private expectIdentifier(value: string, message: string): void {
    const tok = this.peek();
    if (tok.type === TokenType.Identifier && tok.lexeme === value) {
      this.advance();
      return;
    }
    throw this.errorAtToken(tok, message);
  }

  // --- Error helper ---

  private errorAtToken(token: Token, message: string): Error {
    return new Error(
      `Parse error at ${token.line}:${token.column} near '${token.lexeme}': ${message}`,
    );
  }
}

function isTransitionEase(value: string): value is TransitionEase {
  return value === "linear" || value === "inOut" || value === "in" || value === "out";
}

function isTransitionDirection(value: string): value is TransitionDirection {
  return value === "left" || value === "right" || value === "up" || value === "down";
}

// Public API
export interface ParseOptions {
  sourcePath?: string;
  docRoot?: string;
  resolveIncludes?: boolean;
  maxIncludeBytes?: number;
  includeDepthLimit?: number;
  allowBodyFragments?: boolean;
}

const DEFAULT_INCLUDE_BYTES = 1024 * 1024;
const DEFAULT_INCLUDE_DEPTH = 8;

export function parseDocument(source: string, options: ParseOptions = {}): FluxDocument {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, { allowBodyFragments: options.allowBodyFragments });
  const doc = parser.parseDocument();

  const shouldResolve = options.resolveIncludes || options.sourcePath || options.docRoot;
  if (!shouldResolve) return doc;

  const root = options.docRoot ?? (options.sourcePath ? path.dirname(options.sourcePath) : null);
  if (!root) return doc;

  return resolveIncludes(doc, {
    docRoot: root,
    sourcePath: options.sourcePath ?? "<buffer>",
    maxIncludeBytes: options.maxIncludeBytes ?? DEFAULT_INCLUDE_BYTES,
    includeDepthLimit: options.includeDepthLimit ?? DEFAULT_INCLUDE_DEPTH,
  });
}

interface IncludeContext {
  docRoot: string;
  sourcePath: string;
  maxIncludeBytes: number;
  includeDepthLimit: number;
  seen: Set<string>;
}

function resolveIncludes(doc: FluxDocument, options: Omit<IncludeContext, "seen">): FluxDocument {
  const context: IncludeContext = { ...options, seen: new Set<string>() };
  const body = doc.body;
  if (!body?.nodes?.length) return doc;
  const nodes = resolveIncludeNodes(body.nodes, context, "root", 0);
  return { ...doc, body: { nodes } };
}

function resolveIncludeNodes(
  nodes: DocumentNode[],
  ctx: IncludeContext,
  parentPath: string,
  depth: number,
): DocumentNode[] {
  if (depth > ctx.includeDepthLimit) {
    throw new Error(`Include depth exceeds limit (${ctx.includeDepthLimit}) at ${parentPath}`);
  }
  const result: DocumentNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
    if (node.kind === "include") {
      const includePath = resolveIncludePath(node, ctx, nodePath);
      const included = loadIncludedDocument(includePath, ctx, depth + 1);
      const includeNodes = included.body?.nodes ?? [];
      const rewritten = rewriteNodeIds(includeNodes, includePath, nodePath);
      result.push(...rewritten);
      continue;
    }
    const children = node.children?.length
      ? resolveIncludeNodes(node.children, ctx, nodePath, depth)
      : [];
    result.push({ ...node, children });
  }
  return result;
}

function resolveIncludePath(node: DocumentNode, ctx: IncludeContext, nodePath: string): string {
  const raw =
    node.props?.path?.kind === "LiteralValue"
      ? String(node.props.path.value)
      : node.props?.src?.kind === "LiteralValue"
        ? String(node.props.src.value)
        : null;
  if (!raw) {
    throw new Error(
      `Include at ${nodePath} requires a literal 'path' (or 'src') string`,
    );
  }
  if (path.isAbsolute(raw)) {
    throw new Error(`Include path must be relative: '${raw}'`);
  }
  if (raw.split(/[\\/]+/).some((part) => part === "..")) {
    throw new Error(`Include path cannot contain '..': '${raw}'`);
  }
  const resolved = path.resolve(ctx.docRoot, raw);
  if (!resolved.startsWith(ctx.docRoot)) {
    throw new Error(`Include path escapes doc root: '${raw}'`);
  }
  if (path.extname(resolved) !== ".flux") {
    throw new Error(`Include path must target a .flux file: '${raw}'`);
  }
  return resolved;
}

function parseTimeString(raw: string): number | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([0-9]*\.?[0-9]+)\s*(ms|s|m)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "ms":
      return value / 1000;
    case "s":
      return value;
    case "m":
      return value * 60;
    default:
      return null;
  }
}

function durationToSeconds(amount: number, unit: TimerUnit): number | null {
  switch (unit) {
    case "ms":
      return amount / 1000;
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return amount;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return amount * 60;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return amount * 3600;
    default:
      return null;
  }
}

function loadIncludedDocument(filePath: string, ctx: IncludeContext, depth: number): FluxDocument {
  if (ctx.seen.has(filePath)) {
    throw new Error(`Include cycle detected at '${filePath}'`);
  }
  ctx.seen.add(filePath);
  const stat = fs.statSync(filePath);
  if (stat.size > ctx.maxIncludeBytes) {
    throw new Error(`Include file too large (${stat.size} bytes): '${filePath}'`);
  }
  const source = fs.readFileSync(filePath, "utf8");
  const doc = parseDocument(source, {
    sourcePath: filePath,
    docRoot: ctx.docRoot,
    resolveIncludes: true,
    maxIncludeBytes: ctx.maxIncludeBytes,
    includeDepthLimit: ctx.includeDepthLimit - depth,
    allowBodyFragments: true,
  });
  ctx.seen.delete(filePath);
  return doc;
}

function rewriteNodeIds(nodes: DocumentNode[], includePath: string, parentPath: string): DocumentNode[] {
  return nodes.map((node, index) => {
    const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
    const hash = stableHash(includePath, nodePath).toString(16).padStart(6, "0");
    const nextId = `${node.id}_${hash}`;
    const children = rewriteNodeIds(node.children ?? [], includePath, nodePath);
    return { ...node, id: nextId, children };
  });
}

function stableHash(...values: unknown[]): number {
  const serialized = values.map((value) => stableSerialize(value)).join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableSerialize(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "number") return `n:${String(value)}`;
  if (typeof value === "string") return `s:${value}`;
  if (typeof value === "boolean") return `b:${value}`;
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `o:{${entries
      .map(([key, val]) => `${key}:${stableSerialize(val)}`)
      .join(",")}}`;
  }
  return `u:${String(value)}`;
}
