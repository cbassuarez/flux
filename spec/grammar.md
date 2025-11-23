# Flux Grammar (v0.1.0)

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
document, meta, state, pageConfig, grid, size, cell, tags, content,
mediaId, payload, dynamic, density, salience, numericFields,
param, int, float, bool, string, enum, rule, when, then, else,
runtime, eventsApply, docstepAdvance, timer, onTransport,
onRuleRequest, true, false, and, or, not, let, advanceDocstep,
mode, event, docstep, timer, topology, page, input, transport, sensor
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
                   | GridBlock | RuleDecl | RuntimeBlock }

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

## 5. Grids and cells

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

## 6. Rules

```ebnf
RuleDecl    ::= "rule" IDENT "(" RuleHeaderArgs? ")" "{" RuleBody "}"

RuleHeaderArgs ::= RuleHeaderArg { "," RuleHeaderArg }
RuleHeaderArg  ::= "mode" "=" RuleMode
                 | "grid" "=" IDENT
                 | "on"   "=" STRING

RuleMode    ::= "docstep" | "event" | "timer"

RuleBody    ::= "when" BoolExpr "then" Block [ "else" Block ]
```

`Block` and expressions/statements are defined in §7.

## 7. Expressions and statements

### 7.1 Literals

```ebnf
Literal     ::= NUMBER | STRING | BOOL
```

### 7.2 Expressions

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
              | IDENT
              | MemberExpr
              | CallExpr
              | "(" Expr ")"

MemberExpr  ::= Primary "." IDENT

CallExpr    ::= IDENT "(" ArgList? ")"
ArgList     ::= Expr { "," Expr }
```

The set of built-in function names is defined by the standard library (e.g. `choice`, `random`, `mean`, `clamp`, `lerp`, `neighbors.withTag`, etc.). Implementations MUST distinguish user identifiers from built-ins.

### 7.3 Statements and blocks

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

## 8. Runtime configuration

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

This grammar defines the minimal syntax for Flux v0.1. Semantics and error handling are described in `spec/semantics.md`.
