# Review Report

## Verdict: CHANGES REQUESTED

## Blocking Issues

### 1. Task type should be a union type, not a flat record with empty defaults

The current implementation adds `summary`, `requirements`, `acceptanceCriteria`, and `plan` as flat fields on every `Task` record, initialized to empty string/arrays. This doesn't distinguish between a task that has just been created (description only) and one that has been planned.

**Required design change:** Replace the flat `Task` type alias with a union type:

```gren
type Task
    = DescriptionOnly DescriptionOnlyTask
    | Planned PlannedTask

type alias DescriptionOnlyTask =
    { id : String
    , description : String
    , status : TaskStatus
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    , sessionId : Maybe String
    , source : SourceInfo
    , agentWorkspace : String
    , attachments : Array Attachment
    }

type alias PlannedTask =
    { id : String
    , description : String
    , status : TaskStatus
    , createdAt : Time.Posix
    , updatedAt : Time.Posix
    , sessionId : Maybe String
    , source : SourceInfo
    , agentWorkspace : String
    , attachments : Array Attachment
    , summary : String
    , requirements : Array String
    , acceptanceCriteria : Array String
    , plan : Array String
    }
```

Add helper functions to extract shared fields without pattern matching every time:

```gren
taskId : Task -> String
taskDescription : Task -> String
taskStatus : Task -> TaskStatus
taskCreatedAt : Task -> Time.Posix
taskUpdatedAt : Task -> Time.Posix
taskSessionId : Task -> Maybe String
taskSource : Task -> SourceInfo
taskAgentWorkspace : Task -> String
taskAttachments : Task -> Array Attachment
```

Also add:
```gren
isPlanned : Task -> Bool
planTask : Task -> PlanningFields -> Task  -- converts DescriptionOnly to Planned
```

Where `PlanningFields` is:
```gren
type alias PlanningFields =
    { summary : String
    , requirements : Array String
    , acceptanceCriteria : Array String
    , plan : Array String
    }
```

This affects:
- **Registry.gren**: Task type, encodeTask, taskDecoder, createTask (should create DescriptionOnly), updateTask (needs to handle both variants)
- **Web/Api.gren**: requestUpdatePlanning should convert a DescriptionOnly task to Planned when planning fields are set
- **Frontend Api.gren**: Same union type or equivalent representation
- **Frontend TaskDetail.gren**: Planning sections only shown for Planned tasks; DescriptionOnly tasks show a "Not yet planned" state with an option to add planning
- **All tests**: Updated for the new type

**JSON encoding**: Include a `"type"` field (e.g., `"descriptionOnly"` or `"planned"`) to distinguish variants on disk. Backward compatibility: existing task.json files without a `"type"` field should decode as `DescriptionOnly` if planning fields are missing, or `Planned` if planning fields are present.

## Suggestions (non-blocking)

(None - the blocking issue above covers the main concern.)

## Summary

The implementation is well-structured and the build/tests pass, but the core data model needs to use a union type to properly represent the distinction between unplanned and planned tasks.
