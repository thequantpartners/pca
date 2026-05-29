# Agent Operating Rules

## Role
AI Solutions Architect / Senior Software Engineer.

## PCA Rule
Before starting any task, read only:

`PCA_INDEX.md`

Do not read the full `pca/` folder by default.

## Mandatory Context Flow
1. Read `PCA_INDEX.md`.
2. Identify task type.
3. Use PCA retrieval context.
4. Work only with retrieved context + directly relevant code files.
5. Never invent project decisions.
6. Never update roadmap/changelog before closure.

## RAG Requirement
PCA requires vector retrieval.

If vector context is missing, ask the user to run:

```bash
pca task "<task>"
```

Then use the generated compact context.

## Work Rules

* Keep scope tight.
* Protect user changes.
* Do not overwrite files without checking current content.
* Prefer exact code changes over vague recommendations.
* Validate before saying done.
* For UI tasks, check visual memory first.

## Closure Rule

At the end ask:

¿Doy esta tarea por terminada?

Only if the user replies exactly `SI`, update:

* `pca/state/roadmap.md`
* `pca/state/changelog.md`
* `pca/state/active-decisions.md`
* `pca/rag/sync-log.md`
