# Add user logout button

## Requirements
- Add a logout button to the header component
- Clicking the button should clear the session and redirect to login

## Acceptance Criteria
- Button is visible when user is logged in
- Clicking button logs user out
- User is redirected to /login after logout

## Context
The header component is in src/components/Header.tsx.
Session management uses the useAuth hook.
