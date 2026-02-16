# Agent Tab Table View

## Summary

Replace the card-based Agent tab UI with a compact table-like view showing Name, Provider, Status (icons), and Allowed Tools columns. Add a bulk "Set Provider" action that lets users apply a provider + model to multiple agents at once.

## Requirements

- Replace the agent card layout with a table listing agents in rows
- Table columns: Name, Provider, Status, Allowed Tools
- Clicking on the Provider cell opens the existing edit modal for that agent
- Status column shows an icon instead of text:
  - Checkmark icon for "Ready" (provider configured and exists), with a tooltip "Provider configured"
  - Warning/alert icon for "No Provider" (not configured or provider missing), with a tooltip "Provider not configured or missing"
- Header has existing "+ New Agent" button plus a new "Set Provider" button
- "Set Provider" button toggles a bulk-edit bar that shows:
  - A provider dropdown (same options as the edit form)
  - A model text input
  - An "Apply" button
  - Checkboxes to the left of each agent row (only visible in bulk-edit mode)
- Clicking "Apply" updates all selected (checked) agents to use the chosen provider and model via the existing `updateAgent` API
- Internal agents are still filtered out (existing behavior)
- The existing create/edit modal and delete functionality remain unchanged

## Acceptance Criteria

- [ ] Agent tab displays a table with columns: Name, Provider, Status, Allowed Tools
- [ ] Provider column text is clickable and opens the edit modal for that agent
- [ ] Status column shows a green checkmark (Unicode or CSS) with tooltip for valid agents
- [ ] Status column shows a warning icon with tooltip for agents with missing/unconfigured providers
- [ ] "Set Provider" button appears in the header next to "+ New Agent"
- [ ] Clicking "Set Provider" reveals a bulk-edit bar with provider dropdown, model input, and Apply button
- [ ] Checkboxes appear to the left of each agent row when bulk-edit mode is active
- [ ] Clicking "Apply" sends an `updateAgent` API call for each selected agent, setting their provider and model
- [ ] After bulk apply completes, the agents list refreshes to show updated data
- [ ] Clicking "Set Provider" again (or a Cancel/Close button) hides the bulk-edit bar and checkboxes
- [ ] The app compiles with `npm run build:all` without errors

## Out of Scope

- Bulk editing of other agent fields (instructions, allowed tools)
- Drag-and-drop reordering of agents
- Agent sorting or filtering controls
- Changes to the agent create/edit modal itself
- Backend API changes (use existing `PUT /api/agents/:name`)

## Technical Context

### Files to Modify

- `packages/chorus-ui/src/View/Agents.gren` - Replace card layout with table, add bulk-edit bar, add status icons, add checkbox column
- `packages/chorus-ui/src/Main.gren` - Add new model fields (`bulkProviderMode`, `selectedAgents`, `bulkProvider`, `bulkModel`), new Msg variants for bulk actions, update handlers
- `packages/chorus-ui/static/styles.css` - Add table styling for agents, status icon styles, bulk-edit bar styles

### Related Files (reference only)

- `packages/shared/Types.gren` - Defines `AgentConfig(..)`, `AgentProvider(..)`, `ProviderConfig` types (no changes needed)
- `packages/chorus-ui/src/Api.gren` - Existing `updateAgent` function used for bulk apply (no changes needed)
- `packages/chorus-ui/src/View/Providers.gren` - Reference for card/form patterns used elsewhere in the UI

### Patterns to Follow

- **Props pattern**: `View.Agents` uses a `Props msg` record to receive callbacks from Main. New callbacks for bulk actions follow the same pattern: add new fields to `Props msg` for each new event (e.g., `onToggleBulkMode : msg`, `onToggleAgentSelected : String -> msg`, `onUpdateBulkProvider : String -> msg`, `onUpdateBulkModel : String -> msg`, `onApplyBulkProvider : msg`).
- **Msg variants**: Agent-related Msg variants in Main.gren are grouped under `-- Agent CRUD`. Add new variants in the same section.
- **Model updates**: New model fields should be initialized in `init` and reset when navigating away from the Agents page (in `pageCommand`).
- **Bulk apply uses `Cmd.batch`**: Each agent writes to its own file, so concurrent `Api.updateAgent` calls for different agents are safe. After all succeed, refresh the agents list with `Api.getAgents GotAgents`.
- **Status icons**: Use Unicode characters for icons: checkmark = `\u2713` (or HTML entity), warning = `\u26A0`. Style them with CSS classes. Wrap in `span` with `title` attribute for tooltip.
- **Gren `Set` for selected agents**: Main.gren already imports `Set`. Use `Set String` for tracking selected agent names.
- **`when...is` pattern matching**: Gren uses `when...is` (not `case...of`). See existing code in `View/Agents.gren` for examples.
- **`Array.keepIf`**: Gren uses `Array.keepIf` instead of `filter`.

### Model Changes in Main.gren

Add these fields to the `Model` type alias:

```gren
, bulkProviderMode : Bool
, selectedAgents : Set String
, bulkProvider : String
, bulkModel : String
```

Initialize all to `False`, `Set.empty`, `""`, `""` in `init`.

### New Msg Variants in Main.gren

```gren
-- Agent bulk provider
| ToggleBulkProviderMode
| ToggleAgentSelected String
| UpdateBulkProvider String
| UpdateBulkModel String
| ApplyBulkProvider
| GotBulkAgentSaved (Result Http.Error AgentConfig)
```

### Update Handler for ApplyBulkProvider

For each selected agent name:
1. Look up the agent in `model.agents`
2. Build a new `AgentConfig` with the selected provider and model applied
3. Call `Api.updateAgent name newConfig GotBulkAgentSaved`
4. Use `Cmd.batch` to fire all calls at once (safe because each agent is a separate file)

For `GotBulkAgentSaved`: update the agent in `model.agents` (same as `GotAgentSaved` handler).

### View Changes in Agents.gren

Replace `viewAgentsList` with a table:

```
table.agents-table
  thead
    tr
      th (checkbox column, only if bulkMode)
      th Name
      th Provider
      th Status
      th Allowed Tools
  tbody
    for each agent:
      tr
        td (checkbox, only if bulkMode)
        td agent name
        td provider text (clickable -> opens edit modal)
        td status icon (checkmark or warning with title tooltip)
        td tools comma-separated
```

Add `viewBulkEditBar` above the table (visible only when `bulkProviderMode` is True):
- Provider `select` dropdown (same options as edit form)
- Model `input` text field
- "Apply" button
- "Cancel" button to close bulk mode

### Props Changes in Agents.gren

Add to `Props msg`:

```gren
, bulkProviderMode : Bool
, selectedAgents : Set String
, bulkProvider : String
, bulkModel : String
, onToggleBulkProviderMode : msg
, onToggleAgentSelected : String -> msg
, onUpdateBulkProvider : String -> msg
, onUpdateBulkModel : String -> msg
, onApplyBulkProvider : msg
```

The `Set` import will be needed in `View/Agents.gren`.

## Testing Requirements

- Build the project with `npm run build:all` and verify it compiles
- Manually test in browser:
  - Agents page shows table layout with correct columns
  - Clicking provider cell opens edit modal
  - Status icons display correctly for configured and unconfigured agents
  - Tooltips appear on hover over status icons
  - "Set Provider" button toggles bulk-edit bar
  - Checkboxes appear/disappear with bulk-edit mode
  - Selecting agents and clicking Apply updates their provider/model
  - Table refreshes after bulk apply

## Notes

- Unicode characters for status icons avoid the need for an icon library. The checkmark (`\u2713`) and warning sign (`\u26A0`) are universally supported. CSS can add color (green for valid, orange/red for invalid).
- The bulk apply fires all update requests in parallel via `Cmd.batch`. Since each agent config is stored in a separate file on the backend, there are no concurrent-write issues. This follows the coding standard about sequential writes only being required for the *same* file.
- The `GotBulkAgentSaved` handler can reuse the same logic as `GotAgentSaved` for updating the model's agents array. Consider extracting a shared helper to avoid duplication.
- When exiting bulk mode (toggle off or cancel), clear `selectedAgents` back to `Set.empty`.
- The `agentForm` (edit modal) and `bulkProviderMode` are independent states. Opening the edit modal via provider click should not affect bulk mode state.
