/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import { Document } from "@langchain/core/documents";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import { UnstructuredClient } from "unstructured-client";
import type { DatasWithFileSource, FilePath, ProcessorType, URL } from "./database";

type Element = {
  type: string;
  text: string;
  // this is purposefully loosely typed
  metadata: Record<string, unknown>;
};

export class FileDataLoader {
  private config: DatasWithFileSource;

  constructor(config: DatasWithFileSource) {
    this.config = config;
  }

  async loadFile(args: any) {
    const loader = this.createLoader(args);
    const _loader = await loader;
    const documents = await _loader.load();

    return (args: any) => this.transformDocument(documents, args);
  }

  private async createLoader(args: any) {
    if (hasProcessor(this.config)) {
      const client = new UnstructuredClient({
        serverURL: "https://api.unstructuredapp.io",
        security: {
          apiKeyAuth: this.config.processor.options.apiKey,
        },
      });

      //@ts-expect-error TS can't pick up the correct type due to complex union
      const fileData = await Bun.file(this.config.fileSource).text();
      const response = await client.general.partition({
        //@ts-expect-error Will be fixed soon
        partitionParameters: {
          files: {
            content: fileData,
            //@ts-expect-error TS can't pick up the correct type due to complex union
            fileName: this.config.fileSource,
          },
          ...this.config.processor.options,
        },
      });
      const elements = response.elements?.filter(
        (element) => typeof element.text === "string"
      ) as Element[];

      return {
        // eslint-disable-next-line @typescript-eslint/require-await
        load: async (): Promise<Document[]> => {
          const documents: Document[] = [];
          for (const element of elements) {
            const { metadata, text } = element;
            if (typeof text === "string" && text !== "") {
              documents.push(
                new Document({
                  pageContent: text,
                  metadata: {
                    ...metadata,
                    category: element.type,
                  },
                })
              );
            }
          }
          return documents;
        },
      };
    }
    switch (this.config.type) {
      case "pdf": {
        return new PDFLoader(
          this.config.fileSource,
          args satisfies Extract<DatasWithFileSource, { type: "pdf" }>
        );
      }

      case "csv": {
        return new CSVLoader(
          this.config.fileSource,
          args satisfies Extract<DatasWithFileSource, { type: "csv" }>
        );
      }

      case "text-file": {
        return new TextLoader(this.config.fileSource);
      }

      case "html": {
        return this.isURL(this.config.source)
          ? new CheerioWebBaseLoader(this.config.source)
          : new TextLoader(this.config.source);
      }

      default: {
        //@ts-expect-error TS can't pick up the correct type due to complex union
        throw new Error(`Unsupported data type: ${this.config.type}`);
      }
    }
  }

  private isURL(source: FilePath | Blob): source is URL {
    return typeof source === "string" && source.startsWith("http");
  }

  private async transformDocument(documents: Document[], args: any) {
    switch (this.config.type) {
      case "pdf": {
        const splitter = new RecursiveCharacterTextSplitter(args);
        const splittedDocuments = await splitter.splitDocuments(documents);

        return mapDocumentsIntoInsertPayload(splittedDocuments, (metadata: any, index: number) => ({
          source: metadata.source,
          timestamp: new Date().toISOString(),
          paragraphNumber: index + 1,
          pageNumber: metadata.loc?.pageNumber || undefined,
          author: metadata.pdf?.info?.Author || undefined,
          title: metadata.pdf?.info?.Title || undefined,
          totalPages: metadata.pdf?.totalPages || undefined,
          language: metadata.pdf?.metadata?._metadata?.["dc:language"] || undefined,
        }));
      }

      case "csv": {
        return mapDocumentsIntoInsertPayload(documents);
      }

      case "text-file": {
        const splitter = new RecursiveCharacterTextSplitter(args);
        const splittedDocuments = await splitter.splitDocuments(documents);
        return mapDocumentsIntoInsertPayload(splittedDocuments);
      }

      case "html": {
        const splitter = RecursiveCharacterTextSplitter.fromLanguage("html", args);

        const transformer = new HtmlToTextTransformer();
        const sequence = splitter.pipe(transformer);

        const newDocuments = await sequence.invoke(documents);

        return mapDocumentsIntoInsertPayload(newDocuments);
      }

      case undefined: {
        const documents_ = documents.map(
          (item) => new Document({ pageContent: item.pageContent, metadata: item.metadata })
        );
        return documents_.map((document) => ({
          data: document.pageContent,
          metadata: document.metadata,
          id: nanoid(),
        }));
      }

      default: {
        // @ts-expect-error config type is set as never
        throw new Error(`Unsupported data type: ${this.config.type}`);
      }
    }

    function mapDocumentsIntoInsertPayload(
      splittedDocuments: Document[],
      metadataMapper?: (metadata: any, index: number) => Record<string, any>
    ) {
      return splittedDocuments.map((document, index) => ({
        data: document.pageContent,
        id: nanoid(),
        ...(metadataMapper ? { metadata: metadataMapper(document.metadata, index) } : {}),
      }));
    }
  }
}

function hasProcessor(
  data: DatasWithFileSource
): data is DatasWithFileSource & { processor: ProcessorType } {
  return "processor" in data && typeof data.processor === "object" && "options" in data.processor;
}
