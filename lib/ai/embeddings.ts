/**
 * Embedding / RAG seam. Structured incentive records are used first.
 * Enable pgvector + embeddings later without changing the analysis pipeline.
 */
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export class NoopEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}

export const embeddings: EmbeddingProvider = new NoopEmbeddingProvider();
