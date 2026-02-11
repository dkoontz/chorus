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

## Fail on Malformed or Missing Data

Never silently substitute a default value or partially interpret data when the expected value is missing or malformed. Missing or invalid data must produce an explicit error so that the caller can detect and handle the problem. Hard-coded fallbacks hide bugs and make failures difficult to trace.

### Why?

- **Visibility**: Silent defaults mask upstream problems. A bug that produces empty strings or missing fields should be caught immediately, not papered over with `"unknown"` or `0`.
- **Correctness**: A fallback value may look plausible enough to pass through the rest of the system and corrupt downstream state before anyone notices.
- **Debuggability**: When something eventually goes wrong, the root cause is far from the symptom. Failing early at the point of the bad data makes diagnosis straightforward.

### Rules

1. **Do not invent fallback values** for missing or invalid data unless the caller has explicitly requested a default.
2. **Use `Result` with specific error types** to report why data is invalid, so the receiver can take appropriate action.
3. **Treat `Nothing` / `Err` as a signal**, not an inconvenience. Propagate it or handle it — do not replace it with a made-up value.
4. **Log or surface the error clearly** so that a user or operator can take corrective action.

### Bad: Silent defaults hide failures

```gren
-- BAD: Missing name becomes "unknown" — no one finds out
parseUser : Json.Value -> User
parseUser json =
    { name =
        json
            |> Json.Decode.decodeValue (Json.Decode.field "name" Json.Decode.string)
            |> Result.withDefault "unknown"
    , age =
        json
            |> Json.Decode.decodeValue (Json.Decode.field "age" Json.Decode.int)
            |> Result.withDefault 0
    }
```

This silently produces `{ name = "unknown", age = 0 }` when the input is garbage. Nothing in the system will flag the problem.

### Good: Explicit errors with specific types

```gren
type UserParseError
    = MissingField String
    | InvalidFieldType { field : String, expected : String }

parseUser : Json.Value -> Result UserParseError User
parseUser json =
    let
        nameResult =
            json
                |> Json.Decode.decodeValue (Json.Decode.field "name" Json.Decode.string)
                |> Result.mapError (\_ -> MissingField "name")

        ageResult =
            json
                |> Json.Decode.decodeValue (Json.Decode.field "age" Json.Decode.int)
                |> Result.mapError (\_ -> MissingField "age")
    in
    Result.map2 (\name age -> { name = name, age = age }) nameResult ageResult
```

The caller sees exactly what went wrong and can decide how to respond — retry, ask the user for input, or report the error upstream.

### Bad: Partial interpretation of structured data

```gren
-- BAD: Extracts what it can, ignores the rest
parseConfig : String -> Config
parseConfig raw =
    { host =
        raw
            |> extractField "host"
            |> Maybe.withDefault "localhost"
    , port_ =
        raw
            |> extractField "port"
            |> Maybe.andThen String.toInt
            |> Maybe.withDefault 8080
    }
```

If the config file is empty or corrupt, the system silently runs with `localhost:8080` and the operator has no idea the config was never applied.

### Good: Fail and report what is missing

```gren
type ConfigError
    = FieldNotFound String
    | FieldNotValid { field : String, value : String, reason : String }

parseConfig : String -> Result ConfigError Config
parseConfig raw =
    let
        hostResult =
            raw
                |> extractField "host"
                |> Result.fromMaybe (FieldNotFound "host")

        portResult =
            raw
                |> extractField "port"
                |> Result.fromMaybe (FieldNotFound "port")
                |> Result.andThen
                    (\portStr ->
                        portStr
                            |> String.toInt
                            |> Result.fromMaybe
                                (FieldNotValid
                                    { field = "port"
                                    , value = portStr
                                    , reason = "not a valid integer"
                                    }
                                )
                    )
    in
    Result.map2 (\host port_ -> { host = host, port_ = port_ }) hostResult portResult
```

### When defaults are acceptable

Defaults are fine when they are part of the documented, intentional design — not a workaround for missing data:

```gren
-- OK: Explicit optional field with a documented default
type alias PaginationRequest =
    { page : Int
    , pageSize : Int
    }

defaultPagination : PaginationRequest
defaultPagination =
    { page = 1
    , pageSize = 25
    }

-- The caller explicitly chooses to use the default:
-- parsePagination input |> Result.withDefault defaultPagination
```

The key difference: the caller makes the decision to apply a default, and it is visible at the call site. The parser itself does not hide the absence of data.

## Do Not Silently Swallow Errors in Tasks

Never discard an error from a `Task` by replacing it with a success value. If an operation can fail, propagate the error so the caller can detect it and decide how to respond — log it, retry, show a message to the user, or abort. Silently replacing a failure with `Task.succeed {}` hides the problem and leaves the user with no explanation for why an expected outcome did not occur.

### Why?

- **User confusion**: The operation appears to succeed, but its side effects (saved data, recorded events, written files) are missing. The user has no way to understand what went wrong.
- **Silent data loss**: Errors during persistence (writing to disk, recording events) mean data is permanently lost with no trace.
- **Difficult debugging**: Without an error signal, there is nothing to investigate. The failure is invisible in logs, in the UI, and in the data.

### Bad: Swallowing the error

```gren
-- BAD: If recording fails, no one finds out
Registry.recordEvent registry taskId event
    |> Task.onError (\_ -> Task.succeed {})
```

If `recordEvent` fails (disk full, permission error, corrupt state), the error is silently discarded. The caller continues as if the event was recorded. The user sees a successful operation but the event is missing from the history.

### Bad: Swallowing inside a branch

```gren
-- BAD: Failure in one branch is hidden
when maybeExtraEvent is
    Just extraEvent ->
        Registry.recordEvent registry taskId extraEvent
            |> Task.onError (\_ -> Task.succeed {})

    Nothing ->
        Task.succeed {}
```

Same problem. The `Nothing` branch legitimately has nothing to do, but the `Just` branch silently eats errors. If the event fails to record, the user performed an action that appeared to succeed but left no trace.

### Good: Propagate the error to the caller

```gren
-- GOOD: Caller sees the failure and can decide what to do
when maybeExtraEvent is
    Just extraEvent ->
        Registry.recordEvent registry taskId extraEvent

    Nothing ->
        Task.succeed {}
```

The caller receives the error and can handle it — log a warning, return an error response, or retry.

### Good: Map the error into the caller's error type

```gren
-- GOOD: Wrap the error with context for the caller
type ExecutionError
    = ProviderFailed String
    | EventRecordingFailed String

recordIfPresent : Registry -> TaskId -> Maybe Event -> Task ExecutionError {}
recordIfPresent registry taskId maybeEvent =
    when maybeEvent is
        Just event ->
            Registry.recordEvent registry taskId event
                |> Task.mapError (\err -> EventRecordingFailed (errorToString err))

        Nothing ->
            Task.succeed {}
```

The caller gets a typed error explaining what failed and why, and can take appropriate action.

### The rule

If a `Task` can fail, its error must be propagated — either directly or mapped into the caller's error type. The only code that should decide to drop an error is the top-level handler that has full context about what the user should see.

## Never Run Concurrent Tasks That Write to the Same File

When multiple `Task` values perform read-modify-write on the same file, they must be chained sequentially with `Task.andThen`. Running them concurrently — via `Cmd.batch` or separate commands in the same update — creates a race condition where one write silently overwrites the other, losing data.

### Why?

Read-modify-write is not atomic. Each `Task` reads the current file contents, modifies them in memory, and writes the result back. When two tasks do this concurrently:

1. Task A reads the file (sees state S₀)
2. Task B reads the file (sees the same state S₀)
3. Task A writes its update (file now contains S₁)
4. Task B writes its update (file now contains S₂, based on S₀ — Task A's write is lost)

The result is silent data loss. No error is raised, no log is written, and the lost data is unrecoverable.

### Bad: Concurrent writes in Cmd.batch

```gren
-- BAD: Both tasks read/write the same file concurrently
{ model = model
, command =
    Cmd.batch
        [ writeRecordToFile registry taskId recordA
        , writeRecordToFile registry taskId recordB
        ]
}
```

One of these writes will be lost. Which one depends on timing, making the bug non-deterministic and difficult to reproduce.

### Bad: Mixing an API call that writes with a direct write

```gren
-- BAD: apiCallThatWritesFile internally writes to the same file
-- that writeRecordToFile also targets
{ model = model
, command =
    Cmd.batch
        [ apiCallThatWritesFile ctx taskId params toMsg
        , writeRecordToFile registry taskId record
            |> Task.perform (\_ -> NoOp)
        ]
}
```

The race condition is hidden because the concurrent write is inside `apiCallThatWritesFile`. Any function that chains a write to the same file must not run concurrently with another write to that file.

### Good: Chain writes sequentially with andThen

```gren
-- GOOD: Second write sees the result of the first
writeRecordToFile registry taskId recordA
    |> Task.andThen (\_ -> writeRecordToFile registry taskId recordB)
```

The second `Task` reads the file after the first has finished writing, so both records are preserved.

### Good: Move both writes into the same Task chain

```gren
-- GOOD: All writes to the file happen in a single sequential chain
apiCallThatWritesFile ctx taskId params extraRecord toMsg =
    updateData ctx.registry taskId params
        |> Task.andThen (\result ->
            writeRecordToFile ctx.registry taskId extraRecord
                |> Task.andThen (\_ ->
                    writeRecordToFile ctx.registry taskId (deriveSecondRecord result)
                        |> Task.andThen (\_ -> buildResponse result)
                )
        )
        |> Task.perform toMsg
```

By keeping all writes in a single `Task` chain, each write completes before the next one starts.

### The rule

If two or more `Task` values write to the same file, they must be sequenced with `Task.andThen` — never placed in `Cmd.batch` or separate commands. This applies regardless of whether the writes are direct or buried inside helper functions. When adding a write to a file, check whether any other `Task` in the same `Cmd.batch` also writes to that file, including indirectly through API functions.
