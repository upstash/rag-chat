import type { WebBaseLoaderParams } from "@langchain/community/document_loaders/web/cheerio";
import type { Index } from "@upstash/vector";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import { DEFAULT_METADATA_KEY, DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TOP_K } from "./constants";
import type { AddContextOptions } from "./types";
import { formatFacts } from "./utils";
import { FileDataLoader } from "./file-loader";

export type IndexUpsertPayload = { input: number[]; id?: string | number; metadata?: string };
export type FilePath = string;
export type URL = string;

export type DatasWithFileSource =
  | {
      dataType: "pdf";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      config?: Partial<RecursiveCharacterTextSplitterParams>;
      pdfConfig?: { parsedItemSeparator?: string; splitPages?: boolean };
    }
  | {
      dataType: "csv";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      csvConfig?: { column?: string; separator?: string };
    }
  | {
      dataType: "text-file";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      config?: Partial<RecursiveCharacterTextSplitterParams>;
    }
  | (
      | {
          dataType: "html";
          fileSource: URL;
          htmlConfig?: WebBaseLoaderParams;
          options?: AddContextOptions;
          config: Partial<RecursiveCharacterTextSplitterParams>;
        }
      | {
          dataType: "html";
          fileSource: FilePath | Blob;
          options?: AddContextOptions;
          config?: Partial<RecursiveCharacterTextSplitterParams>;
        }
    );

export type AddContextPayload =
  | { dataType: "text"; data: string; options?: AddContextOptions; id?: string | number }
  | { dataType: "embedding"; options?: AddContextOptions; data: IndexUpsertPayload[] }
  | DatasWithFileSource;

export type VectorPayload = {
  question: string;
  similarityThreshold: number;
  metadataKey: string;
  topK: number;
  namespace?: string;
};

export type ResetOptions = {
  namespace: string;
};

type SaveOperationResult = { success: true; ids: string[] } | { success: false; error: string };

export class Database {
  private index: Index;
  constructor(index: Index) {
    this.index = index;
  }

  async reset(options?: ResetOptions | undefined) {
    await (options?.namespace
      ? this.index.reset({ namespace: options.namespace })
      : this.index.reset());
  }

  async delete(ids: string[]) {
    await this.index.delete(ids);
  }

  /**
   * A method that allows you to query the vector database with plain text.
   * It takes care of the text-to-embedding conversion by itself.
   * Additionally, it lets consumers pass various options to tweak the output.
   */
  async retrieve({
    question,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    metadataKey = DEFAULT_METADATA_KEY,
    topK = DEFAULT_TOP_K,
    namespace,
  }: VectorPayload): Promise<string> {
    const index = this.index;
    const result = await index.query<Record<string, string>>(
      {
        data: question,
        topK,
        includeMetadata: true,
        includeVectors: false,
      },
      { namespace }
    );

    const allValuesUndefined = result.every(
      (embedding) => embedding.metadata?.[metadataKey] === undefined
    );

    if (allValuesUndefined) {
      throw new TypeError("There is no answer for this question in the provided context.");
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map((embedding) => `- ${embedding.metadata?.[metadataKey] ?? ""}`);
    return formatFacts(facts);
  }

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, HTML, Text file and CSV. Additionally, it handles text-splitting for CSV, PDF and Text file.
   */
  async save(input: AddContextPayload, options?: AddContextOptions): Promise<SaveOperationResult> {
    const { metadataKey = "text", namespace: _rawNamespace } = options ?? {};

    const namespace = `${_rawNamespace}`;

    if (typeof input === "string") {
      try {
        const vectorId = nanoid();

        await this.index.upsert(
          {
            data: input,
            id: vectorId,
            metadata: { [metadataKey]: input },
          },
          { namespace }
        );

        return { success: true, ids: [vectorId] };
      } catch (error) {
        return { success: false, error: JSON.stringify(error) };
      }
    }

    if (input.dataType === "text") {
      try {
        const vectorId = input.id ?? nanoid();

        await this.index.upsert(
          {
            data: input.data,
            id: vectorId.toString(),
            metadata: { [metadataKey]: input.data },
          },
          { namespace }
        );

        return { success: true, ids: [vectorId.toString()] };
      } catch (error) {
        return { success: false, error: JSON.stringify(error) };
      }
    } else if (input.dataType === "embedding") {
      const items = input.data.map((context) => {
        return {
          vector: context.input,
          id: context.id ?? nanoid(),
          metadata: { [metadataKey]: context.metadata },
        };
      });

      try {
        await this.index.upsert(items, { namespace });

        return { success: true, ids: items.map((item) => item.id.toString()) };
      } catch (error) {
        return { success: false, error: JSON.stringify(error) };
      }
    } else {
      try {
        const fileArgs =
          "pdfOpts" in input ? input.pdfOpts : "csvOpts" in input ? input.csvOpts : {};
        const transformOrSplit = await new FileDataLoader(input, metadataKey).loadFile(fileArgs);

        const transformArgs = "config" in input ? input.config : {};
        const transformDocuments = await transformOrSplit(transformArgs);
        await this.index.upsert(transformDocuments, { namespace });

        return { success: true, ids: transformDocuments.map((document) => document.id) };
      } catch (error) {
        console.error(error);
        return { success: false, error: JSON.stringify(error) };
      }
    }
  }
}
