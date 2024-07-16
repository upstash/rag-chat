import type { WebBaseLoaderParams } from "@langchain/community/document_loaders/web/cheerio";
import type { Index } from "@upstash/vector";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import { DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TOP_K } from "./constants";
import { FileDataLoader } from "./file-loader";
import type { AddContextOptions } from "./types";

export type IndexUpsertPayload = { input: number[]; id?: string | number; metadata?: string };
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
  | { type: "embedding"; options?: AddContextOptions; data: IndexUpsertPayload[] }
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
  async retrieve({
    question,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    topK = DEFAULT_TOP_K,
    namespace,
  }: VectorPayload): Promise<{ data: string; id: string }[]> {
    const index = this.index;
    const result = await index.query<Record<string, string>>(
      {
        data: question,
        topK,
        includeData: true,
      },
      { namespace }
    );
    const allValuesUndefined = result.every((embedding) => embedding.data === undefined);

    if (allValuesUndefined) {
      console.error("There is no answer for this question in the provided context.");

      return [
        { data: " There is no answer for this question in the provided context.", id: "error" },
      ];
    }

    const facts = result
      .filter((x) => x.score >= similarityThreshold)
      .map((embedding) => ({ data: `- ${embedding.data ?? ""}`, id: embedding.id.toString() }));

    return facts;
  }

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, HTML, Text file and CSV. Additionally, it handles text-splitting for CSV, PDF and Text file.
   */
  async save(input: AddContextPayload, options?: AddContextOptions): Promise<SaveOperationResult> {
    const { namespace } = options ?? {};

    if (input.type === "text") {
      try {
        const vectorId = input.id ?? nanoid();

        await this.index.upsert(
          {
            data: input.data,
            id: vectorId.toString(),
          },
          { namespace }
        );

        return { success: true, ids: [vectorId.toString()] };
      } catch (error) {
        return { success: false, error: JSON.stringify(error) };
      }
    } else if (input.type === "embedding") {
      const items = input.data.map((context) => {
        return {
          vector: context.input,
          id: context.id ?? nanoid(),
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

        const transformOrSplit = await new FileDataLoader(input).loadFile(fileArgs);

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
