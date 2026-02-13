# Disable Plan and Start actions when system agent provider is not configured

## Summary
When `systemAgentProvider` is `NotConfigured` in the workspace config, the "Plan Task" and "Start Task" controls should be disabled in the UI with an explanatory message, and the backend should reject the corresponding API calls with a clear error. Task creation remains allowed so users can capture work items before configuring a provider.

## Requirements
- UI: Disable the "Plan Task" button when `systemAgentProvider` is `NotConfigured` (shown in `Pending` status view)
- UI: Disable the agent selector and "Start Task" button when `systemAgentProvider` is `NotConfigured` (shown in `ReadyToStart` status view)
- UI: Show a message near the disabled controls explaining that a system agent provider must be configured in Settings
- Backend: `POST /api/tasks/:id/plan` returns an error when `systemAgentProvider` is `NotConfigured`
- Backend: `POST /api/tasks/:id/handoff` returns an error when `systemAgentProvider` is `NotConfigured`

## Acceptance Criteria
- [ ] When `systemAgentProvider` is `NotConfigured`, clicking "Plan Task" is not possible (button is disabled)
- [ ] When `systemAgentProvider` is `NotConfigured`, the agent selector and "Start Task" button are disabled
- [ ] A visible message tells the user to configure the system agent provider in Settings
- [ ] `POST /api/tasks/:id/plan` returns a 409 error with a descriptive message when `systemAgentProvider` is `NotConfigured`
- [ ] `POST /api/tasks/:id/handoff` returns a 409 error with a descriptive message when `systemAgentProvider` is `NotConfigured`
- [ ] When `systemAgentProvider` IS configured (e.g. `ProviderRef "my-provider"`), Plan and Start work as before with no behavioral change
- [ ] Task creation (`POST /api/tasks`) is unaffected regardless of provider configuration

## Out of Scope
- Disabling task creation (users should be able to capture tasks even without a provider)
- Changes to the workspace/settings pages
- Provider auto-detection or setup wizard
- Validation of whether the referenced provider actually exists (already handled elsewhere)

## Technical Context

### Files to Modify
- `packages/chorus-ui/src/View/TaskDetail.gren` - Add `systemAgentProviderConfigured : Bool` to `Props`, use it to disable Plan/Start controls and show a configuration message
- `packages/chorus-ui/src/Main.gren` - Extract `systemAgentProviderConfigured` from `model.workspaceStatus` and pass it to `TaskDetail.view` props
- `packages/chorus/src/Main.gren` - Add `systemAgentProvider` check before dispatching planner (in `GotPlanTaskResult` handler) and before processing handoff (in `Router.StartHandoff` handler)

### Related Files (reference only)
- `packages/shared/Types.gren` - Defines `WorkspaceConfig` (line 329) with `systemAgentProvider : AgentProvider`, and `AgentProvider` type (`NotConfigured | ProviderRef String`)
- `packages/chorus-ui/src/WorkspaceStatus.gren` - `WorkspaceStatus` type: `NoWorkspace | WorkspaceOpened { config, configPath } | WorkspaceError String`
- `packages/chorus/src/Web/Api.gren` - `requestPlanTask` (line 476) handles `POST /api/tasks/:id/plan`
- `packages/chorus-ui/src/View/SystemSettings.gren` - Where users configure `systemAgentProvider` (for linking in the disabled message)

### Patterns to Follow

#### UI: Disabling controls
The existing "Start Task" button pattern at `View/TaskDetail.gren:226-231` already shows how to disable a button:
```gren
, button
    [ class "btn btn-primary"
    , onClick (props.onStartTask taskId)
    , disabled (not hasAgent)
    ]
    [ text "Start Task" ]
```
Follow this pattern, adding the provider check alongside the existing `hasAgent` check.

#### Backend: Early validation in route handler
The `Router.StartHandoff` handler at `Main.gren:1611-1657` already validates agent provider existence. Add the `systemAgentProvider` check earlier in the same handler, before any agent lookup. For the plan endpoint, add the check in `GotPlanTaskResult` before calling `dispatchPlanner`, or earlier in the route handler before calling `requestPlanTask`.

#### Backend: Error response pattern
Use the existing `sendBadRequest` helper for returning errors from the route handler. The error message should match the style used in `dispatchPlanner` (line 2148): `"System agent provider is not configured. Please configure it in System Settings."`

### Implementation Notes

#### UI changes in `View/TaskDetail.gren`
1. Add `systemAgentProviderConfigured : Bool` to the `Props` type alias
2. In `viewStatusActions`, for the `Pending` branch: wrap the "Plan Task" button with a disabled state and a helper text `span` when `not props.systemAgentProviderConfigured`
3. In `viewStartWithAgent`: combine the provider check with the existing `hasAgent` check for the "Start Task" button disabled state; also disable the `select` element

#### UI changes in `Main.gren`
1. Derive the boolean from the model:
   ```gren
   systemAgentProviderConfigured =
       when model.workspaceStatus is
           WorkspaceOpened { config } ->
               when config.systemAgentProvider is
                   ProviderRef _ -> True
                   NotConfigured -> False
           _ -> False
   ```
2. Pass it to `TaskDetail.view` props

#### Backend changes in `Main.gren`
1. For `Router.PlanTask`: check `model.workspaceConfig` for `systemAgentProvider` before calling `Api.requestPlanTask`. If `NotConfigured`, return 409 via `sendBadRequest`.
2. For `Router.StartHandoff`: check `model.workspaceConfig` for `systemAgentProvider` before looking up the agent. If `NotConfigured`, return 409 via `sendBadRequest`.
3. The existing check in `dispatchPlanner` (line 2146-2149) already handles this for the planner dispatch itself, but the API should reject the request earlier so the client gets a proper error response rather than a 200 followed by a silent failure.

## Testing Requirements
- Build the app (`npm run build:all`) and verify it compiles without errors
- With `systemAgentProvider` set to `"not-configured"` in `chorus.json`:
  - Verify "Plan Task" button is disabled on a Pending task
  - Verify "Start Task" button is disabled on a ReadyToStart task
  - Verify the explanatory message is shown
  - Verify `POST /api/tasks/:id/plan` returns a 409 error
  - Verify `POST /api/tasks/:id/handoff` returns a 409 error
- With `systemAgentProvider` set to a valid provider name:
  - Verify "Plan Task" and "Start Task" work normally
- Verify task creation works regardless of provider configuration

## Notes
- The backend already has a `systemAgentProvider` check in `dispatchPlanner` (line 2146-2149) that returns an error if not configured, but this happens after the API has already returned a 200 response. The new backend validation should happen before the API response so the client receives the error.
- `NoWorkspace` state in the UI should also result in disabled controls (the user hasn't opened a workspace yet, so there's no provider configured). The current UI already hides task-related navigation when no workspace is loaded, so this is a secondary concern.
