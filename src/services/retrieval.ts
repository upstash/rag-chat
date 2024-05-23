import { nanoid } from "nanoid";
import { DEFAULT_METADATA_KEY, DEFAULT_SIMILARITY_THRESHOLD, DEFAULT_TOP_K } from "../constants";
import { formatFacts } from "../utils";
import type { Index } from "@upstash/vector";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import type { WebBaseLoaderParams } from "@langchain/community/document_loaders/web/cheerio";

type IndexUpsertPayload = { input: number[]; id?: string | number; metadata?: string };
type FilePath = string;
type URL = string;

export type AddContextPayload =
  | { dataType: "text"; data: string; id?: string | number }
  | { dataType: "embedding"; data: IndexUpsertPayload[] }
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

export type AddContextOptions = {
  metadataKey?: string;
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

  /**
   * A method that allows you to query the vector database with plain text.
   * It takes care of the text-to-embedding conversion by itself.
   * Additionally, it lets consumers pass various options to tweak the output.
   */
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

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, and CSV. Additionally, it handles text-splitting for CSV and PDF.
   */
  async addDataToVectorDb(
    input: AddContextPayload,
    options?: AddContextOptions
  ): Promise<string | undefined> {
    const { metadataKey = "text" } = options ?? {};

    switch (input.dataType) {
      case "text": {
        return this.index.upsert({
          data: input.data,
          id: input.id ?? nanoid(),
          metadata: { [metadataKey]: input.data },
        });
      }

      case "embedding": {
        const items = input.data.map((context) => {
          return {
            vector: context.input,
            id: context.id ?? nanoid(),
            metadata: { [metadataKey]: context.metadata },
          };
        });

        return this.index.upsert(items);
      }

      case "pdf": {
        const { parsedItemSeparator, splitPages } = input.pdfOpts ?? {};

        const loader = new PDFLoader(input.fileSource, { parsedItemSeparator, splitPages });
        const documents = await loader.load();

        // Users will be able to pass options like chunkSize,chunkOverlap when calling addContext from RAGChat instance directly.
        const splitter = new RecursiveCharacterTextSplitter(input.opts);

        const splittedDocuments = await splitter.splitDocuments(documents);
        const formattedDocuments = splittedDocuments.map((document) => ({
          data: document.pageContent,
          metadata: { [metadataKey]: document.pageContent },
          id: nanoid(),
        }));

        return this.index.upsert(formattedDocuments);
      }

      case "csv": {
        const { column, separator } = input.csvOpts ?? {};

        const loader = new CSVLoader(input.fileSource, { column, separator });
        const documents = await loader.load();
        const formattedDocuments = documents.map((document) => ({
          data: document.pageContent,
          id: nanoid(),
          metadata: { [metadataKey]: document.pageContent },
        }));
        return this.index.upsert(formattedDocuments);
      }

      case "text-file": {
        const loader = new TextLoader(input.fileSource);
        const documents = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter(input.opts);

        const splittedDocuments = await splitter.splitDocuments(documents);
        const formattedDocuments = splittedDocuments.map((document) => ({
          data: document.pageContent,
          metadata: { [metadataKey]: document.pageContent },
          id: nanoid(),
        }));

        return this.index.upsert(formattedDocuments);
      }

      case "html": {
        const loader = new TextLoader(input.fileSource);
        const documents = await loader.load();
        const splitter = RecursiveCharacterTextSplitter.fromLanguage("html", input.opts ?? {});

        const transformer = new HtmlToTextTransformer();
        //@ts-expect-error langchain type issue
        const sequence = splitter.pipe(transformer);

        const newDocuments = await sequence.invoke(documents);

        // eslint-disable-next-line no-console
        console.log(newDocuments);
      }
    }
  }
}
