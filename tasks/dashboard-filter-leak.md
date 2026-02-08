# Dashboard Filter State Leak

## Summary

When a status filter is active on the Tasks page and the user navigates to the Dashboard via the nav link (SPA navigation), the Dashboard inherits the filter state and displays filtered results instead of all tasks. The dashboard counters and Recent Activity list only show tasks matching the filter from the Tasks page.

A full page reload resolves the issue - the Dashboard then shows all tasks correctly.

## Steps to Reproduce

1. Navigate to the Tasks page
2. Use the "Filter by status" dropdown to select a specific status (e.g., "Failed")
3. Confirm the Tasks list is filtered correctly
4. Click "Dashboard" in the nav bar to navigate to the Dashboard view

**Expected:** Dashboard shows all tasks with accurate counters across all statuses.

**Actual:** Dashboard shows only the tasks matching the filter from the Tasks page. Counters reflect the filtered set, not the full set.

## Fix

The Dashboard view should always show all tasks regardless of any filter state on the Tasks page. Either:

- Reset the filter to "All" when navigating to the Dashboard
- Have the Dashboard ignore the shared filter state and always fetch/display all tasks
- Scope the filter state to the Tasks page only so it doesn't affect the Dashboard
