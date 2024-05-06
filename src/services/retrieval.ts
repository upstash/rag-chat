import type { Index } from "@upstash/sdk";
import { formatFacts } from "../utils";
import type { RAGChatConfig } from "../types";
import { ClientFactory } from "../client-factory";
import { Config } from "../config";

const SIMILARITY_THRESHOLD = 0.5;
const TOP_K = 5;

type RetrievalInit = Omit<RAGChatConfig, "model" | "template" | "vector"> & {
  email: string;
  token: string;
};

export type RetrievePayload = {
  question: string;
  similarityThreshold?: number;
  topK?: number;
};

export class RetrievalService {
  private index: Index;
  constructor(index: Index) {
    this.index = index;
  }

  async retrieveFromVectorDb({
    question,
    similarityThreshold = SIMILARITY_THRESHOLD,
    topK = TOP_K,
  }: RetrievePayload): Promise<string> {
    const index = this.index;
    const result = await index.query<{ value: string }>({
      data: question,
      topK,
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

  public static async init(config: RetrievalInit) {
    const clientFactory = new ClientFactory(
      new Config(config.email, config.token, {
        redis: config.redis,
        region: config.region,
      })
    );
    const { vector } = await clientFactory.init({ vector: true });
    return new RetrievalService(vector);
  }
}
