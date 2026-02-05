# Developer Report

## Task
Rename the `title` field to `description` on the Task type (both Gren types and JSON serialization) and add file attachment support with upload, download, and delete endpoints, per-task storage, and a configurable upload directory.

## Files Modified

### Backend (src/chorus/)
- `src/chorus/src/Task/Registry.gren` - Renamed `title` to `description` in `Task` and `TaskSummary` types; added `Attachment` type alias and `attachments : Array Attachment` field to `Task`; updated all encoders/decoders (using `Decode.andThen` for the 9th field since Gren only has `map8`); added `encodeAttachment`, `attachmentDecoder`, and `contentTypeFromExtension` helper; updated `createTask` signature and event data key
- `src/chorus/src/Web/Router.gren` - Added `UploadAttachment`, `DownloadAttachment`, and `DeleteAttachment` route variants with route parsing for `POST/GET/DELETE /api/tasks/:id/attachments/...`
- `src/chorus/src/Web/Api.gren` - Renamed `CreateTaskParams.title` to `.description`; added `BinaryResult` type; added `requestUploadAttachment`, `requestDownloadAttachment`, `requestDeleteAttachment` handlers; added `sendBinaryResponse` for binary file downloads; exposed new types and functions
- `src/chorus/src/Main.gren` - Added `uploadDir` field to `Config`; read `CHORUS_UPLOAD_DIR` env var in `configFromEnv`; renamed `parseCreateTaskBody` to expect `"description"`; added `GotBinaryResult` msg variant; added route handling for attachment endpoints with 10MB size limit check

### Frontend (src/chorus-ui/)
- `src/chorus-ui/src/Api.gren` - Renamed `Task.title` to `Task.description`; added `Attachment` type alias and `attachments` field to `Task`; updated `taskDecoder` with backward-compatible `attachments` decoding via `Decode.oneOf`; added `attachmentDecoder`; added `uploadAttachment` and `deleteAttachment` API functions; updated `createTask` to send `"description"`
- `src/chorus-ui/src/Main.gren` - Renamed `CreateTaskForm.title` to `.description`; renamed `UpdateCreateTitle` msg to `UpdateCreateDescription`; changed `<input>` to `<textarea>` in create modal; added `FileSelected`, `GotFileBytes`, `FileUploaded`, `DeleteAttachment`, `AttachmentDeleted` msg variants; added file upload/delete handlers; updated TaskDetail props to pass attachment callbacks
- `src/chorus-ui/src/View/Dashboard.gren` - Changed `task.title` to `task.description`; added `task-description-truncate` CSS class
- `src/chorus-ui/src/View/TaskList.gren` - Changed column header from "Title" to "Description"; changed `task.title` to `task.description`; added CSS classes for truncation
- `src/chorus-ui/src/View/TaskDetail.gren` - Changed `task.title` to `task.description`; added `onFileSelected` and `onDeleteAttachment` callbacks to Props; added `viewAttachments` section with file list (download links, sizes, delete buttons) and file upload control using hidden `<input type="file">`; added `formatFileSize` helper
- `src/chorus-ui/static/styles.css` - Updated form styles for `<textarea>`; added `.task-description-truncate` and `.task-description-cell` styles for truncation; added attachment list, attachment item, attachment link, attachment size, and attachment upload styles

### Configuration
- `docker-compose.yml` - Added `CHORUS_UPLOAD_DIR=/app/data/uploads` environment variable
- `Dockerfile` - Added `ENV CHORUS_UPLOAD_DIR=/app/data/uploads`; added `/app/data/uploads` to `mkdir` command

### Tests
- `src/chorus/tests/unit/RegistryTests.gren` - Changed all `title` references to `description`; added `attachments = []` to all test task records
- `src/chorus/tests/integration/IntegrationRunner.gren` - Changed all `title` references to `description`; updated `assertEqual` call from `"task title"` to `"task description"`

## Build Status
**Status:** PASS

```
npm run build:app completes without errors.
All 3 components build: chorus-ui (6 modules), tools (4 modules), chorus (8 modules).
```

## Test Status
**Status:** PASS

```
Unit tests: 17 passed, 0 failed
Integration tests: 18 passed, 0 failed
```

## Implementation Notes

- The `taskDecoder` now decodes 9 fields using `Decode.map8` for the first 8 fields, then `Decode.andThen` to decode the `attachments` field. This approach handles backward compatibility: if `"attachments"` is missing from the JSON, it defaults to an empty array via `Decode.oneOf`.

- File upload in the frontend uses a hidden `<input type="file">` element with a change event listener that extracts the File via `File.decoder`. The selected file's bytes are read with `File.toBytes`, then uploaded via `Http.bytesBody` to `POST /api/tasks/:id/attachments?filename=<name>`.

- The upload endpoint writes raw request body bytes directly to disk. The filename comes from the query parameter. Content type is inferred from the file extension using `contentTypeFromExtension`.

- The 10MB upload size limit is checked by comparing `Bytes.length` of the request body before writing to disk.

- `Array.findFirst` in Gren returns `Maybe { index : Int, value : a }` rather than `Maybe a`, so the download handler pattern-matches on `Just { value }`.

- The `title` to `description` rename is a breaking change for persisted data as specified in the requirements. Existing `task.json` files with `"title"` will fail to decode.

- The `CHORUS_UPLOAD_DIR` defaults to `./data/uploads` in the app config and `/app/data/uploads` in Docker. The uploads directory is covered by the existing `/app/data` volume mount.

## Iteration
1
