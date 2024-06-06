import type { WebBaseLoaderParams } from "@langchain/community/document_loaders/web/cheerio";
import type { Index } from "@upstash/vector";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import { DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_METADATA_KEY, DEFAULT_TOP_K } from "./constants";
import { FileDataLoader } from "./file-loader";
import { formatFacts } from "./utils";

export type IndexUpsertPayload = { input: number[]; id?: string | number; metadata?: string };
export type FilePath = string;
export type URL = string;

export type DatasWithFileSource =
  | {
      dataType: "pdf";
      fileSource: FilePath | Blob;
      opts?: Partial<RecursiveCharacterTextSplitterParams>;
      pdfOpts?: { parsedItemSeparator?: string; splitPages?: boolean };
    }
  | {
      dataType: "csv";
      fileSource: FilePath | Blob;
      csvOpts?: { column?: string; separator?: string };
    }
  | {
      dataType: "text-file";
      fileSource: FilePath | Blob;
      opts?: Partial<RecursiveCharacterTextSplitterParams>;
    }
  | (
      | {
          dataType: "html";
          fileSource: URL;
          htmlOpts?: WebBaseLoaderParams;
          opts: Partial<RecursiveCharacterTextSplitterParams>;
        }
      | {
          dataType: "html";
          fileSource: FilePath | Blob;
          opts?: Partial<RecursiveCharacterTextSplitterParams>;
        }
    );

export type AddContextPayload =
  | string
  | { dataType: "text"; data: string; id?: string | number }
  | { dataType: "embedding"; data: IndexUpsertPayload[] }
  | DatasWithFileSource;

export type AddContextOptions = {
  metadataKey?: string;
};

export type VectorPayload = {
  question: string;
  similarityThreshold: number;
  metadataKey: string;
  topK: number;
};

export class Database {
  private index: Index;
  constructor(index: Index) {
    this.index = index;
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
  }: VectorPayload): Promise<string> {
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
  async save(input: AddContextPayload, options?: AddContextOptions): Promise<string | undefined> {
    const { metadataKey = "text" } = options ?? {};

    if (typeof input === "string") {
      return this.index.upsert({
        data: input,
        id: nanoid(),
        metadata: { [metadataKey]: input },
      });
    }

    if (input.dataType === "text") {
      return this.index.upsert({
        data: input.data,
        id: input.id ?? nanoid(),
        metadata: { [metadataKey]: input.data },
      });
    } else if (input.dataType === "embedding") {
      const items = input.data.map((context) => {
        return {
          vector: context.input,
          id: context.id ?? nanoid(),
          metadata: { [metadataKey]: context.metadata },
        };
      });

      return this.index.upsert(items);
    } else {
      const fileArgs = "pdfOpts" in input ? input.pdfOpts : "csvOpts" in input ? input.csvOpts : {};
      const transformOrSplit = await new FileDataLoader(input, metadataKey).loadFile(fileArgs);

      const transformArgs = "opts" in input ? input.opts : {};
      const transformDocuments = await transformOrSplit(transformArgs);
      await this.index.upsert(transformDocuments);
    }
  }
}
