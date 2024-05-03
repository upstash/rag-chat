import type { CreateIndexPayload, Upstash } from "@upstash/sdk";
import { Index } from "@upstash/sdk";

import type { PreferredRegions } from "../../types";
import { DEFAULT_VECTOR_DB_NAME } from "../../constants";

export const DEFAULT_VECTOR_CONFIG: CreateIndexPayload = {
  name: DEFAULT_VECTOR_DB_NAME,
  similarity_function: "EUCLIDEAN",
  embedding_model: "MXBAI_EMBED_LARGE_V1",
  region: "us-east-1",
  type: "payg",
};

type Config = {
  upstashSDK: Upstash;
  indexNameOrInstance?: string | Index;
  region?: PreferredRegions;
};

export class VectorClient {
  private indexNameOrInstance?: string | Index;
  private region?: PreferredRegions;
  private upstashSDK: Upstash;
  private vectorClient?: Index;

  constructor({ upstashSDK, region, indexNameOrInstance }: Config) {
    this.indexNameOrInstance = indexNameOrInstance;
    this.upstashSDK = upstashSDK;
    this.region = region ?? "us-east-1";
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
      const index = await this.upstashSDK.getVectorIndex(indexName);
      this.vectorClient = await this.upstashSDK.newVectorClient(index.name);
    } catch {
      console.error(`Requested '${indexName}' is missing in Vector list. Creating new one...`);
      await this.createVectorClientByDefaultConfig(indexName);
    }
  };

  private createVectorClientByDefaultConfig = async (indexName?: string) => {
    let index;
    try {
      index = await this.upstashSDK.getOrCreateVectorIndex({
        ...DEFAULT_VECTOR_CONFIG,
        name: indexName ?? DEFAULT_VECTOR_CONFIG.name,
        region: this.region ?? DEFAULT_VECTOR_CONFIG.region,
        type: "free",
      });
    } catch (error) {
      const error_ = error as Error;
      if (error_.message === "free plan is the only available option for free accounts") {
        index = await this.upstashSDK.getOrCreateVectorIndex({
          ...DEFAULT_VECTOR_CONFIG,
          name: indexName ?? DEFAULT_VECTOR_CONFIG.name,
          region: this.region ?? DEFAULT_VECTOR_CONFIG.region,
          type: "payg",
        });
      }
    }

    if (index?.name) {
      const client = await this.upstashSDK.newVectorClient(index.name);
      this.vectorClient = client;
    }
  };
}
