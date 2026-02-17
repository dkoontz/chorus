# Code Review Report

## Summary

The refactoring is well-executed overall: the `ExecutorState` union type correctly encodes lifecycle phases, `pendingHandoffResponses` is removed, `NoProviderState` is eliminated, and the smaller fixes (toolName, file.list paths, exec) are clean. Two correctness issues were found: a leaked deferred response when a spawning handoff executor fails, and a remaining catch-all pattern that should be made explicit.

## Issues Found

### BLOCKING Issues

#### Issue 1: Deferred handoff response leaked when Spawning executor fails
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2571-2579
- **Category:** Correctness
- **Description:** When `handleProviderEvent` receives `AgentFailed` for a `Spawning` executor that has a `deferredResponse` (i.e., was spawned via a deferred handoff), the code removes the executor from `activeExecutors` without resolving the HTTP response. The parent agent's HTTP request will hang until timeout. The old code did not have this issue because `AgentFailed` was forwarded to the Executor, which transitioned to `Failed`, triggering `handleExecutorStateTransition` -> `handleUserAgentComplete`, which looked up `pendingHandoffResponses` and resolved it. The new code's `Spawning` branch short-circuits this path.

  The same problem exists in `GotProviderResolved` at line 1117-1120 where the comment says "deferred response will be lost, but the AgentFailed event will clean up" -- but the AgentFailed cleanup (line 2576-2578) does not resolve the deferred response either.
- **Suggestion:** In the `Spawning` + `AgentFailed` branch of `handleProviderEvent`, check `spawning.deferredResponse` and resolve it with an error response if present:
  ```gren
  Just (Spawning spawning) ->
      when event is
          Provider.AgentFailed error ->
              let
                  deferredCmd =
                      when spawning.deferredResponse is
                          Just deferredResponse ->
                              Api.sendApiResponse deferredResponse
                                  (Api.ApiError { statusCode = 500, code = "AGENT_FAILED", message = error })

                          Nothing ->
                              Cmd.none
              in
              { model = { model | activeExecutors = Dict.remove taskIdStr model.activeExecutors }
              , command =
                  Cmd.batch
                      [ Logging.logError model.logger ("Agent failed during spawn for task " ++ taskIdStr ++ ": " ++ error) NoOp
                      , deferredCmd
                      ]
              }
  ```

### Suggestions

#### Suggestion 1: Remaining catch-all pattern for ProviderState in routeToolCallToExecutor
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 4162
- **Category:** Style
- **Description:** The `pendingCount` calculation uses a `_ -> 0` catch-all for non-CLI provider states. Now that `NoProviderState` has been removed, the only remaining variant is `ApiProviderState`. Making this explicit would be consistent with the changes made in `ClaudeCode.gren` and `OpenCode.gren` (which were updated from `_ ->` to `ApiProviderState _ ->`), and ensures the compiler flags this site if new `ProviderState` variants are added in the future.
- **Suggestion:** Replace `_ -> 0` with `Provider.ApiProviderState _ -> 0`.

#### Suggestion 2: Verbose repetition in handleProviderEventForExecutor for looking up executor state
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2607-2619
- **Category:** Simplification
- **Description:** The `updatedExecutorState` computation in `handleProviderEventForExecutor` repeats `Maybe.withDefault (AgentActive executor) (Dict.get taskIdStr model.activeExecutors)` three times -- once for the `AgentCompleted` with `Just sid` case, once for `Nothing`, and once for the `_ ->` catch-all. The only branch that actually does something different is the `Just sid` case. This could be simplified by looking up the current state once and only applying `updateActiveExecutor` in the one case that needs it.
- **Suggestion:** Simplify to:
  ```gren
  currentState =
      Maybe.withDefault (AgentActive executor) (Dict.get taskIdStr model.activeExecutors)

  updatedExecutorState =
      when event is
          Provider.AgentCompleted { sessionId } ->
              when sessionId is
                  Just sid ->
                      updateActiveExecutor (\e -> { e | sessionId = Just sid }) currentState

                  Nothing ->
                      currentState

          _ ->
              currentState
  ```

#### Suggestion 3: Duplicated agentKind computation
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 448-453 and 573-578
- **Category:** Duplication
- **Description:** The `agentKind` conversion from `Bool` to `AgentKind` is computed identically in both `spawnAgent` and `resolveAndSpawnAgent`. This is a small helper that could be extracted, though it is minor enough to be acceptable as-is.
- **Suggestion:** Extract a helper `agentKindFromBool : Bool -> AgentKind` or consider changing the caller signatures to pass `AgentKind` directly instead of `Bool`.

#### Suggestion 4: Consider using `String.length` instead of `String.unitLength` for path prefix stripping
- **File:** `packages/tools/src/Tools/File.gren`
- **Line:** 732
- **Category:** Correctness
- **Description:** `String.unitLength` returns the number of UTF-16 code units, which differs from `String.length` (which returns the number of Unicode code points) for characters outside the Basic Multilingual Plane. While file paths are almost always ASCII, using `String.length` would be more semantically correct if Gren's `String.dropFirst` operates on code points. Verify that `String.dropFirst` and `String.unitLength` use the same counting -- if they do, this is correct. If `String.dropFirst` counts code points, then `String.length` should be used instead.
- **Suggestion:** Verify that `String.dropFirst` uses the same unit as `String.unitLength` (UTF-16 code units). If it does, the current code is correct. If `String.dropFirst` counts Unicode code points (grapheme clusters or scalar values), switch to `String.length`.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue (Issue 1) must be fixed before merge. When a deferred handoff agent fails during the spawning phase, the parent agent's HTTP response handle is silently dropped, causing the parent to hang indefinitely. This is the exact class of bug (leaked response handle) that the `ActiveHandoff` refactoring was designed to prevent, so it should be addressed as part of this change.

The suggestions are improvements worth considering but are not required for merge.
