# Fix Underscore-Suffixed Field Names

## Summary

Add a naming standard to CODING_STANDARDS.md that prohibits underscore-suffixed field names except at the library boundary, and rename `port_` to `serverPort` in `Main.Config` so internal code uses a descriptive name instead of a keyword-avoidance suffix.

## Requirements

- Add a "Field Naming" section to `agents/CODING_STANDARDS.md` that establishes the rule: do not use underscore-suffixed field names unless the record is directly consumed by an external library that requires that name
- Rename the `port_` field in `Main.Config` to `serverPort` (this is our internal configuration record and is not constrained by any library API)
- Keep `port_` in `Web.Server.Config` unchanged because `HttpServer.createServer` from `gren-lang/node` requires a record with a `port_` field
- Update all references to `model.config.port_` and `config.port_` in `Main.gren` to use the new `serverPort` name
- Map `serverPort` to `port_` at the two call sites where `Web.Server.Config` records are constructed in `Main.gren`
- Rename the local binding `port_` in `configFromEnv` to `serverPort` (no longer needs underscore since it is a let-binding, not a keyword usage)
- Update the `port_` examples in the existing "Fail on Malformed or Missing Data" section of CODING_STANDARDS.md to use `serverPort` for the application config field, keeping `port_` only where it represents the library boundary record

## Acceptance Criteria

- [ ] `agents/CODING_STANDARDS.md` contains a "Field Naming" section with a rule against underscore-suffixed names except at library boundaries
- [ ] The new section includes a "Bad" example showing `port_` in an internal record and a "Good" example showing a descriptive name mapped to `port_` only at the boundary
- [ ] `Main.Config` type alias uses `serverPort` instead of `port_`
- [ ] `Main.defaultConfig` uses `serverPort` instead of `port_`
- [ ] `Main.configFromEnv` uses `serverPort` for both the let-binding and the record field
- [ ] The two `Web.Server.Config` construction sites in `Main.gren` map `serverPort` to `port_` (e.g., `{ host = config.host, port_ = config.serverPort }`)
- [ ] `Web.Server.Config` still uses `port_` (unchanged, required by `HttpServer.createServer`)
- [ ] All `String.fromInt config.port_` and `String.fromInt model.config.port_` references in `Main.gren` are updated to use `serverPort`
- [ ] The "Fail on Malformed or Missing Data" examples in CODING_STANDARDS.md are updated so the application-level config uses `serverPort` while the library boundary record uses `port_`
- [ ] The app builds successfully with `npm run build:all`
- [ ] Existing tests pass with `npm run test`

## Out of Scope

- Renaming `port_` in `Web.Server.Config` (it must match the `gren-lang/node` HttpServer API)
- Renaming standard library functions like `type_` or `main_` from `Html`/`Html.Attributes`
- Renaming string literal prefixes like `"requirement_"` or `"question_"` (these are dictionary key prefixes, not field names)
- Changing any `gren-lang/node` or `gren-lang/url` library code

## Technical Context

### Files to Modify

- `agents/CODING_STANDARDS.md` - Add "Field Naming" section with the naming rule, examples, and rationale. Update existing `port_` usage in the "Fail on Malformed or Missing Data" examples.
- `packages/chorus/src/Main.gren` - Rename `port_` to `serverPort` in `Config` type alias (line 108), `defaultConfig` (line 131), `configFromEnv` let-binding (line 165) and record construction (line 188), and all `config.port_`/`model.config.port_` references. Map to `port_` at `Web.Server.Config` construction (lines 275 and 362).

### Related Files (reference only)

- `packages/chorus/src/Web/Server.gren` - Defines `Web.Server.Config` with `port_` field. NOT modified because `HttpServer.createServer` requires this field name. Confirms the library boundary constraint.
- `docs/gren-language.md` - Gren language reference. `port` is a reserved keyword in Gren (used for port module declarations).

### Gren Keywords Relevant to This Task

`port` is a reserved keyword in Gren (confirmed in the compiler source at `Parse/Keyword.hs`). The `gren-lang/node` HttpServer module and `gren-lang/url` Url module both use `port_` as a field name as the ecosystem convention for this keyword conflict. Other keywords with underscore-suffixed standard library counterparts include `type` (`type_` in Html.Attributes) and `main` (`main_` in Html).

### Patterns to Follow

- The existing CODING_STANDARDS.md sections use a consistent format: rationale ("Why?"), "Bad" example with explanation, "Good" example with explanation, and a summary rule
- Field renaming in `Main.gren` is straightforward: update the type alias, default value, `configFromEnv`, and all usage sites
- The mapping from internal name to library name happens at the `Web.Server.Config` record construction sites

### Specific Lines in Main.gren to Update

| Line | Current | New |
|------|---------|-----|
| 108 | `, port_ : Int` | `, serverPort : Int` |
| 131 | `, port_ = 8080` | `, serverPort = 8080` |
| 165 | `port_ =` | `serverPort =` |
| 168 | `Maybe.withDefault config.port_` | `Maybe.withDefault config.serverPort` |
| 188 | `, port_ = port_` | `, serverPort = serverPort` |
| 248 | `String.fromInt config.port_` | `String.fromInt config.serverPort` |
| 275 | `, port_ = config.port_` | `, port_ = config.serverPort` |
| 293 | `String.fromInt config.port_` | `String.fromInt config.serverPort` |
| 323 | `String.fromInt model.config.port_` | `String.fromInt model.config.serverPort` |
| 362 | `, port_ = model.config.port_` | `, port_ = model.config.serverPort` |

## Testing Requirements

- Run `npm run build:all` to verify the app compiles with the renamed field
- Run `npm run test` to verify existing tests pass
- Optionally run `npm run start` and verify the server starts on the configured port

## Notes

- `port` is a reserved keyword in Gren used for port module declarations (JavaScript interop). This is why the standard library uses `port_` as a field name.
- The `gren-lang/node` HttpServer.createServer function takes a record with `{ host : String, port_ : Int }`. This is the library API and cannot be changed.
- The `gren-lang/url` Url type also uses `port_` as a field name. This is a widespread Gren ecosystem convention.
- Standard library HTML functions `type_` and `main_` are also underscore-suffixed due to keyword conflicts, but these are library functions we consume, not field names we define.
- The CODING_STANDARDS.md section should be placed after the existing "Use the Pipe Operator for Data Flow" section and before "Fail on Malformed or Missing Data", as it concerns naming conventions which are a natural follow-up to code style sections.
- The existing "Fail on Malformed or Missing Data" section already contains `port_` in its examples (lines 307 and 349). These examples should be updated to demonstrate the new convention: internal config uses `serverPort`, library boundary uses `port_`.
