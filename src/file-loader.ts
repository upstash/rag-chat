/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import type { Document } from "@langchain/core/documents";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import type { DatasWithFileSource, FilePath, URL } from "./database";

export class FileDataLoader {
  private config: DatasWithFileSource;

  constructor(config: DatasWithFileSource) {
    this.config = config;
  }

  async loadFile(args: any) {
    const loader = this.createLoader(args);
    const documents = await loader.load();

    return (args: any) => this.transformDocument(documents, args);
  }

  private createLoader(args: any) {
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
        // @ts-expect-error config type is set as never
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
