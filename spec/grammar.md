# Flux Grammar (v0.2.0)

This document specifies a minimal grammar for the Flux language using an EBNF-like notation.

## 1. Lexical structure

Whitespace:

- `WS` (spaces, tabs, newlines) is ignored except where it separates tokens.

Comments:

- Line comment: `//` until end of line.
- Block comment: `/*` … `*/` (not nestable).

Identifiers:

- `IDENT` : `[A-Za-z_][A-Za-z0-9_]*`
- Identifiers are **case-sensitive**. CamelCase is recommended but not enforced.

Literals:

- Integer: `INT` : `[-]?[0-9]+`
- Float: `FLOAT` : `[-]?[0-9]+\.[0-9]+`
- Boolean: `BOOL` : `true` | `false`
- String: `STRING` : double-quoted, with escape sequences (implementation-defined).

Numbers:

- `NUMBER` : `INT` | `FLOAT`

Keywords (reserved):

```text
document, meta, state, pageConfig, assets, asset, bank, body,
page, section, row, column, spacer, text, image, figure, table, grid, slot,
refresh, onLoad, onDocstep, every, never,
size, cell, tags, content, mediaId, payload, dynamic, density, salience, numericFields,
param, int, float, bool, string, enum, rule, when, then, else,
runtime, eventsApply, docstepAdvance, timer, onTransport, onRuleRequest,
true, false, and, or, not, let, advanceDocstep, mode, event, docstep, timer,
topology, input, transport, sensor
````

Operators and punctuation:

```text
=  : assignment / initialization
@  : initial value separator in params
[ ] : lists and ranges
{ } : blocks
( ) : grouping and function calls
,  : separator
;  : statement terminator
.  : member access
+ - * / : arithmetic
== != < <= > >= : comparison
```

## 2. Top-level

```ebnf
Document      ::= "document" "{" DocumentBody "}"

DocumentBody  ::= { MetaBlock | StateBlock | PageConfigBlock
                   | AssetsBlock | BodyBlock
                   | GridBlock | RuleDecl | RuntimeBlock | MaterialsBlock }

MetaBlock     ::= "meta" "{" { MetaField } "}"
MetaField     ::= IDENT "=" STRING ";"
```

At least one `meta` block with a `version` field SHOULD be present.

## 3. State and parameters

```ebnf
StateBlock    ::= "state" "{" { ParamDecl } "}"

ParamDecl     ::= "param" IDENT ":" TypeSpec RangeSpec? "@" Literal ";"

TypeSpec      ::= "int" | "float" | "bool" | "string" | "enum"

RangeSpec     ::= "[" Literal "," Literal "]"
                | "[" Literal "," "inf" "]"
```

`Literal` is defined in §7. Range bounds must be compatible with the parameter type.

## 4. Page configuration

```ebnf
PageConfigBlock ::= "pageConfig" "{" PageSizeBlock "}"

PageSizeBlock   ::= "size" "{" PageSizeField { PageSizeField } "}"

PageSizeField   ::= "width"  "=" NUMBER ";"
                  | "height" "=" NUMBER ";"
                  | "units"  "=" STRING ";"
```

Units are implementation-defined strings (e.g. `"mm"`, `"pt"`, `"px"`).

## 5. Assets (v0.2)

```ebnf
AssetsBlock ::= "assets" "{" { AssetDecl | BankDecl } "}"

AssetDecl   ::= "asset" IDENT "{" { AssetField } "}"
AssetField  ::= "kind" "=" IDENT ";"
             | "path" "=" STRING ";"
             | "tags" "=" "[" IdentList? "]" ";"
             | "weight" "=" NUMBER ";"
             | MetaMap

BankDecl    ::= "bank" IDENT "{" { BankField } "}"
BankField   ::= "kind" "=" IDENT ";"
             | "root" "=" STRING ";"
             | "include" "=" STRING ";"
             | "tags" "=" "[" IdentList? "]" ";"
             | "strategy" "=" IDENT ";"  // "weighted" | "uniform"

MetaMap     ::= "meta" "{" { IDENT "=" Literal ";" } "}"
```

`materials { ... }` is a legacy alias that is preserved for compatibility. See §11.

## 6. Document body (v0.2)

```ebnf
BodyBlock   ::= "body" "{" { PageNode } "}"

PageNode    ::= "page" IDENT NodeBlock

NodeBlock   ::= "{" { NodeItem } "}"
NodeItem    ::= NodeDecl | RefreshField | PropField

NodeDecl    ::= NodeKind IDENT NodeBlock
NodeKind    ::= "page" | "section" | "row" | "column" | "spacer"
             | "text" | "image" | "figure" | "table" | "grid" | "slot"

RefreshField ::= "refresh" "=" RefreshPolicy ";"
RefreshPolicy ::= "onLoad" | "onDocstep" | "never" | "every" "(" Duration ")"

PropField   ::= IDENT "=" Value ";"
Value       ::= Literal | ListLiteral | "@" Expr
```

If a node omits `refresh`, it inherits the nearest ancestor refresh policy.
If no ancestor defines a refresh policy, the default is `onLoad`.

## 7. Grids and cells (v0.1 legacy)

```ebnf
GridBlock    ::= "grid" IDENT "{" GridBody "}"

GridBody     ::= GridTopologyField
                 PageField?
                 GridSizeBlock?
                 { CellBlock }

GridTopologyField ::= "topology" "=" TopologyKind ";"
TopologyKind      ::= "grid" | "linear" | "graph" | "spatial"

PageField    ::= "page" "=" INT ";"

GridSizeBlock ::= "size" "{" GridSizeField { GridSizeField } "}"
GridSizeField ::= "rows" "=" INT ";"
                | "cols" "=" INT ";"

CellBlock    ::= "cell" IDENT "{" { CellField } "}"

CellField    ::= CellTagsField
               | CellContentField
               | CellMediaField
               | CellPayloadField
               | CellStdNumericField
               | CellNumericField

CellTagsField      ::= "tags" "=" "[" TagList? "]" ";"
TagList            ::= IDENT { "," IDENT }

CellContentField   ::= "content" "=" STRING ";"

CellMediaField     ::= "mediaId" "=" STRING ";"

CellStdNumericField ::= "dynamic" "=" NUMBER ";"
                      | "density" "=" NUMBER ";"
                      | "salience" "=" NUMBER ";"

CellNumericField   ::= "numericFields" "." IDENT "=" NUMBER ";"
```

### Payloads

```ebnf
CellPayloadField   ::= "payload" "=" PayloadExpr ";"

PayloadExpr        ::= "none"
                     | "phrase" "{" PhraseField { PhraseField } "}"
                     | "audio_clip" "{" AudioField { AudioField } "}"
                     | "image" "{" ImageField { ImageField } "}"
                     | "video" "{" VideoField { VideoField } "}"
                     | IDENT "{" UserPayloadField { UserPayloadField } "}"

PhraseField        ::= "instrument" "=" STRING ";"
                     | "pitches"    "=" "[" StringList? "]" ";"
                     | "durations"  "=" "[" NumberList? "]" ";"

AudioField         ::= "start"    "=" NUMBER ";"
                     | "duration" "=" NUMBER ";"
                     | "gain"     "=" NUMBER ";"

ImageField         ::= "crop" "=" "{" CropField { CropField } "}" ";"
                     | "opacity" "=" NUMBER ";"

CropField          ::= "x" "=" NUMBER ";"
                     | "y" "=" NUMBER ";"
                     | "w" "=" NUMBER ";"
                     | "h" "=" NUMBER ";"

VideoField         ::= "start" "=" NUMBER ";"
                     | "end"   "=" NUMBER ";"
                     | "loop"  "=" BOOL ";"

UserPayloadField   ::= IDENT "=" Literal ";"

StringList         ::= STRING { "," STRING }
NumberList         ::= NUMBER { "," NUMBER }
```

## 8. Rules

```ebnf
RuleDecl    ::= "rule" IDENT "(" RuleHeaderArgs? ")" "{" RuleBody "}"

RuleHeaderArgs ::= RuleHeaderArg { "," RuleHeaderArg }
RuleHeaderArg  ::= "mode" "=" RuleMode
                 | "grid" "=" IDENT
                 | "on"   "=" STRING

RuleMode    ::= "docstep" | "event" | "timer"

RuleBody    ::= "when" BoolExpr "then" Block [ "else" Block ]
```

`Block` and expressions/statements are defined in §9.

## 9. Expressions and statements

### 9.1 Literals

```ebnf
Literal     ::= NUMBER | STRING | BOOL | IDENT
```

### 9.2 Expressions

```ebnf
Expr        ::= OrExpr

OrExpr      ::= AndExpr { "or" AndExpr }
AndExpr     ::= EqualityExpr { "and" EqualityExpr }

EqualityExpr ::= RelExpr { ("==" | "!=") RelExpr }
RelExpr      ::= AddExpr  { ("<" | "<=" | ">" | ">=") AddExpr }
AddExpr      ::= MulExpr  { ("+" | "-") MulExpr }
MulExpr      ::= UnaryExpr { ("*" | "/") UnaryExpr }

UnaryExpr   ::= ("not" | "-") UnaryExpr
              | Primary

Primary     ::= Literal
              | ListLiteral
              | IDENT
              | MemberExpr
              | CallExpr
              | "(" Expr ")"

ListLiteral ::= "[" [ Expr { "," Expr } ] "]"

MemberExpr  ::= Primary "." IDENT

CallExpr    ::= (IDENT | MemberExpr) "(" ArgList? ")"
ArgList     ::= CallArg { "," CallArg }
CallArg     ::= Expr | IDENT "=" Expr
```

The set of built-in function names is defined by the standard library (e.g. `choose`, `assets.pick`, `now`, `timeSeconds`, `stableHash`). Implementations MUST distinguish user identifiers from built-ins.

### 9.3 Statements and blocks

```ebnf
Block       ::= "{" { Statement } "}"

Statement   ::= AssignmentStmt
              | LetStmt
              | AdvanceDocstepStmt
              | ExprStmt

AssignmentStmt   ::= LValue "=" Expr ";"

LValue          ::= MemberExpr
                  | IDENT

LetStmt         ::= "let" IDENT "=" Expr ";"

AdvanceDocstepStmt ::= "advanceDocstep" "(" ")" ";"

ExprStmt        ::= Expr ";"
```

Assignments to `cell`, `params`, and their fields are performed via member expressions (e.g. `cell.content = ...;`, `params.tempo = params.tempo + 1;`).

## 10. Runtime configuration

```ebnf
RuntimeBlock  ::= "runtime" "{" { RuntimeField } "}"

RuntimeField  ::= EventsApplyField
                | DocstepAdvanceField

EventsApplyField    ::= "eventsApply" "=" EventsApplyPolicy ";"
EventsApplyPolicy   ::= "immediate" | "deferred"

DocstepAdvanceField ::= "docstepAdvance" "=" "[" AdvanceSpecList? "]" ";"
AdvanceSpecList     ::= AdvanceSpec { "," AdvanceSpec }

AdvanceSpec         ::= "timer" "(" NUMBER "s" ")"
                      | "onTransport" "(" STRING ")"
                      | "onRuleRequest" "(" STRING ")"
```

## 11. Materials (legacy)

```ebnf
MaterialsBlock ::= "materials" "{" { MaterialDecl } "}"
MaterialDecl   ::= "material" IDENT "{" { MaterialField } "}"

MaterialField  ::= "tags" "=" "[" IdentList? "]" ";"
                | "label" "=" STRING ";"
                | "description" "=" STRING ";"
                | "color" "=" STRING ";"
                | ScoreBlock | MidiBlock | VideoBlock

ScoreBlock     ::= "score" "{" { ScoreField } "}"
ScoreField     ::= "text" "=" STRING ";"
                | "staff" "=" STRING ";"
                | "clef" "=" STRING ";"

MidiBlock      ::= "midi" "{" { MidiField } "}"
MidiField      ::= "channel" "=" NUMBER ";"
                | "pitch" "=" NUMBER ";"
                | "velocity" "=" NUMBER ";"
                | "durationSeconds" "=" NUMBER ";"

VideoBlock     ::= "video" "{" { VideoField } "}"
VideoField     ::= "clip" "=" STRING ";"
                | "inSeconds" "=" NUMBER ";"
                | "outSeconds" "=" NUMBER ";"
                | "layer" "=" STRING ";"
```

This grammar defines the minimal syntax for Flux v0.2 with v0.1 legacy constructs preserved. Semantics and error handling are described in `spec/semantics.md`.
