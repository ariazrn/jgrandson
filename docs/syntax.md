# JGrandson Syntax Reference (Phase 1–3 draft)

JGrandson source lives in `.jg` files (UTF-8). Two token kinds of input are
significant: **newlines** separate properties and statements (the lexer emits a
`Newline` token and collapses runs of blank lines into one); **comments** and
ordinary whitespace are skipped.

- `//` runs to end of line
- `/* ... */` spans multiple lines (may not nest)

Every token and AST node carries a `loc: { start: Position, end: Position }`.
`Position = { offset, line, column }` with **1-based** line/column numbers.

## Tokens

| Kind        | Example           | Notes                                   |
| ----------- | ----------------- | --------------------------------------- |
| `Ident`     | `page`, `Counter` | names, element tags, property keys      |
| `Keyword`   | `page`, `state`   | reserved words (see list)               |
| `Number`    | `0`, `3.14`       | integer / decimal literals              |
| `String`    | `"hello"`         | double-quoted; `\n \t " \\` escapes      |
| `Bool`      | `true`, `false`   | *not* a keyword, just a literal kind    |
| punctuator  | `{ } ( ) : , . ;` | —                                       |
| operator    | `+ - * / % = …`   | `++ -- == != && || < > <= >=`           |
| `Newline`   |                   | significant line separator               |
| `EOF`       |                   | end of input                            |

Keywords: `page` `component` `function` `state` `style` `let` `if` `else`
`for` `in` `return` `type` `interface` `async` `await` `try` `catch`
`finally` `export`. (Case-sensitive.)

## Top-level

A program is a sequence of imports followed by top-level declarations.

```
import Counter from "./Counter"
import { Card as Panel } from "./Card"

export interface User {
  name: string
  email?: string
}

type MaybeUser = User | null

page Home {
  ...
}

component Card(title: string) {
  ...
}

function add(a: number, b: number): number {
  return a + b
}

async function loadName(fallback: string = "Guest"): string {
  return await fallback
}
```

## Pages, components & functions

```
page Name { body }
component Name(params) { body }      // params: (name: type, ...)
function Name(params): type { body }
async function Name(params): type { body }
```

`body` is an ordered list of block items (see *Blocks* below).

Parameters may be required, optional, or defaulted:

```jg
component Greeting(name?: string = "Guest") {
  text { content: name }
}
```

## Blocks and elements

```
tag { items }        // a div-like element
name { items }       // any non-reserved identifier becomes an element
name(args) { items } // component invocation with argument expressions
```

`items` are a mix of properties, style blocks, event blocks and child items.

### Properties

```
key: value            // string, number, boolean, or any expression
```

### Style

```
style {
  width: 300          // number → px
  color: "#000"       // string → verbatim CSS
  margin: "2rem"      // string value used as-is
}
```

### State

```
state {
  count: number = 0
  name: string = "Aria"
  loggedIn: boolean = false
}
```

### Component children and slots

Components declare insertion points with `slot`. An unnamed slot receives normal
nested children and may contain fallback content:

```jg
component Card(title: string) {
  article {
    text { content: title }
    slot {
      text { content: "No content supplied" }
    }
  }
}

page Home {
  Card("Welcome") {
    text { content: "Custom card content" }
  }
}
```

Named slots use `slot(name)`. The same syntax supplies named content at the
component invocation:

```jg
component Dialog() {
  div {
    slot {}
    slot(actions) {
      text { content: "No actions" }
    }
  }
}

page Home {
  Dialog {
    text { content: "Dialog body" }
    slot(actions) {
      button { text: "Close" }
    }
  }
}
```

Supplying a slot that the component does not declare is a semantic error.

### Text

```
text {
  content: "Count: " + count
}
```

Renders the expression as child text.

### Events

Built-in handlers: `onClick`, `onInput`, `onChange`, `onSubmit`,
`onFocus`, `onBlur`.

```
button {
  text: "Increment"
  onClick {
    count++
  }

  onInput(value) {
    search = value
  }
}
```

An optional `(params)` captures the event payload (a single value for inputs,
the event otherwise).

## Statements (in events, functions, conditions, loops)

```
let x: number = 1
let y = add(2, 3)
x = 5            // assignment
count++          // update (also --)
if cond { … } else { … }
for item in items { … }
try { … } catch (error: any) { … } finally { … }
return expr
expr             // expression statement (e.g. a function call)
```

## Expressions

- Literals: `42`, `3.14`, `"text"`, `true`, `false`, `null`
- Identifiers & calls: `name`, `add(1, 2)`
- Member & index: `user.name`, `list[i]`
- Grouping: `(a + b)`
- Precedence (high → low): unary `! - +`, multiplicative `* / %`,
  additive `+ -`, comparison `< > <= >=`, equality `== != ===`,
  logical `||`, logical `&&`
- Update `++ --` (prefix and postfix), assignment `= += -= *= /=`
- Await: `await load()`
- Collections: `[a, b]`, `{ key: v }`
- Spread: `[...items]`, `{ ...base, name: "Ada" }`

## Types

`string | number | boolean | void | any | object | null | T[] | Name`

Where `T[]` is an array of `T` and `Name` is an opaque reference (a component
or imported type). Unions use `|`, nullable shorthand uses `?`, and object
shapes can be written inline or named with `type` / `interface`.

```jg
type MaybeUser = User | null
type Point = { x: number, y: number }

interface User {
  name: string
  email?: string
}
```

## Accessibility diagnostics

The semantic checker reports basic interface accessibility issues:

- `img` requires `alt`.
- `button` requires `text`, `content`, or `ariaLabel`.

## A complete example

```
page Counter {

  state {
    count: number = 0
  }

  style {
    padding: 20
  }

  text {
    content: "Count: " + count
  }

  button {
    text: "Increment"

    onClick {
      count++
    }
  }
}
```
