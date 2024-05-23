/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  CheerioWebBaseLoader,
  type WebBaseLoaderParams,
} from "@langchain/community/document_loaders/web/cheerio";
import type { RecursiveCharacterTextSplitterParams } from "langchain/text_splitter";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Branded } from "./types";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";

type IndexUpsertPayload = { input: number[]; id?: string | number; metadata?: string };
type FilePath = Branded<string, "FilePath">;
type URL = Branded<string, "URL">;

type DatasWithFileSource =
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
  | { dataType: "text"; data: string; id?: string | number }
  | { dataType: "embedding"; data: IndexUpsertPayload[] }
  | DatasWithFileSource;

export class FileLoader {
  private config: Pick<DatasWithFileSource, "dataType" | "fileSource">;

  constructor(config: Pick<DatasWithFileSource, "dataType" | "fileSource">) {
    this.config = config;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadFile(args: any) {
    const loader = this.createLoader(args);
    return loader.load();
  }
  //TODO: Add transforming methods here

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createLoader(args: any) {
    switch (this.config.dataType) {
      case "pdf": {
        return new PDFLoader(this.config.fileSource, args);
      }
      case "csv": {
        return new CSVLoader(this.config.fileSource, args);
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
  private isURL(source: FilePath | Blob | URL): source is URL {
    return typeof source === "string" && source.startsWith("http");
  }
}
