# Improve Server Error Messages

## Summary

Replace the generic "Failed to create HTTP server" error message with human-readable messages that describe what went wrong, including the address, port, and OS error code. For example: `Server error: Address 0.0.0.0:8080 is already in use (EADDRINUSE)`.

## Requirements

- The `errorToString` function in `Web/Server.gren` must produce human-readable error messages that include the host, port, and OS error code
- Known OS error codes (`EADDRINUSE`, `EACCES`, `EADDRNOTAVAIL`) must be translated into descriptive messages
- Unknown error codes must fall back to including the raw code and message from the OS
- The double "Server error: Server error:" prefix in `Main.gren` must be eliminated so the log reads `Server error: Address 0.0.0.0:8080 is already in use (EADDRINUSE)` rather than `Server error: Server error: ...`

## Acceptance Criteria

- [ ] When the server fails to start because the port is already in use, the logged message is: `Server error: Address {host}:{port} is already in use (EADDRINUSE)`
- [ ] When the server fails to start because of a permission error, the logged message is: `Server error: Permission denied for {host}:{port} (EACCES)`
- [ ] When the server fails to start because the address is not available, the logged message is: `Server error: Address {host}:{port} is not available (EADDRNOTAVAIL)`
- [ ] When the server fails with an unknown OS error code, the logged message includes both the raw code and message, e.g.: `Server error: {message} ({code})`
- [ ] The `model.status` is set to the same human-readable string (without the "Server error: " prefix that the log line adds)
- [ ] There is no double "Server error: Server error:" prefix in the log output
- [ ] The app builds successfully with `npm run build:all`
- [ ] Existing tests pass with `npm run test`

## Out of Scope

- Changing the `HttpServer.ServerError` type in the gren-lang/node package
- Adding retry logic or automatic port selection on failure
- Displaying server errors in the web UI (the server never starts, so the UI is not reachable)
- Handling errors other than server creation errors

## Technical Context

### How the Error Type Works

`HttpServer.ServerError` is defined in `gren-lang/node 6.1.0` as:

```
type ServerError =
    ServerError { code : String, message : String }
```

The `code` field contains Node.js system error codes (e.g., `EADDRINUSE`, `EACCES`). The `message` field contains Node's human-readable error description. These come directly from the Node.js `server.on("error", ...)` callback in the kernel JS.

The `Web.Server` module wraps this as:

```
type Error
    = ServerError HttpServer.ServerError
```

### The Problem

Currently `errorToString` discards the OS error info entirely:

```gren
errorToString error =
    when error is
        ServerError _ ->
            "Server error: Failed to create HTTP server"
```

And in `Main.gren`, the `GotServer` error handler adds another "Server error:" prefix:

```gren
Err err ->
    { model = { model | status = Error (Server.errorToString err) }
    , command = Logging.logError model.logger ("Server error: " ++ Server.errorToString err) NoOp
    }
```

### The Fix

1. Change `errorToString` to accept a `Config` parameter so it has access to the host and port. The signature becomes:

```gren
errorToString : Config -> Error -> String
```

2. Pattern match on the OS error code to produce human-readable messages:

```gren
errorToString config error =
    when error is
        ServerError (HttpServer.ServerError { code, message }) ->
            let
                addr =
                    config.host ++ ":" ++ String.fromInt config.port_
            in
            when code is
                "EADDRINUSE" ->
                    "Address " ++ addr ++ " is already in use (EADDRINUSE)"

                "EACCES" ->
                    "Permission denied for " ++ addr ++ " (EACCES)"

                "EADDRNOTAVAIL" ->
                    "Address " ++ addr ++ " is not available (EADDRNOTAVAIL)"

                _ ->
                    message ++ " (" ++ code ++ ")"
```

3. In `Main.gren`, update the `GotServer` error handler to pass the server config and fix the double prefix. The `errorToString` result should be used directly for `model.status`, and the log message should prepend "Server error: " only once:

```gren
Err err ->
    let
        serverConfig =
            { host = model.config.host
            , port_ = model.config.port_
            }

        errMsg =
            Server.errorToString serverConfig err
    in
    { model = { model | status = Error errMsg }
    , command = Logging.logError model.logger ("Server error: " ++ errMsg) NoOp
    }
```

### Files to Modify

- `packages/chorus/src/Web/Server.gren` - Change `errorToString` to accept `Config`, pattern match on OS error codes to produce human-readable messages
- `packages/chorus/src/Main.gren` - Pass server config to `errorToString`, fix double "Server error:" prefix in the `GotServer` error handler

### Related Files (reference only)

- `/Users/david/Library/Caches/gren/0.6.3/packages/gren-lang_node__6_1_0/src/HttpServer.gren` - Defines `ServerError` type with `{ code : String, message : String }`
- `/Users/david/Library/Caches/gren/0.6.3/packages/gren-lang_node__6_1_0/src/Gren/Kernel/HttpServer.js` - Kernel JS that creates the ServerError from Node.js error events (`e.code`, `e.message`)

### Patterns to Follow

- The `HttpServer.ServerError` constructor must be destructured in the pattern match: `ServerError (HttpServer.ServerError { code, message })` -- note the nested constructor
- Gren uses `when...is` for pattern matching (not `case...of`)
- String concatenation uses `++`
- `String.fromInt` converts integers to strings

## Testing Requirements

- Run `npm run build:all` to verify the app compiles
- Run `npm run test` to verify existing tests still pass
- Manual test: start the app, then try starting it again (second instance). The second instance should log: `Server error: Address 0.0.0.0:8080 is already in use (EADDRINUSE)`
- Manual test: try starting the app on a privileged port (e.g., port 80 without root) to verify the EACCES message

## Notes

- The `Config` type is already defined and exported from `Web/Server.gren` as `{ host : String, port_ : Int }`, so no new types are needed
- The `errorToString` function is only called in one place (`Main.gren` line 359), so changing its signature has minimal impact
- Node.js error codes are standardized: https://nodejs.org/api/errors.html#common-system-errors. The three handled codes (EADDRINUSE, EACCES, EADDRNOTAVAIL) cover the most common server startup failures. The fallback handles everything else.
