import { traceable } from "langsmith/traceable";
import { nanoid } from "nanoid";
import type { AddContextPayload, Database, ResetOptions, VectorPayload } from "../database";
import type { ChatLogger } from "../logger";
import type { PrepareChatResult } from "../types";
import { formatFacts, type ModifiedChatOptions } from "../utils";
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
   *   type: "pdf",
   *   fileSource: "./data/the_wonderful_wizard_of_oz.pdf",
   *   opts: { chunkSize: 500, chunkOverlap: 50 },
   * });
   * // OR
   * await addDataToVectorDb({
   *   type: "text",
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

  async addMany(args: AddContextPayload[] | string[]) {
    return Promise.all(args.map((data) => this.add(data)));
  }

  async deleteEntireContext(options?: ResetOptions) {
    await this.#vectorService.reset(
      options?.namespace ? { namespace: options.namespace } : undefined
    );
  }

  async delete({ id, namespace }: { id: string | string[]; namespace?: string }) {
    await this.#vectorService.delete({ ids: typeof id === "string" ? [id] : id, namespace });
  }

  /** This is internal usage only. */
  _getContext<TMetadata extends object>(
    optionsWithDefault: ModifiedChatOptions,
    input: string | number[],
    debug?: ChatLogger
  ) {
    return traceable(
      async (sessionId: string) => {
        // Log the input, which will be captured by the outer traceable
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        await debug?.logSendPrompt(typeof input === "string" ? input : `${input.slice(0, 3)}...`);
        debug?.startRetrieveContext();

        if (optionsWithDefault.disableRAG) return { formattedContext: "", metadata: [] };

        const retrieveContext = traceable(
          async (payload: VectorPayload) => {
            const originalContext = await this.#vectorService.retrieve<TMetadata>(payload);

            const clonedContext = structuredClone(originalContext);
            return (await optionsWithDefault.onContextFetched?.(clonedContext)) ?? originalContext;
          },
          { name: "Step: Fetch", metadata: { sessionId }, run_type: "retriever" }
        );

        const context = await retrieveContext({
          question: input,
          similarityThreshold: optionsWithDefault.similarityThreshold,
          topK: optionsWithDefault.topK,
          namespace: optionsWithDefault.namespace,
          contextFilter: optionsWithDefault.contextFilter,
        });

        // Log the result, which will be captured by the outer traceable
        await debug?.endRetrieveContext(context);

        return {
          formattedContext: await traceable(
            (_context: PrepareChatResult) => formatFacts(_context.map(({ data }) => data)),
            {
              name: "Step: Format",
              metadata: { sessionId },
              run_type: "tool",
            }
          )(context),
          metadata: context.map(({ metadata }) => metadata) as TMetadata[],
          rawContext: context,
        };
      },
      {
        name: "Retrieve Context",
        metadata: {
          sessionId: optionsWithDefault.sessionId,
          namespace: optionsWithDefault.namespace,
        },
      }
    );
  }
}
