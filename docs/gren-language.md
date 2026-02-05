# Gren Language Overview

Gren is a pure functional programming language that compiles to JavaScript. It originated as a fork of Elm but has diverged significantly with its own syntax and design decisions. Gren emphasizes correctness, helpful error messages, and maintainable code.

> **Note:** Gren and Elm are independent languages. While they share underlying philosophy, Gren has made breaking changes that make Elm code incompatible. Do not copy Elm code expecting it to work in Gren.

## Key Characteristics

- **Pure functional** - No side effects in functions, all state changes are explicit
- **Strongly typed** - Static type system catches errors at compile time
- **No runtime exceptions** - The type system prevents null/undefined errors
- **Compiles to JavaScript** - Runs on Node.js or in browsers
- **Helpful error messages** - Compiler errors explain what went wrong and suggest fixes

## Basic Syntax

### Values and Functions

```gren
-- Constants
name = "Chorus"
count = 42
enabled = True

-- Functions (no parentheses for arguments)
add x y = x + y

-- Calling functions
result = add 1 2  -- Returns 3

-- Anonymous functions
increment = \x -> x + 1

-- Multi-line functions use indentation
processData data =
    let
        cleaned = String.trim data
        parsed = parseInput cleaned
    in
    validate parsed
```

### Type Annotations

Type annotations are optional but recommended:

```gren
name : String
name = "Chorus"

add : Int -> Int -> Int
add x y = x + y

-- Functions that take functions as arguments
map : (a -> b) -> Array a -> Array b
```

### Records

Records are typed collections of named fields:

```gren
type alias User =
    { id : UserId
    , name : String
    , email : Email
    }

-- Creating a record
user =
    { id = UserId.fromInt 1
    , name = "Alice"
    , email = Email.fromString "alice@example.com"
    }

-- Accessing fields
userName = user.name

-- Updating fields (creates a new record)
updatedUser = { user | name = "Alicia" }
```

### Custom Types (Sum Types)

Custom types define a set of possible variants:

```gren
type ConnectionState
    = Disconnected
    | Connecting
    | Connected { sessionId : SessionId }
    | Failed { error : ConnectionError }

-- Using custom types with pattern matching
describeState : ConnectionState -> String
describeState state =
    when state is
        Disconnected ->
            "Not connected"

        Connecting ->
            "Attempting to connect..."

        Connected { sessionId } ->
            "Connected with session " ++ SessionId.toString sessionId

        Failed { error } ->
            "Connection failed: " ++ ConnectionError.toString error
```

### The Maybe Type

Gren has no null. Optional values use `Maybe`:

```gren
type Maybe a
    = Nothing
    | Just a

-- Example
findUser : UserId -> Maybe User
findUser id =
    when Dict.get id users is
        Just user ->
            Just user

        Nothing ->
            Nothing

-- Working with Maybe
userName : Maybe User -> String
userName maybeUser =
    when maybeUser is
        Just user ->
            user.name

        Nothing ->
            "Unknown"

-- Or use Maybe.map, Maybe.withDefault
userName2 : Maybe User -> String
userName2 maybeUser =
    maybeUser
        |> Maybe.map .name
        |> Maybe.withDefault "Unknown"
```

### The Result Type

Operations that can fail return `Result`:

```gren
type Result error value
    = Err error
    | Ok value

-- Example
parsePort : String -> Result String Int
parsePort input =
    when String.toInt input is
        Just port ->
            if port > 0 && port < 65536 then
                Ok port
            else
                Err "Port must be between 1 and 65535"

        Nothing ->
            Err "Invalid number"
```

### The Pipe Operator

The `|>` operator passes a value as the last argument to a function:

```gren
-- Without pipes
result = String.toUpper (String.trim (String.append "hello" " world"))

-- With pipes (more readable)
result =
    "hello"
        |> String.append " world"
        |> String.trim
        |> String.toUpper
```

### Arrays and Array Operations

Gren uses `Array` as the default sequential data structure (not linked lists like Elm).

```gren
numbers : Array Int
numbers = [ 1, 2, 3, 4, 5 ]

-- Common operations
doubled =
    numbers
        |> Array.map (\n -> n * 2)

evens =
    numbers
        |> Array.keepIf (\n -> modBy 2 n == 0)

sum =
    numbers
        |> Array.foldl (+) 0
```

## Module System

### Defining a Module

```gren
module Tools.File exposing
    ( ReadResult
    , read
    , write
    )

-- Public types and functions listed in `exposing`
-- Everything else is private to the module
```

### Opaque Types

Hide constructors to enforce validation:

```gren
module UserId exposing
    ( UserId  -- Type is exposed, but not its constructor
    , fromInt
    , toString
    )

type UserId
    = UserId Int

fromInt : Int -> Maybe UserId
fromInt n =
    if n > 0 then
        Just (UserId n)
    else
        Nothing

toString : UserId -> String
toString (UserId n) =
    String.fromInt n
```

### Importing Modules

```gren
-- Import everything from a module
import Array

-- Import specific items
import Dict exposing (Dict)

-- Import with alias
import VeryLongModuleName as Short
```

## Commands and Subscriptions

Gren uses a managed effects system. Side effects are described as data:

```gren
-- Commands describe side effects to perform
type Cmd msg

-- Subscriptions describe external events to listen for
type Sub msg

-- The runtime executes these and sends messages back to your update function
```

### Example: HTTP Request

```gren
import Http

type Msg
    = GotResponse (Result Http.Error String)

fetchData : Cmd Msg
fetchData =
    Http.get
        { url = "https://api.example.com/data"
        , expect = Http.expectString GotResponse
        }

update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    when msg is
        GotResponse result ->
            when result is
                Ok data ->
                    ( { model | data = data }, Cmd.none )

                Err error ->
                    ( { model | error = Just error }, Cmd.none )
```

## The Gren Architecture

Gren applications follow a standard pattern:

```gren
-- Model: Application state
type alias Model =
    { count : Int
    }

-- Msg: All possible events
type Msg
    = Increment
    | Decrement

-- init: Initial state
init : Model
init =
    { count = 0
    }

-- update: How state changes in response to messages
update : Msg -> Model -> Model
update msg model =
    when msg is
        Increment ->
            { model | count = model.count + 1 }

        Decrement ->
            { model | count = model.count - 1 }

-- view: How to display state (for browser apps)
-- For CLI tools, this might be output formatting instead
```

## Differences from Other Languages

| Concept        | JavaScript                  | Gren                                   |
| -------------- | --------------------------- | -------------------------------------- |
| Null/undefined | Common source of errors     | Does not exist, use `Maybe`            |
| Exceptions     | Can be thrown anywhere      | Not possible, use `Result`             |
| Mutation       | Default behavior            | Not possible, create new values        |
| Side effects   | Can happen anywhere         | Only through `Cmd`, managed by runtime |
| Types          | Dynamic, checked at runtime | Static, checked at compile time        |

## Key Differences from Elm

Gren originated as an Elm fork but has diverged significantly. Code from Elm tutorials or packages will not work without modification.

### Pattern Matching: `when is` not `case of`

Gren renamed the pattern matching syntax for readability:

```gren
-- Elm (does NOT work in Gren)
case maybeValue of
    Just x -> x
    Nothing -> default

-- Gren
when maybeValue is
    Just x -> x
    Nothing -> default
```

### Custom Type Constructors: Maximum 1 Parameter

Gren limits custom type constructors to 0 or 1 parameters. Multi-parameter constructors must use records:

```gren
-- Elm (does NOT work in Gren)
type Person = Person String Int

-- Gren: use a record for multiple values
type Person = Person { name : String, age : Int }
```

This mirrors the rationale for removing tuples: named fields are clearer than positional arguments.

### Arrays Instead of Lists

Gren uses immutable arrays as the default sequential data structure, not linked lists:

```gren
-- This is an Array, not a List
items : Array String
items = [ "one", "two", "three" ]
```

### Renamed Functions

Several common functions have been renamed for clarity:

| Elm                          | Gren             | Rationale                    |
| ---------------------------- | ---------------- | ---------------------------- |
| `filter`                     | `keepIf`         | Describes what it does       |
| `filterMap`                  | `mapAndKeepJust` | Describes the two operations |
| `flatMap`                    | `mapAndFlatten`  | Describes the two operations |
| `length` (non-constant time) | `count`          | `length` implies O(1)        |

### Record Updates with Any Expression

In Elm, record update syntax only works with variables. Gren allows any expression:

```gren
-- Elm (limited to variables)
updatedRecord = { myRecord | value = "new" }

-- Gren: any expression that returns a record works
updatedRecord = { SomeModule.getRecord | value = "new" }
updatedRecord = { getConfig env | timeout = 30 }
```

### Extended Record Pattern Matching

Gren has extended support for pattern matching on records compared to Elm. This includes matching on record fields directly in `when` expressions:

```gren
-- Pattern match on record fields
describeMixture : { leftQty : Int, rightQty : Int } -> String
describeMixture mixture =
    when mixture is
        { leftQty = 0 } ->
            "No left ingredient"

        { rightQty = 0 } ->
            "No right ingredient"

        _ ->
            "Has both ingredients"
```

### No Tuples

Gren removed tuples entirely. Use records instead:

```gren
-- Elm (does NOT work in Gren)
position : ( Int, Int )
position = ( 10, 20 )

-- Gren: use a record
position : { x : Int, y : Int }
position = { x = 10, y = 20 }
```

### No Automatic Record Constructors

In Elm, type aliases for records automatically create a constructor function. Gren does not do this:

```gren
type alias Person =
    { name : String
    , age : Int
    }

-- Elm: Person "Alice" 30 works as a constructor
-- Gren: Must use record literal syntax
person = { name = "Alice", age = 30 }
```

### Unit Type

The unit type in Gren is `{}` (empty record), not `()`:

```gren
-- Gren unit type
doNothing : {} -> {}
doNothing _ = {}
```

### No Comparable/Appendable Type Classes

Gren is removing the magic type classes (`comparable`, `appendable`, `number`). Future versions will use parametric modules instead, allowing you to generate specialized modules at compile time.

### No map4, map5, etc.

Gren removed `map4`, `map5`, and higher-arity map functions from most modules. Use `andMap` instead:

```gren
-- Elm (does NOT work in Gren)
Maybe.map4 buildRecord maybeA maybeB maybeC maybeD

-- Gren: use andMap
Maybe.map buildRecord
    |> Maybe.andMap maybeA
    |> Maybe.andMap maybeB
    |> Maybe.andMap maybeC
    |> Maybe.andMap maybeD
```

### Concurrent Task Execution

Tasks combined with `Task.map2`, `Task.map3`, or `Task.andMap` run concurrently by default. Use `Task.sequence` for sequential execution when order matters:

```gren
-- These two HTTP requests run concurrently
Task.map2 combinedResult
    (Http.get urlA)
    (Http.get urlB)

-- For sequential execution, use Task.sequence
Task.sequence [ taskA, taskB, taskC ]

-- Or Task.concurrent for an array of tasks to run in parallel
Task.concurrent [ taskA, taskB, taskC ]
```

### Task Ports for JavaScript Interop

Gren 25S introduced task ports for simpler JavaScript interop. Instead of separate Cmd/Sub port pairs:

```gren
-- Define a task port
port saveToDB : String -> Task Json.Decode.Value Int
```

```javascript
// JavaScript side uses async functions
Gren.Main.init({
  taskPorts: {
    saveToDB: async function(str) {
      const result = await database.save(str);
      return result.id;
    }
  }
})
```

## Installing Packages

Always use the `gren package install` CLI command to install packages, do not edit the gren.json file directly.

## Resources

- [Gren Official Site](https://gren-lang.org/)
- [Gren Guide](https://gren-lang.org/book/)
- [Gren Packages](https://packages.gren-lang.org/)
- [Gren 25S Release Notes](https://gren-lang.org/news/250721_gren_25s/) - Task ports, concurrent tasks
- [Gren 24W Release Notes](https://gren-lang.org/news/161224_gren_24w/) - Major syntax changes
- [Upcoming Language Changes](https://gren-lang.org/news/240819_upcoming_language_changes/) - Future direction
