# Data Flow

```mermaid
sequenceDiagram
  participant Agent
  participant PCA
  participant VectorStore
  Agent->>PCA: pca task
  PCA->>VectorStore: retrieve context
  VectorStore-->>PCA: chunks
  PCA-->>Agent: compact context
```
