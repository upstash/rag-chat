import { describe, test, expect } from "bun:test";
import { RAGChat } from "./rag-chat";
import { upstash } from "./models";

describe("Model", () => {
  test("should raise error when api key is not found", () => {
    let ran = false;
    const throws = () => {
      try {
        new RAGChat({
          model: upstash("meta-llama/Meta-Llama-3-8B-Instruct", { apiKey: "" }),
        });
      } catch (error) {
        ran = true;
        throw error;
      }
    };
    expect(throws).toThrow(
      "Failed to create upstash LLM client: QSTASH_TOKEN not found." +
        " Pass apiKey parameter or set QSTASH_TOKEN env variable."
    );
    expect(ran).toBeTrue();
  });
});
