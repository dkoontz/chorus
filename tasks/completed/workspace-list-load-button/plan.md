# Task: Workspace List Load Button

## Summary

Change the recent workspaces list so that workspace paths are displayed as non-clickable text, and add a "Load" button on the right side of each entry (similar in style to the "Open" and "Create" buttons) that carries out the workspace loading action. The "Load" button is disabled when the workspace is already the active workspace.

## Requirements

- The workspace path in each recent workspace entry should be displayed as plain, non-clickable text (no link styling, no click handler)
- A "Load" button should appear on the right side of each entry, between the path text and the remove ("x") button
- The "Load" button should use `btn btn-primary btn-small` classes to match the styling of the "Open" and "Create" buttons but at a smaller size appropriate for the list row
- The "Load" button should be disabled when the entry's `configPath` matches the currently active workspace's `configPath`
- The "Load" button should also be disabled while loading is in progress (existing `config.loading` behavior)

## Acceptance Criteria

- [ ] Workspace paths in the recent workspaces list are rendered as plain text (not clickable)
- [ ] Each recent workspace entry has a "Load" button on the right side
- [ ] Clicking "Load" triggers the same `onOpenRecentWorkspace` action as clicking the path previously did
- [ ] The "Load" button is disabled when the workspace is already the active workspace
- [ ] The "Load" button is disabled while a loading operation is in progress
- [ ] The "Load" button uses styling consistent with the "Open" and "Create" buttons (btn-primary pattern)
- [ ] A general `.btn:disabled` CSS rule is added for disabled button styling

## Files to Modify

- `packages/chorus-ui/src/View/Workspaces.gren` - Change `viewRecentWorkspaceEntry` to render path as plain text and add "Load" button with disabled state logic
- `packages/chorus-ui/static/styles.css` - Update `.recent-workspace-path` styling (remove link styles), add `.btn:disabled` rule, remove obsolete hover/disabled rules for the path element

## Out of Scope

- Changing the "Open" or "Create" workspace forms
- Changing the workspace removal ("x") button behavior
- Backend/API changes
