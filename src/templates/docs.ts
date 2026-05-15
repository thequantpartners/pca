export function projectReadmeTemplate(projectName: string): string {
  return `# ${projectName}

This repository uses PCA (Persistent Context Architecture).

## Runtime Rule

Do not read the full \`pca/\` folder by default.
Read \`PCA_INDEX.md\`, then use \`pca task "<task>"\` to retrieve compact context.

## Local Commands

\`\`\`bash
pca sync
pca query "project architecture"
pca task "current task"
\`\`\`
`;
}

export const coreDocs: Record<string, string> = {
  "pca/core/project-brief.md": "# Project Brief\n\n[Define the project purpose, audience, and success criteria.]\n",
  "pca/core/product-context.md": "# Product Context\n\n[Describe users, workflows, product constraints, and business context.]\n",
  "pca/core/architecture.md": "# Architecture\n\n[Describe the system architecture and major technical decisions.]\n",
  "pca/core/stack.md": "# Stack\n\n[Document languages, frameworks, services, and runtime requirements.]\n",
  "pca/core/agent-rules.md": "# Agent Rules\n\n- PCA sin RAG no opera.\n- Do not read the full PCA folder by default.\n",
  "pca/state/active-task.md": "# Active Task\n\n[No active task defined.]\n",
  "pca/state/roadmap.md": "# Roadmap\n\n## In Process\n\n- [No task in process]\n\n## Pending\n\n- [Define upcoming work]\n\n## Done\n\n- [Completed work appears here]\n",
  "pca/state/changelog.md": "# Changelog\n\n",
  "pca/state/open-questions.md": "# Open Questions\n\n",
  "pca/state/active-decisions.md": "# Active Decisions\n\n",
  "pca/diagrams/context.md": "# Context Diagram\n\n```mermaid\ngraph TD\n  User[User] --> Project[Project]\n```\n",
  "pca/diagrams/components.md": "# Components Diagram\n\n```mermaid\ngraph TD\n  CLI[PCA CLI] --> OpenAI[OpenAI Vector Store]\n```\n",
  "pca/diagrams/data-flow.md": "# Data Flow\n\n```mermaid\nsequenceDiagram\n  participant Agent\n  participant PCA\n  participant VectorStore\n  Agent->>PCA: pca task\n  PCA->>VectorStore: retrieve context\n  VectorStore-->>PCA: chunks\n  PCA-->>Agent: compact context\n```\n",
  "pca/visual/visual-index.md": "# Visual Index\n\nIn MVP, visual memory stores local images plus textual metadata here. Real multimodal analysis comes in v2.\n\n",
  "pca/visual/brand-style.md": "# Brand Style\n\n[Document visual style, colors, typography, references, and constraints.]\n",
  "pca/rag/retrieval-policy.md": "# Retrieval Policy\n\nPCA sin RAG no opera. Agents must retrieve task-relevant context instead of reading the full `pca/` folder.\n",
  "pca/rag/chunking-policy.md": "# Chunking Policy\n\nUse concise markdown sections with clear headings so vector retrieval can return useful chunks.\n",
  "pca/rag/sync-log.md": "# Sync Log\n\n",
  "pca/rag/ignored-files.md": "# Ignored Files\n\n- node_modules/**\n- dist/**\n- build/**\n- .next/**\n- .git/**\n- .env\n- *.key\n- *.pem\n- logs/**\n",
};
