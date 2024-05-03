import type { Index } from "@upstash/sdk";
import { formatFacts } from "../utils";

const SIMILARITY_THRESHOLD = 0.5;

export class RetrievalService {
  private index: Index;
  constructor(index: Index) {
    this.index = index;
  }

  async retrieveFromVectorDb(
    question: string,
    similarityThreshold = SIMILARITY_THRESHOLD
  ): Promise<string> {
    const index = this.index;
    const result = await index.query<{ value: string }>({
      data: question,
      topK: 5,
      includeMetadata: true,
      includeVectors: false,
    });

    const allValuesUndefined = result.every((embedding) => embedding.metadata?.value === undefined);
    if (allValuesUndefined) {
      throw new TypeError(`
          Query to the vector store returned ${result.length} vectors but none had "value" field in their metadata.
          Text of your vectors should be in the "value" field in the metadata for the RAG Chat.
        `);
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map((embedding, index) => `- Context Item ${index}: ${embedding.metadata?.value ?? ""}`);
    return formatFacts(facts);
  }
}
