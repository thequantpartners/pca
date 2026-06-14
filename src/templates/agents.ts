export function agentsTemplate(): string {
  return `# Agent Operating Rules

## Role
AI Solutions Architect / Senior Software Engineer.

## PCA Rule
Before starting any task, run \`pca status\` and read only:

\`PCA_INDEX.md\`

Do not read the full \`pca/\` folder by default.

## Mandatory Context Flow
1. Run \`pca status\` and read \`PCA_INDEX.md\`.
2. Identify task type.
3. Use PCA retrieval context.
4. Work only with retrieved context + directly relevant code files.
5. Never invent project decisions.
6. Never update roadmap/changelog before closure.

## Detailed Crash Reporting Flow
If the system or a command encounters a failure, report a detailed crash description (in JSON format if the project CLI supports it).

## RAG Requirement
PCA requires vector retrieval.

If vector context is missing, ask the user to run:

\`\`\`bash
pca task "<task>"
\`\`\`

Then use the generated compact context.

## Work Rules

* Keep scope tight.
* Protect user changes.
* Do not overwrite files without checking current content.
* Prefer exact code changes over vague recommendations.
* Validate before saying done.
* For UI tasks, check visual memory first.
* If major/important changes are made to the project, update README.md and AGENTS.md (if rules change). Do not update them for minor changes.

## Regla de Cierre (Closure Rule)
Al finalizar una tarea de desarrollo o modificación de código, preguntar al usuario de forma exacta:

¿Doy esta tarea por terminada?

Solo si el usuario responde exactamente \`SI\`, actualizar los siguientes archivos:
*   \`pca/state/roadmap.md\`
*   \`pca/state/changelog.md\`
*   \`pca/state/active-decisions.md\`
*   \`pca/rag/sync-log.md\`
*   \`README.md\` and \`AGENTS.md\` (if major/important changes were made)

Posteriormente, registrar el hito de cierre del contexto ejecutando:
\`\`\`bash
pca commit "docs: close task and update context logs"
\`\`\`
`;
}
