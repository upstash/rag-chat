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
  private config: Pick<DatasWithFileSource, "dataType" | "fileSource">;

  constructor(config: Pick<DatasWithFileSource, "dataType" | "fileSource">) {
    this.config = config;
  }

  async loadFile(args: any) {
    const loader = this.createLoader(args);
    const documents = await loader.load();

    return (args: any) => this.transformDocument(documents, args);
  }

  private createLoader(args: any) {
    switch (this.config.dataType) {
      case "pdf": {
        return new PDFLoader(
          this.config.fileSource,
          args satisfies Extract<DatasWithFileSource, { dataType: "pdf" }>
        );
      }

      case "csv": {
        return new CSVLoader(
          this.config.fileSource,
          args satisfies Extract<DatasWithFileSource, { dataType: "csv" }>
        );
      }

      case "text-file": {
        return new TextLoader(this.config.fileSource);
      }

      case "html": {
        return this.isURL(this.config.fileSource)
          ? new CheerioWebBaseLoader(this.config.fileSource)
          : new TextLoader(this.config.fileSource);
      }

      default: {
        throw new Error(`Unsupported data type: ${this.config.dataType}`);
      }
    }
  }

  private isURL(source: FilePath | Blob): source is URL {
    return typeof source === "string" && source.startsWith("http");
  }

  private async transformDocument(documents: Document[], args: any) {
    switch (this.config.dataType) {
      case "pdf": {
        const splitter = new RecursiveCharacterTextSplitter(args);
        const splittedDocuments = await splitter.splitDocuments(documents);

        return mapDocumentsIntoInsertPayload(splittedDocuments);
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
        throw new Error(`Unsupported data type: ${this.config.dataType}`);
      }
    }

    function mapDocumentsIntoInsertPayload(splittedDocuments: Document[]) {
      return splittedDocuments.map((document) => ({
        data: document.pageContent,
        id: nanoid(),
      }));
    }
  }
}
