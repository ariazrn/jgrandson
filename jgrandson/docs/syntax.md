# JGrandson Language Specification

## Overview

JGrandson is a programming language for building web applications. It compiles to React + TypeScript. A single `.jg` file can contain pages, components, state, logic, and events.

## File Structure

A `.jg` file is composed of top-level declarations:

```
import Navbar from "./components/Navbar"

page Home {
  // page definition
}

component UserCard(user: User) {
  // component definition
}

function add(a: number, b: number): number {
  // function definition
}
```

---

## Pages

A page is a top-level entry point. It becomes a React route/component.

```
page Home {
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

Syntax: `page <Name> { <body> }`

---

## Components

A component is a reusable UI element with typed props.

```
component UserCard(user: User) {
  card {
    text {
      content: user.name
    }
    button {
      text: "View"
    }
  }
}
```

Syntax: `component <Name>(<props>) { <body> }`

Props are typed: `name: Type`, comma-separated.

---

## Elements

Elements represent HTML elements or UI components.

```
button {
  text: "Click me"
}
```

Built-in elements: `div`, `text`, `button`, `input`, `form`, `image`, `link`, `list`, `card`, `header`, `body`

Custom elements refer to components: `UserCard(user)`

### Nesting

```
card {
  header {
    text {
      content: "Profile"
    }
  }
  body {
    text {
      content: "Hello"
    }
  }
}
```

---

## Properties

Properties are key-value pairs inside an element.

```
input {
  type: text
  placeholder: "Search"
  width: 300
  disabled: false
}
```

Property syntax: `<name>: <value>`

- `text: "Click me"` - string value
- `type: text` - identifier value (no quotes for identifiers)
- `width: 300` - number value
- `disabled: false` - boolean value

Properties that don't match known element attributes are converted to React props or styles.

---

## Styles

Styles are defined in a `style` block.

```
button {
  style {
    width: 200
    height: 40
    background: "#000"
    color: "#fff"
    radius: 8
    padding: 10
  }
}
```

Style properties map to CSS properties:
- `radius` → `borderRadius`
- `background` → `backgroundColor`
- `padding` → `padding`
- `width` → `width`
- `height` → `height`
- `color` → `color`

Styles compile to React inline styles: `style={{ width: 200, height: 40 }}`

---

## State

State is declared in a `state` block.

```
state {
  count: number = 0
  name: string = "Aria"
  loggedIn: boolean = false
}
```

Syntax: `<name>: <type> = <value>`

State variables become React `useState` hooks.

---

## Events

Events are handlers attached to elements.

```
button {
  text: "Increment"
  onClick {
    count++
  }
}
```

Event syntax: `<eventName> { <body> }`

The event name (without `on`) becomes the React event handler: `onClick` → `onClick={...}`.

Event parameters:

```
input {
  onInput(value) {
    search = value
  }
}
```

Supported events: `onClick`, `onInput`, `onChange`, `onSubmit`, `onFocus`, `onBlur`

---

## Expressions

Expressions can appear in property values, style values, and event bodies.

### Literals

- Numbers: `42`, `3.14`, `-0.5`
- Strings: `"Hello"`, `"Count: "`
- Booleans: `true`, `false`

### Variables

```
text {
  content: count
}
```

### String Concatenation

```
text {
  content: "Count: " + count
}
```

### Arithmetic

```
text {
  content: price * quantity
}
```

Operators: `+`, `-`, `*`, `/`, `%`, `**` (power)

### Comparison

```
if count > 5 {
  // ...
}
```

Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`

### Logical

```
if loggedIn && admin {
  // ...
}
```

Operators: `&&`, `||`, `!`

### Member Access

```
text {
  content: user.name
}
```

### Function Calls

```
text {
  content: add(10, 20)
}
```

---

## Conditions

```
if loggedIn {
  Dashboard
}
```

With else:

```
if loggedIn {
  Dashboard
} else {
  Login
}
```

With else if:

```
if score >= 90 {
  GradeA
} else if score >= 80 {
  GradeB
} else {
  GradeC
}
```

---

## Loops

```
for user in users {
  UserCard(user)
}
```

Syntax: `for <item> in <collection> { <body> }`

Compiles to `users.map(user => ...)`.

---

## Functions

```
function add(a: number, b: number): number {
  return a + b
}
```

Syntax: `function <name>(<params>): <returnType> { <body> }`

Function calls are expressions:

```
text {
  content: add(10, 20)
}
```

### Local Variables

```
function greet(name: string): string {
  let message = "Hello, " + name
  return message
}
```

### Assignments

```
onClick {
  count++
  total = total + 5
  search = value
}
```

### Increments

```
count++
count--
```

---

## Types

- `string`
- `number`
- `boolean`
- `array<T>` - e.g., `array<string>`
- `object` - untyped object
- `User` - user-defined type (inferred from component props)

---

## Imports

```
import UserCard from "./components/UserCard"
import Navbar, { Link } from "./components/Navbar"
```

---

## Comments

```
// Single line comment

/*
Multi-line comment
*/
```

---

## Keywords

```
page component function return state style text button
input form image link list if else for in let
import true false number string boolean array
onClick onInput onChange onSubmit onFocus onBlur
```

---

## Example: Full Application

```
page Counter {

  state {
    count: number = 0
  }

  style {
    padding: 20
  }

  div {
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
}
```
