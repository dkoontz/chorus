# Task Description Rename and File Attachments

## Summary

Rename the `title` field on the Task type to `description` (both in Gren types and JSON serialization) to better reflect that it holds arbitrary-length text, and add the ability to upload file attachments to tasks via a new API endpoint with per-task storage under a configurable upload directory.

## Requirements

### Part 1: Rename `title` to `description`

- Rename the `title` field to `description` in the `Task` type alias in `Task.Registry`
- Rename the `title` field to `description` in the `TaskSummary` type alias in `Task.Registry`
- Change the JSON serialization key from `"title"` to `"description"` in all encoders and decoders (both backend and frontend)
- Update all call sites that reference `.title` to use `.description`
- Update the `CreateTaskParams` type alias in `Web.Api` to use `description` instead of `title`
- Update the create-task request body parser in `Main.gren` to expect `"description"` instead of `"title"`
- Update the history event data key from `"title"` to `"description"` in `createTask`
- Update all unit tests and integration tests to use `description` instead of `title`

### Part 2: File attachments - Backend

- Add an `attachments` field to the `Task` type: `attachments : Array Attachment`
- Define an `Attachment` type alias: `{ filename : String, size : Int, contentType : String, uploadedAt : Time.Posix }`
- Add a `CHORUS_UPLOAD_DIR` environment variable (default: `./data/uploads`)
- Read `CHORUS_UPLOAD_DIR` in `configFromEnv` and store it in the `Config` record
- Add a new route: `POST /api/tasks/:id/attachments?filename=<name>` for uploading files
  - Accept raw binary request body
  - Read filename from the `filename` query parameter
  - Store the file at `{CHORUS_UPLOAD_DIR}/{task-id}/{filename}`
  - Create the per-task subdirectory if it does not exist
  - Add the attachment metadata to the task's `attachments` array in `task.json`
  - Infer content type from file extension (a basic mapping for common types: png, jpg, jpeg, gif, pdf, txt, md, json, csv, html)
  - Return the updated task JSON
  - Reject uploads larger than 10MB (check `Content-Length` header or body size)
- Add a new route: `GET /api/tasks/:id/attachments/:filename` for downloading files
  - Read the file from `{CHORUS_UPLOAD_DIR}/{task-id}/{filename}`
  - Set the `Content-Type` header based on the stored content type
  - Return the raw file bytes
  - Return 404 if the file does not exist
- Add a new route: `DELETE /api/tasks/:id/attachments/:filename` for removing files
  - Delete the file from disk
  - Remove the attachment entry from `task.json`
  - Return the updated task JSON
- Encode/decode the `attachments` array in `encodeTask`/`taskDecoder` (default to empty array; decode with `Decode.oneOf` to handle existing tasks without the field)
- Encode the `attachments` array in `encodeTaskSummary`/`taskSummaryDecoder` is not needed (summaries do not need attachment data)

### Part 3: File attachments - Frontend

- Add an `attachments` field to the `Api.Task` type alias in the UI: `attachments : Array Attachment`
- Define an `Attachment` type alias in the UI `Api` module
- Update the task decoder in the UI to handle the `attachments` field (with fallback to empty array for backward compatibility)
- On the task detail page, display an "Attachments" section showing:
  - List of attached files with filename, size, and upload timestamp
  - Each filename links to `GET /api/tasks/:id/attachments/:filename` for download
  - A delete button next to each attachment
- Add a file upload control on the task detail page:
  - A file input (one file at a time)
  - Upload button that sends the file via `POST /api/tasks/:id/attachments?filename=<name>`
  - Show upload progress or at least a loading indicator
- Update the create-task modal to use a `<textarea>` instead of `<input>` for the description field
- Update the task list table:
  - Rename the "Title" column header to "Description"
  - Truncate long descriptions in the table (CSS `text-overflow: ellipsis`, max 1-2 lines)
- Update the dashboard recent-tasks list to show truncated descriptions
- Add CSS styles for the attachments section, file upload control, and textarea

### Part 4: Docker configuration

- Add `CHORUS_UPLOAD_DIR` to `docker-compose.yml` environment section (default: `/app/data/uploads`)
- Add `CHORUS_UPLOAD_DIR` to the Dockerfile ENV section
- Create the uploads directory in the Dockerfile runtime stage (`mkdir -p /app/data/uploads`)
- The uploads directory is already covered by the existing data volume mount (`/app/data`)

## Acceptance Criteria

- [ ] The `Task` type uses `description` instead of `title` in all Gren source files
- [ ] The JSON key in task.json is `"description"` (not `"title"`)
- [ ] The create-task API accepts `"description"` in the request body
- [ ] The create-task UI form uses a `<textarea>` for the description
- [ ] The task list table column is labeled "Description" and truncates long text
- [ ] `POST /api/tasks/:id/attachments?filename=doc.pdf` with a raw binary body stores the file at `{CHORUS_UPLOAD_DIR}/{task-id}/doc.pdf` and updates `task.json`
- [ ] `GET /api/tasks/:id/attachments/doc.pdf` returns the file with correct `Content-Type`
- [ ] `DELETE /api/tasks/:id/attachments/doc.pdf` removes the file and updates `task.json`
- [ ] Uploads larger than 10MB are rejected with an error response
- [ ] The task detail page shows an attachments list with download links and delete buttons
- [ ] The task detail page has a file upload control that works for one file at a time
- [ ] `CHORUS_UPLOAD_DIR` is configurable via environment variable in docker-compose.yml
- [ ] All existing unit tests pass after renaming `title` to `description`
- [ ] All existing integration tests pass after renaming `title` to `description`
- [ ] `npm run build:all` completes without errors

## Out of Scope

- Migration of existing `task.json` files from `title` to `description`
- Multiple file upload in a single request
- Drag-and-drop file upload
- Image thumbnails or file previews
- Virus scanning or content validation of uploaded files
- File versioning
- Attachment size quotas per task
- Searching or filtering by attachment metadata

## Technical Context

### Files to Modify

**Backend (src/chorus/):**
- `src/chorus/src/Task/Registry.gren` - Rename `title` to `description` in `Task` and `TaskSummary` types, add `Attachment` type and `attachments` field, update all encoders/decoders, update `createTask` function signature and event data
- `src/chorus/src/Web/Router.gren` - Add `UploadAttachment String`, `DownloadAttachment String String`, and `DeleteAttachment String String` route variants; add route parsing for `POST/GET/DELETE /api/tasks/:id/attachments/...`
- `src/chorus/src/Web/Api.gren` - Rename `CreateTaskParams.title` to `.description`; add `requestUploadAttachment`, `requestDownloadAttachment`, `requestDeleteAttachment` handlers
- `src/chorus/src/Main.gren` - Rename `parseCreateTaskBody` to expect `"description"`; add config field `uploadDir`; read `CHORUS_UPLOAD_DIR` env var; add route handling for attachment endpoints; add `GotAttachmentResult` msg variant for binary responses
- `src/chorus/src/Web/Server.gren` - No changes expected (generic HTTP server wrapper)

**Frontend (src/chorus-ui/):**
- `src/chorus-ui/src/Api.gren` - Rename `Task.title` to `Task.description`; add `Attachment` type; update `taskDecoder` to decode `"description"` and `"attachments"`; add `uploadAttachment`, `downloadAttachment`, `deleteAttachment` functions; update `createTask` to send `"description"`
- `src/chorus-ui/src/Main.gren` - Rename `CreateTaskForm.title` to `.description`; rename `UpdateCreateTitle` to `UpdateCreateDescription`; change `<input>` to `<textarea>` in create modal; add file upload Msg variants (`SelectFile`, `FileSelected`, `UploadFile`, `FileUploaded`, `DeleteAttachment`, `AttachmentDeleted`); add attachment upload/delete state
- `src/chorus-ui/src/View/Dashboard.gren` - Change `task.title` to `task.description`
- `src/chorus-ui/src/View/TaskList.gren` - Change column header from "Title" to "Description"; change `task.title` to `task.description`; add CSS class for truncation
- `src/chorus-ui/src/View/TaskDetail.gren` - Change `task.title` to `task.description`; add `viewAttachments` section showing file list with download/delete; add file upload form; accept attachment-related callbacks in `Props`
- `src/chorus-ui/static/styles.css` - Add styles for textarea in create modal, attachment list, upload control, truncated description in table

**Configuration:**
- `docker-compose.yml` - Add `CHORUS_UPLOAD_DIR=/app/data/uploads`
- `Dockerfile` - Add `ENV CHORUS_UPLOAD_DIR=/app/data/uploads` and `mkdir -p /app/data/uploads`

**Tests:**
- `src/chorus/tests/unit/RegistryTests.gren` - Change all `title` references to `description`
- `src/chorus/tests/integration/IntegrationRunner.gren` - Change all `title` references to `description`

### Related Files (reference only)
- `src/chorus/src/Task/Queue.gren` - Queue module for reference on file I/O patterns
- `src/chorus/src/Web/Static.gren` - Static file serving for reference on binary response patterns
- `src/chorus/src/Logging.gren` - Logger module (no changes needed)

### Patterns to Follow

- Gren uses `when ... is` for pattern matching (not `case ... of`)
- Record updates: `{ model | field = value }`
- File I/O uses `FileSystem.Permission` and returns `GrenTask.Task Error result`
- JSON encoding uses `Encode.object [ { key = "...", value = ... } ]`
- JSON decoding uses `Decode.field "key" decoder` and `Decode.mapN` combinators
- API handlers follow: `requestXxx : ApiContext -> ... -> (ApiResult -> msg) -> Cmd msg`
- Routes are union type variants in `Web.Router.Route`
- The `ApiResult` type has `ApiSuccess` and `ApiError` constructors
- Atomic file writes use the existing `writeFileAtomic` helper
- The `wrapResponse` function wraps API responses in `{ data: ..., meta: { timestamp: ... } }` format
- For backward-compatible decoding, use `Decode.oneOf` with a fallback (e.g., decode `attachments` or default to `[]`)
- File upload uses raw `request.body` bytes (accessed via `Bytes` module), not multipart
- Query parameters are extracted by the router's `extractQueryParams` function

## Testing Requirements

- Update `testTaskEncodeDecode` to use `description` instead of `title` and verify round-trip
- Update `testStatusRoundTrip` helper to use `description`
- Update `testSourceInfoEncodeDecode` to use `description`
- Update all integration tests (`testCreateTaskCreatesTask`, `testGetTaskReturnsTask`, etc.) to pass `description` instead of `title`
- Verify that task JSON with an `attachments` field encodes and decodes correctly
- Verify that task JSON without an `attachments` field decodes with an empty array (backward compatibility)
- All tests should pass with `npm run test:unit` and `npm run test:integration`
- Manual test: create a task via the UI with a multi-line description
- Manual test: upload a file to a task and verify it appears in the attachments list
- Manual test: download an attached file and verify contents
- Manual test: delete an attached file and verify it is removed

## Notes

- The `title` to `description` rename is intentionally a breaking change for persisted data. Existing task.json files will fail to decode. This is acceptable per the user's decision.
- The `Decode.map8` used for task decoding will need to change to accommodate the new `attachments` field. Since Gren does not have `Decode.map9`, use `Decode.andThen` or a pipeline approach to decode the 9th field. One approach: decode 8 fields, then use `Decode.andThen` to decode `attachments` and merge it in.
- Content-type inference should use a simple helper function mapping file extensions to MIME types. Unknown extensions default to `application/octet-stream`.
- The upload endpoint writes the raw request body bytes directly to disk. The filename comes from the query parameter, not from the body.
- File size limit of 10MB should be checked before writing to disk. If Gren's HttpServer provides content-length, use that; otherwise check `Bytes.length` of the body.
- The `CHORUS_UPLOAD_DIR` defaults to `./data/uploads` in the app config and `/app/data/uploads` in Docker. Since Docker maps `./data` to `/app/data`, the uploads directory is covered by the existing volume mount.
