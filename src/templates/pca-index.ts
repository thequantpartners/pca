export function pcaIndexTemplate(projectName: string): string {
  return `# PCA Index

## Project
Name: ${projectName}
Type: [unknown]
Stage: greenfield

## Active Objective
[Define current objective]

## Critical Runtime Rule
Do not read the entire PCA folder by default.

Canonical markdown files are the source of truth.
Vector memory is the mandatory access layer.
The agent must retrieve only task-relevant context before acting.

## Required Entry Flow
1. Read this file only.
2. Classify the task.
3. Use PCA retrieval.
4. Work with retrieved context.
5. Update memory only after confirmed completion.

## Core Files
- \`pca/core/project-brief.md\`
- \`pca/core/product-context.md\`
- \`pca/core/architecture.md\`
- \`pca/core/stack.md\`
- \`pca/state/active-task.md\`
- \`pca/state/roadmap.md\`
- \`pca/state/changelog.md\`
- \`pca/state/active-decisions.md\`
- \`pca/visual/visual-index.md\`

## Retrieval Limits
- Simple task: 3 chunks
- Normal task: 5 chunks
- Architecture task: 8 chunks
- Audit task: 10 chunks
- Visual task: 3 text chunks + 3 visual references

## Closure Policy
Only after explicit user confirmation with \`SI\`:
1. update roadmap
2. update changelog
3. update active decisions if needed
4. update ADR/PRD if needed
5. sync changed files to vector memory
`;
}
