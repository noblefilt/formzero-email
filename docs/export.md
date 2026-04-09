# export

## Purpose

`src/export/` owns conversion from editor document to deliverable output. It is
the trust boundary of the product: if export is wrong, the editor is wrong.

## First-Pass Outputs

The initial module should support:

- HTML string generation
- HTML download
- clipboard copy when supported

Image and PDF export may start as placeholders, but their future interface must
be anticipated in the module shape.

## Export Pipeline

The export flow must be:

`document -> normalize -> validate -> render -> package result`

Each step must remain independently testable.

## Export Result Contract

The export module should return a structured result:

- `ok`
- `html`
- `warnings`
- `errors`
- `generatedAt`

Export must never fail silently.

## Validation Rules

Export-time validation must at minimum catch:

- missing subject when required by product policy
- missing button URL
- missing image source
- missing image alt text
- empty required content regions

Warnings and errors must be distinguishable. Errors block export; warnings do
not.

## Fidelity Rule

Preview and export must consume the same normalized document structure.
If preview uses a different renderer model than export, divergence will become a
systemic defect.

## Suggested Structure

```text
src/export/
  download-html.ts
  render-email-html.ts
  types.ts
```

The rendering module must remain pure and deterministic.
