# blocks

## Purpose

`src/blocks/` defines every reusable content block that can appear inside an
template document. A block is not just a visual component; it is a typed unit
with schema, defaults, editor behavior, preview behavior, export behavior, and
validation.

## P0 Block Set

The minimum block set for the MVP is:

- `section`
- `text`
- `image`
- `button`
- `divider`
- `spacer`
- `html`

Columns may initially be represented via section layout metadata, but the
document model must not prevent a future first-class column block.

## Required Block Contract

Every block definition must provide:

- stable `type`
- human-readable `label`
- default content
- default style tokens
- editor renderer
- preview renderer
- export renderer or export mapping
- validation rules
- empty-state behavior when applicable

## Block Design Rules

- Blocks must be content primitives, not page-specific composites.
- Block defaults must be production-safe, not demo-only ornament.
- Style values must come from design tokens or structured props, not free-form
  hardcoded values.
- Invalid blocks must remain editable and explain what needs to be fixed.

## Validation Expectations

Examples:

- text block: empty text is allowed only if the editor clearly marks it as empty
- image block: missing `src` or `alt` must produce validation feedback
- button block: invalid or missing URL must block export until resolved
- html block: unsafe or malformed content must surface warnings

## Extensibility Rules

Adding a new block must not require:

- rewriting the reducer
- rewriting the export pipeline
- changing the template persistence model
- bypassing the shared block registry

## Suggested Structure

```text
src/blocks/
  definitions.ts
  registry.ts
  types.ts
```

Block-specific files may be split out later, but the registry must remain the
single discovery point for editor, preview, and export surfaces.
