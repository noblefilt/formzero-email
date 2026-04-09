# templates

## Purpose

`src/templates/` owns the lifecycle of template entities. Templates are durable
working assets, not disposable documents.

## Template Lifecycle

Every template must support:

- create
- duplicate
- rename
- edit
- preview
- export
- archive or delete
- restore where applicable

If a flow skips preview or export, it is incomplete by product standards.

## Required Template Fields

The first-pass template model should include:

- `id`
- `name`
- `status`
- `summary`
- `updatedAt`
- `document`

Optional fields that should be easy to add later:

- thumbnail
- tags
- version count
- last export timestamp

## Starter Templates

Starter templates are first-class product assets. They must:

- accelerate time to first success
- demonstrate good block composition
- avoid placeholder junk copy
- remain editable after duplication

## Persistence Rules

- Template metadata and document content must be serializable.
- Autosave must operate against template persistence, not only transient editor
  state.
- Deleting a template must require explicit confirmation.
- If hard delete is not yet implemented, archive must be the safe default.

## Suggested Structure

```text
src/templates/
  default-templates.ts
  types.ts
```

Persistence adapters or APIs can be added later, but template typing and starter
content should live here first.
