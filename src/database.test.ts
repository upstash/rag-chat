import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "./database";
import { Index } from "@upstash/vector";
import { awaitUntilIndexed } from "./test-utils";

const nanoidLength = 21;

describe("Database", () => {
  const vector = new Index();

  afterAll(async () => await vector.reset());

  test("should save and retrieve info using data field ", async () => {
    const database = new Database(vector);
    await database.save({
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });
    await database.save({
      type: "text",
      data: "The city is home to numerous world-class museums, including the Louvre Museum, housing famous works such as the Mona Lisa and Venus de Milo.",
    });
    await database.save({
      type: "text",
      data: "Paris is often called the City of Light due to its significant role during the Age of Enlightenment and its early adoption of street lighting.",
    });
    await awaitUntilIndexed(vector);

    const result = await database.retrieve({
      question:
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
      topK: 1,
      similarityThreshold: 0.5,
      namespace: "",
    });
    expect(result.map(({ data }) => data).join(" ")).toContain("330");
  });

  test("should save and retrieve info using id field", async () => {
    const database = new Database(vector);

    await database.save({
      type: "text",
      id: "eiffel-tower",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });

    await awaitUntilIndexed(vector);

    const result = await database.retrieve({
      question:
        "What year was the construction of the Eiffel Tower completed, and what is its height?",
    });
    // sadly we can't test the id here
    // because the questions are not unique
    // every time we run the test we will add the same question
    // and the id will be different because the database find the similarity
    // we could create a unique namespace for each test
    expect(result[0].data).toContain("1889");
    expect(result[0].data).toContain("330 meters");
  });

  test("should return generated id when saving without providing an id", async () => {
    const database = new Database(vector);

    const saveResult = await database.save({
      type: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower.",
    });

    expect(saveResult.success).toBe(true);
    if (!saveResult.success) {
      throw new Error(`Failed to save entry: ${saveResult.error}`);
    }

    expect(saveResult.success).toBe(true);
    expect(saveResult.ids).toHaveLength(1);
    expect(typeof saveResult.ids[0]).toBe("string");
    expect(saveResult.ids[0]).toBeTruthy();
    expect(saveResult.ids[0]).toHaveLength(nanoidLength);
  });
});
