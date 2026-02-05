## Gren Language

This project is being authored in the [Gren language](../docs/gren-language.md)

# Chorus Coding Standards

This document defines the coding conventions for the Chorus project. All Gren code should follow these standards.

## Make Invalid States Unrepresentable

Design your types so that invalid combinations of data cannot be constructed. If a state is impossible in reality, it should be impossible in code.

### Bad: Separate fields allow invalid combinations

```gren
-- BAD: Can represent invalid states
type alias Connection =
    { isConnected : Bool
    , messages : Array Message
    }

-- This allows:
-- { isConnected = False, messages = [ msg1, msg2 ] }
-- How can we have messages if we were never connected?
```

### Good: Custom type enforces valid states

```gren
-- GOOD: Invalid states cannot be constructed
type Connection
    = NotConnected
    | Connected { messages : Array Message }
    | Disconnected { messages : Array Message, reason : DisconnectionReason }
```

With this design:
- `NotConnected` cannot have messages (correct - never connected)
- `Connected` always has a messages array (may be empty initially)
- `Disconnected` retains messages from the session and explains why

### More examples

```gren
-- BAD: Loading state with possible data inconsistency
type alias DataState =
    { isLoading : Bool
    , data : Maybe Data
    , error : Maybe Error
    }
-- Allows: { isLoading = True, data = Just x, error = Just e }
-- What does that even mean?

-- GOOD: Each state is distinct and complete
type DataState
    = Loading
    | Loaded { data : Data }
    | Failed { error : Error }
```

```gren
-- BAD: Optional fields that depend on each other
type alias User =
    { name : String
    , isAdmin : Bool
    , adminPermissions : Maybe (Array Permission)
    }
-- Allows: { isAdmin = True, adminPermissions = Nothing }
-- Allows: { isAdmin = False, adminPermissions = Just [...] }

-- GOOD: Permissions are part of the admin variant
type User
    = RegularUser { name : String }
    | AdminUser { name : String, permissions : Array Permission }
```

## Use Newtypes for Structured Data

Avoid using `String` for any data that has structure, validation rules, or semantic meaning. Wrap these in custom types with controlled constructors.

### Why?

- **Type safety**: Cannot accidentally pass a `UserId` where a `SessionId` is expected
- **Validation**: Ensure all instances have passed validation
- **Documentation**: Types communicate intent better than `String`

### Pattern: Opaque type with smart constructor

```gren
module UserId exposing
    ( UserId          -- Type exposed
    -- Note: Constructor NOT exposed
    , fromString      -- Smart constructor
    , toString        -- Accessor
    )

type UserId
    = UserId String

fromString : String -> Maybe UserId
fromString raw =
    let
        trimmed = String.trim raw
    in
    if String.length trimmed > 0 && String.length trimmed <= 64 then
        Just (UserId trimmed)
    else
        Nothing

toString : UserId -> String
toString (UserId id) =
    id
```

Because the constructor `UserId` is not exported, external code must use `fromString`, which validates the input. Any function receiving a `UserId` can trust it is valid.

### Common cases for newtypes

| Data         | Why not String?                               |
| ------------ | --------------------------------------------- |
| `UserId`     | Has format rules, different from other IDs    |
| `Email`      | Must contain @, has local and domain parts    |
| `Url`        | Has scheme, host, path structure              |
| `FilePath`   | Must be validated for path traversal          |
| `Port`       | Must be 1-65535, should probably be Int-based |
| `JsonString` | Must be valid JSON                            |
| `Regex`      | Must be a valid regex pattern                 |

### Example: FilePath with validation

```gren
module FilePath exposing
    ( FilePath
    , fromString
    , toString
    , join
    )

type FilePath
    = FilePath String

fromString : String -> Result PathError FilePath
fromString raw =
    if String.contains ".." raw then
        Err PathTraversalAttempt
    else if String.startsWith "/" raw then
        Err AbsolutePathNotAllowed
    else
        Ok (FilePath (normalizePath raw))

toString : FilePath -> String
toString (FilePath p) =
    p

join : FilePath -> FilePath -> FilePath
join (FilePath base) (FilePath child) =
    FilePath (base ++ "/" ++ child)
```

## Use the Pipe Operator for Data Flow

Write data transformations as pipelines using `|>`. Start with the data being operated on, then flow it through operations.

### Bad: Nested function calls

```gren
-- BAD: Read inside-out, hard to follow
result =
    String.toUpper (String.trim (String.append prefix input))

-- BAD: Temporary variables for readability
result =
    let
        step1 = String.append prefix input
        step2 = String.trim step1
        step3 = String.toUpper step2
    in
    step3
```

### Good: Pipeline with |>

```gren
-- GOOD: Reads top-to-bottom, data flows through operations
result =
    input
        |> String.append prefix
        |> String.trim
        |> String.toUpper
```

### Apply to all transformations

```gren
-- Processing arrays
validEmails =
    rawInputs
        |> Array.map String.trim
        |> Array.keepIf (not << String.isEmpty)
        |> Array.mapAndKeepJust Email.fromString

-- Working with Maybe
userName =
    maybeUser
        |> Maybe.map .name
        |> Maybe.withDefault "Anonymous"

-- Chaining Results
parseConfig rawJson =
    rawJson
        |> Json.Decode.decodeString configDecoder
        |> Result.mapError JsonError
        |> Result.andThen validateConfig
```

### When building records, keep it simple

Pipes are for transformations. For record construction, direct syntax is cleaner:

```gren
-- Direct construction is fine for records
newUser =
    { id = id
    , name = name
    , email = email
    }

-- Use pipes when transforming existing records
updatedUser =
    user
        |> setName newName
        |> incrementLoginCount
        |> updateLastSeen now
```
