import type { Index } from "@upstash/sdk";
import { formatFacts } from "../utils";
import type { RAGChatConfig } from "../types";
import { ClientFactory } from "../client-factory";
import { Config } from "../config";
import { nanoid } from "nanoid";
import { DEFAULT_METADATA_KEY, DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TOP_K } from "../constants";

export type AddContextPayload = { input: string | number[]; id?: string; metadata?: string };

type RetrievalInit = Omit<RAGChatConfig, "model" | "template" | "vector"> & {
  email: string;
  token: string;
};

export type RetrievePayload = {
  question: string;
  similarityThreshold: number;
  metadataKey: string;
  topK: number;
};

export class RetrievalService {
  private index: Index;
  constructor(index: Index) {
    this.index = index;
  }

  async retrieveFromVectorDb({
    question,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    metadataKey = DEFAULT_METADATA_KEY,
    topK = DEFAULT_TOP_K,
  }: RetrievePayload): Promise<string> {
    const index = this.index;
    const result = await index.query<Record<string, string>>({
      data: question,
      topK,
      includeMetadata: true,
      includeVectors: false,
    });

    const allValuesUndefined = result.every(
      (embedding) => embedding.metadata?.[metadataKey] === undefined
    );

    if (allValuesUndefined) {
      throw new TypeError(`
          Query to the vector store returned ${result.length} vectors but none had "${metadataKey}" field in their metadata.
          Text of your vectors should be in the "${metadataKey}" field in the metadata for the RAG Chat.
        `);
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map(
        (embedding, index) => `- Context Item ${index}: ${embedding.metadata?.[metadataKey] ?? ""}`
      );
    return formatFacts(facts);
  }

  async addEmbeddingOrTextToVectorDb(
    input: AddContextPayload[] | string,
    metadataKey = "text"
  ): Promise<string> {
    if (typeof input === "string") {
      return this.index.upsert({
        data: input,
        id: nanoid(),
        metadata: { [metadataKey]: input },
      });
    }
    const items = input.map((context) => {
      const isText = typeof context.input === "string";
      const metadata = context.metadata
        ? { [metadataKey]: context.metadata }
        : isText
          ? { [metadataKey]: context.input }
          : {};

      return {
        [isText ? "data" : "vector"]: context.input,
        id: context.id ?? nanoid(),
        metadata,
      };
    });

    return this.index.upsert(items as Parameters<Index["upsert"]>[number]);
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
