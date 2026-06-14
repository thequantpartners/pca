export function pcaIndexTemplate(projectName: string): string {
  return `# PCA Index — ${projectName}

## Project Metadata
- Name: ${projectName}
- Type: [unknown]
- Stage: greenfield
- Active Objective: [Define active objective]

## Critical Runtime Rules
- Do not read the entire \`pca/\` folder by default.
- Canonical markdown files are the source of truth.
- Vector memory is the mandatory access layer.
- The agent must retrieve only task-relevant context before acting.

## Required Entry Flow
1. Run \`pca status\` and read this file (\`PCA_INDEX.md\`) first.
2. Classify the task type.
3. Use PCA retrieval context.
4. Work only with retrieved context.
5. Update memory only after confirmed completion.

## Core File Mapping
- **Core Context**: \`pca/core/\` (e.g., project-brief.md, product-context.md, architecture.md, stack.md)
- **Project State**: \`pca/state/\` (e.g., roadmap.md, changelog.md, active-decisions.md)
- **Visual Memory**: \`pca/visual/\` (e.g., screenshots/, mockups/)
- **RAG Configuration**: \`pca/rag/\` (e.g., sync-log.md)

## Retrieval Limits
- Simple task: 3 chunks
- Normal task: 5 chunks
- Architecture task: 8 chunks
- Audit task: 10 chunks
- Visual task: 3 text chunks + 3 visual references

## Closure Policy
Only after explicit user confirmation with \`SI\`:
1. Update roadmap (\`pca/state/roadmap.md\`)
2. Update changelog (\`pca/state/changelog.md\`)
3. Update active decisions (\`pca/state/active-decisions.md\`) if needed
4. Sync changed files to vector memory (\`pca/rag/sync-log.md\`)
5. Update \`README.md\` and \`AGENTS.md\` (if major/important changes were made)
`;
}
