import type { WebBaseLoaderParams } from "@langchain/community/document_loaders/web/cheerio";
import type { Index } from "@upstash/vector";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import { DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TOP_K } from "./constants";
import { FileDataLoader } from "./file-loader";
import type { AddContextOptions } from "./types";

export type FilePath = string;
export type URL = string;

export type DatasWithFileSource =
  | {
      type: "pdf";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      config?: Partial<RecursiveCharacterTextSplitterParams>;
      pdfConfig?: { parsedItemSeparator?: string; splitPages?: boolean };
    }
  | {
      type: "csv";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      csvConfig?: { column?: string; separator?: string };
    }
  | {
      type: "text-file";
      fileSource: FilePath | Blob;
      options?: AddContextOptions;
      config?: Partial<RecursiveCharacterTextSplitterParams>;
    }
  | (
      | {
          type: "html";
          source: URL;
          htmlConfig?: WebBaseLoaderParams;
          options?: AddContextOptions;
          config: Partial<RecursiveCharacterTextSplitterParams>;
        }
      | {
          type: "html";
          source: FilePath | Blob;
          options?: AddContextOptions;
          config?: Partial<RecursiveCharacterTextSplitterParams>;
        }
    );

export type AddContextPayload =
  | { type: "text"; data: string; options?: AddContextOptions; id?: string | number }
  | { type: "embedding"; data: number[]; options?: AddContextOptions; id?: string | number }
  | DatasWithFileSource;

export type VectorPayload = {
  question: string;
  similarityThreshold?: number;
  topK?: number;
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
    await this.index.reset({ namespace: options?.namespace });
  }

  async delete({ ids, namespace }: { ids: string[]; namespace?: string }) {
    await this.index.delete(ids, { namespace });
  }

  /**
   * A method that allows you to query the vector database with plain text.
   * It takes care of the text-to-embedding conversion by itself.
   * Additionally, it lets consumers pass various options to tweak the output.
   */
  async retrieve<TMetadata>({
    question,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    topK = DEFAULT_TOP_K,
    namespace,
  }: VectorPayload): Promise<{ data: string; id: string; metadata: TMetadata }[]> {
    const index = this.index;
    const result = await index.query<Record<string, string>>(
      {
        data: question,
        topK,
        includeData: true,
        includeMetadata: true,
      },
      { namespace }
    );
    const allValuesUndefined = result.every((embedding) => embedding.data === undefined);

    if (allValuesUndefined) {
      console.error("There is no answer for this question in the provided context.");

      return [
        {
          data: "There is no answer for this question in the provided context.",
          id: "error",
          metadata: {} as TMetadata,
        },
      ];
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map((embedding) => ({
        data: embedding.data ?? "",
        id: embedding.id.toString(),
        metadata: embedding.metadata as TMetadata,
      }));

    return facts;
  }

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, HTML, Text file and CSV. Additionally, it handles text-splitting for CSV, PDF and Text file.
   */
  async save(input: AddContextPayload): Promise<SaveOperationResult> {
    const { namespace } = input.options ?? {};
    if (input.type === "text") {
      try {
        const vectorId = await this.index.upsert(
          {
            data: input.data,
            id: input.id ?? nanoid(),
            metadata: input.options?.metadata,
          },
          { namespace }
        );

        return { success: true, ids: [vectorId.toString()] };
      } catch (error) {
        return { success: false, error: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
      }
    } else if (input.type === "embedding") {
      try {
        const vectorId = await this.index.upsert(
          {
            vector: input.data,
            id: input.id ?? nanoid(),
            metadata: input.options?.metadata,
          },
          { namespace }
        );

        return { success: true, ids: [vectorId.toString()] };
      } catch (error) {
        return { success: false, error: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
      }
    } else {
      try {
        const fileArgs =
          "pdfOpts" in input ? input.pdfOpts : "csvOpts" in input ? input.csvOpts : {};

        const transformOrSplit = await new FileDataLoader(input).loadFile(fileArgs);

        const transformArgs = "config" in input ? input.config : {};
        const transformDocuments = await transformOrSplit(transformArgs);

        await this.index.upsert(transformDocuments, { namespace });

        return { success: true, ids: transformDocuments.map((document) => document.id) };
      } catch (error) {
        console.error(error);
        return { success: false, error: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
      }
    }
  }
}
