import { nanoid } from "nanoid";
import type { AddContextPayload, Database, ResetOptions } from "../database";
import { formatFacts, type ModifiedChatOptions } from "../utils";
import type { ChatLogger } from "../logger";

export class ContextService {
  #vectorService: Database;
  private readonly namespace: string;

  constructor(vectorService: Database, namespace: string) {
    this.#vectorService = vectorService;
    this.namespace = namespace;
  }

  /**
   * A method that allows you to add various data types into a vector database.
   * It supports plain text, embeddings, PDF, and CSV. Additionally, it handles text-splitting for CSV and PDF.
   *
   * @example
   * ```typescript
   * await addDataToVectorDb({
   *   dataType: "pdf",
   *   fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
   *   opts: { chunkSize: 500, chunkOverlap: 50 },
   * });
   * // OR
   * await addDataToVectorDb({
   *   dataType: "text",
   *   data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
   * });
   * ```
   */
  async add(args: AddContextPayload | string) {
    if (typeof args === "string") {
      const result = await this.#vectorService.save({
        type: "text",
        data: args,
        id: nanoid(),
        options: { namespace: this.namespace },
      });
      return result;
    }
    return await this.#vectorService.save(args);
  }

  async deleteEntireContext(options?: ResetOptions | undefined) {
    await this.#vectorService.reset(
      options?.namespace ? { namespace: options.namespace } : undefined
    );
  }

  async delete({ id, namespace }: { id: string | string[]; namespace?: string }) {
    await this.#vectorService.delete({ ids: typeof id === "string" ? [id] : id, namespace });
  }

  async getContext(
    optionsWithDefault: ModifiedChatOptions,
    input: string,
    debug?: ChatLogger
  ): Promise<string> {
    await debug?.logSendPrompt(input);

    debug?.startRetrieveContext();

    if (optionsWithDefault.disableRAG) return "";

    const originalContext = await this.#vectorService.retrieve({
      question: input,
      similarityThreshold: optionsWithDefault.similarityThreshold,
      topK: optionsWithDefault.topK,
      namespace: optionsWithDefault.namespace,
    });

    const clonedContext = structuredClone(originalContext);
    const modifiedContext = await optionsWithDefault.onContextFetched?.(clonedContext);
    await debug?.endRetrieveContext(modifiedContext);

    return formatFacts((modifiedContext ?? originalContext).map(({ data }) => data));
  }
}
