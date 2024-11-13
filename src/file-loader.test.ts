/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "vitest";
import { FileDataLoader } from "./file-loader";
import type { DatasWithFileSource } from "./database";

describe("FileDataLoader Integration Tests", () => {
  describe("PDF Loading", () => {
    it("should load and transform Wizard of Oz PDF", async () => {
      const config: DatasWithFileSource = {
        type: "pdf",
        fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
        options: {
          metadata: {
            book: "The Wonderful Wizard of Oz",
            type: "classic literature",
          },
        },
      };

      const loader = new FileDataLoader(config);
      const loadFunction = await loader.loadFile({});
      const result = await loadFunction({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(
        expect.objectContaining({
          data: expect.any(String),
          id: expect.any(String),
          metadata: expect.objectContaining({
            book: "The Wonderful Wizard of Oz",
            type: "classic literature",
            source: expect.stringContaining("the_wonderful_wizard_of_oz.pdf"),
            timestamp: expect.any(String),
            paragraphNumber: expect.any(Number),
          }),
        })
      );

      const allContent = result.map((document) => document.data).join(" ");
      expect(allContent).toContain("Dorothy");
    });
  });

  describe("CSV Loading", () => {
    it("should load and transform user info CSV", async () => {
      const config: DatasWithFileSource = {
        type: "csv",
        fileSource: "./data/list_of_user_info.csv",
        options: {
          metadata: {
            dataType: "user_info",
            version: "1.0",
          },
        },
      };

      const loader = new FileDataLoader(config);
      const loadFunction = await loader.loadFile({});
      const result = await loadFunction({});

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(
        expect.objectContaining({
          data: expect.any(String),
          id: expect.any(String),
          metadata: expect.objectContaining({
            dataType: "user_info",
            version: "1.0",
          }),
        })
      );

      for (const document of result) {
        expect(document.data).toBeTruthy();
        expect(typeof document.data).toBe("string");
      }
    });
  });

  describe("Text File Loading", () => {
    it("should load and transform Wizard of Oz summary text", async () => {
      const chunkSize = 500;
      const chunkOverlap = 50;
      const config: DatasWithFileSource = {
        type: "text-file",
        fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
        options: {
          metadata: {
            contentType: "summary",
            subject: "The Wonderful Wizard of Oz",
          },
        },
      };

      const loader = new FileDataLoader(config);
      const loadFunction = await loader.loadFile({});
      const result = await loadFunction({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(
        expect.objectContaining({
          data: expect.any(String),
          id: expect.any(String),
          metadata: expect.objectContaining({
            contentType: "summary",
            subject: "The Wonderful Wizard of Oz",
          }),
        })
      );

      for (const document of result) {
        expect(document.data.length).toBeLessThanOrEqual(chunkSize + chunkOverlap);
      }
    });
  });

  describe("HTML Loading", () => {
    it("should load and transform Wizard of Oz summary HTML", async () => {
      const config: DatasWithFileSource = {
        type: "html",
        source: "./data/the_wonderful_wizard_of_oz_summary.html",
        options: {
          metadata: {
            format: "html",
            subject: "The Wonderful Wizard of Oz Summary",
          },
        },
      };

      const loader = new FileDataLoader(config);
      const loadFunction = await loader.loadFile({});
      const result = await loadFunction({});

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(
        expect.objectContaining({
          data: expect.any(String),
          id: expect.any(String),
          metadata: expect.objectContaining({
            format: "html",
            subject: "The Wonderful Wizard of Oz Summary",
          }),
        })
      );

      const content = result[0].data;
      expect(content).not.toContain("<html>");
      expect(content).not.toContain("<body>");
      expect(content).not.toContain("<");
    });
  });

  describe("Multiple File Types", () => {
    it("should handle loading different formats with consistent metadata", async () => {
      const commonMetadata = {
        project: "Wizard of Oz Analysis",
        timestamp: new Date().toISOString(),
      };

      const configs: DatasWithFileSource[] = [
        {
          type: "pdf",
          fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
          options: { metadata: commonMetadata },
        },
        {
          type: "text-file",
          fileSource: "./data/the_wonderful_wizard_of_oz_summary.txt",
          options: { metadata: commonMetadata },
        },
        {
          type: "html",
          source: "./data/the_wonderful_wizard_of_oz_summary.html",
          options: { metadata: commonMetadata },
        },
      ];

      const results = await Promise.all(
        configs.map(async (config) => {
          const loader = new FileDataLoader(config);
          const loadFunction = await loader.loadFile({});
          return loadFunction({});
        })
      );

      for (const result of results) {
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].metadata).toEqual(expect.objectContaining(commonMetadata));
      }

      const [pdfContent, txtContent, htmlContent] = results.map((r) =>
        r.map((document) => document.data).join(" ")
      );

      expect(pdfContent).toContain("Dorothy");
      expect(txtContent).toContain("Dorothy");
      expect(htmlContent).toContain("Dorothy");
    });
  });

  describe("FileDataLoader Error Handling", () => {
    describe("Missing Files", () => {
      it("should handle non-existent files", async () => {
        const config: DatasWithFileSource = {
          type: "pdf",
          fileSource: "./data/does_not_exist.pdf",
        };

        const loader = new FileDataLoader(config);
        await expect(loader.loadFile({})).rejects.toThrow(/no such file/i);
      });
    });

    describe("Invalid Configurations", () => {
      it("should error with invalid file type", async () => {
        const config: DatasWithFileSource = {
          type: "invalid" as any,
          fileSource: "./data/some_file.txt",
        };

        const loader = new FileDataLoader(config);
        await expect(loader.loadFile({})).rejects.toThrow(/unsupported data type/i);
      });

      it("should error with missing required options for processors", async () => {
        const config: DatasWithFileSource = {
          fileSource: "test.doc",
          processor: {
            options: {},
          },
        } as any;

        const loader = new FileDataLoader(config);
        await expect(loader.loadFile({})).rejects.toThrow();
      });

      it("should error with invalid file path", async () => {
        const config: DatasWithFileSource = {
          type: "pdf",
          fileSource: "",
        };

        const loader = new FileDataLoader(config);
        await expect(loader.loadFile({})).rejects.toThrow();
      });
    });
  });
});
