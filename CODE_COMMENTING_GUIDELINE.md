# Code Commenting Guideline

## Principle

Code should explain **what** it does through clear naming, focused functions and components, predictable architecture, meaningful types and interfaces, and appropriate decomposition.

Prefer expressive naming, decomposition, types, and architecture over explanatory comments.

Comments exist primarily to explain **why** something is implemented in a way that the code itself cannot communicate.

## Comments should explain

- Non-obvious business rules
- Architectural, security, or compatibility constraints
- Unusual browser or platform behavior
- External API quirks and backend assumptions that types do not make clear
- Intentional exceptions to normal patterns
- Invariants that future developers could accidentally violate
- Performance trade-offs
- Accessibility constraints when the reason is non-obvious
- Temporary limitations with a specific, actionable TODO

```ts
// Keep FEFO as the default because Inventory Staff must consume
// the earliest-expiring eligible batch before later batches.
```

```tsx
// Keep the chart shell mounted so the axes and card dimensions remain stable while data loads.
return <InventoryValueChart points={points ?? []} />;
```

```ts
// The authenticated actor must come from the session; accepting it from the body would allow audit spoofing.
const actorId = request.auth.userId;
```

## Comments should not narrate obvious code

Avoid comments that merely translate the next line into English.

```ts
// Avoid: Set loading to true.
setLoading(true);

// Avoid: Loop through records.
records.map(renderRecord);

// Avoid: Close modal.
setOpen(false);
```

The implementation already communicates those actions. Improve unclear naming or structure instead of adding narration.

## No implementation-history narration

Do not accumulate comments such as `Changed in Step 3`, `Updated based on latest request`, `Fixed previous implementation`, `New version`, `Old implementation removed`, `Codex change`, or date-stamped change notes.

Git history and project version notes record what changed, when, and by whom. Implementation comments describe the current reason or constraint.

## TODO standard

TODO comments must be actionable, specific, and tied to a real unresolved constraint.

```ts
// TODO: Replace the local placeholder source once the inventory
// batch endpoint exposes unit metadata.
```

Avoid vague notes such as `TODO: fix later`.

## Comment maintenance

When implementation changes:

- Remove comments that are no longer true.
- Update comments whose underlying constraint changed.
- Update or remove an inaccurate comment in the same change that made it inaccurate.
- Do not preserve stale explanations for historical context.

## Documentation versus comments

Use implementation comments for localized reasons and constraints.

Use documentation for architecture, workflows, cross-module contracts, setup instructions, coding standards, and version or release notes.

Use Git history and version notes for previous implementations and change chronology.

## JSX and TSX

Avoid excessive JSX comments that label visually obvious sections, such as `Header`, `Filters`, or `Table`, when component structure and naming already communicate them.

Comments are appropriate when a rendering decision has a non-obvious business or technical constraint.

## CSS

Do not narrate every selector. Reserve CSS comments for non-obvious layout constraints, browser workarounds, shared-contract boundaries, accessibility reasons, and intentional specificity decisions.

## SQL and backend code

Comments should document non-obvious integrity rules, security or row-level-security reasoning, transaction assumptions, unusual indexing or performance choices, and migration constraints. Do not comment obvious `SELECT`, `INSERT`, or `UPDATE` behavior.

## Final rule

If a comment merely repeats the code, improve the code instead. If removing the comment would hide an important reason, constraint, assumption, or trade-off, keep the comment.
