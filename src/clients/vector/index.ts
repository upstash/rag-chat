import type { CreateIndexPayload, Upstash } from "@upstash/sdk";
import { Index } from "@upstash/sdk";

import type { PreferredRegions } from "../../types";
import { InternalUpstashError } from "../../error/internal";

export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";

export const DEFAULT_VECTOR_CONFIG: CreateIndexPayload = {
  name: DEFAULT_VECTOR_DB_NAME,
  similarity_function: "EUCLIDEAN",
  embedding_model: "MXBAI_EMBED_LARGE_V1",
  region: "us-east-1",
  type: "payg",
};

type Config = {
  sdkClient: Upstash;
  indexNameOrInstance?: string | Index;
  preferredRegion?: PreferredRegions;
};

export class VectorClientConstructor {
  private indexNameOrInstance?: string | Index;
  private preferredRegion?: PreferredRegions;
  private sdkClient: Upstash;
  private vectorClient?: Index;

  constructor({ sdkClient, preferredRegion, indexNameOrInstance: indexNameOrInstance }: Config) {
    this.indexNameOrInstance = indexNameOrInstance;
    this.sdkClient = sdkClient;
    this.preferredRegion = preferredRegion ?? "us-east-1";
  }

  public async getVectorClient(): Promise<Index | undefined> {
    if (!this.vectorClient) {
      try {
        await this.initializeVectorClient();
      } catch (error) {
        console.error("Failed to initialize Vector client:", error);
        return undefined;
      }
    }
    return this.vectorClient;
  }

  private initializeVectorClient = async () => {
    const { indexNameOrInstance } = this;

    // Direct Vector instance provided
    if (indexNameOrInstance instanceof Index) {
      this.vectorClient = indexNameOrInstance;
      return;
    }

    // Vector name provided
    if (typeof indexNameOrInstance === "string") {
      await this.createVectorClientByName(indexNameOrInstance);
      return;
    }

    // No specific Vector information provided, using default configuration
    await this.createVectorClientByDefaultConfig();
  };

  private createVectorClientByName = async (indexName: string) => {
    try {
      const index = await this.sdkClient.getVectorIndexByName(indexName);
      if (!index) throw new InternalUpstashError("Index is missing!");

      this.vectorClient = await this.sdkClient.newVectorClient(index.name);
    } catch {
      await this.createVectorClientByDefaultConfig(indexName);
    }
  };

  private createVectorClientByDefaultConfig = async (indexName?: string) => {
    const index = await this.sdkClient.getOrCreateIndex({
      ...DEFAULT_VECTOR_CONFIG,
      name: indexName ?? DEFAULT_VECTOR_CONFIG.name,
      region: this.preferredRegion ?? DEFAULT_VECTOR_CONFIG.region,
    });

    if (index?.name) {
      const client = await this.sdkClient.newVectorClient(index.name);
      this.vectorClient = client;
    }
  };
}
