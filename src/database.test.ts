/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "./database";
import { Index } from "@upstash/vector";
import { awaitUntilIndexed } from "./test-utils";

describe("Database", () => {
  const vector = new Index({
    url: "https://hot-beagle-88683-us1-vector.upstash.io",
    token:
      "ABQFMGhvdC1iZWFnbGUtODg2ODMtdXMxYWRtaW5aREEwTURGalpUa3RNV1l3TmkwME4yWmxMVGszTm1JdE9UQTRaREF3WWpjNFpUQXc=",
  });

  afterAll(async () => await vector.reset());

  test("should save and retrieve info using data field ", async () => {
    const database = new Database(vector);
    await database.save({
      dataType: "text",
      data: "Paris, the capital of France, is renowned for its iconic landmark, the Eiffel Tower, which was completed in 1889 and stands at 330 meters tall.",
    });
    await database.save({
      dataType: "text",
      data: "The city is home to numerous world-class museums, including the Louvre Museum, housing famous works such as the Mona Lisa and Venus de Milo.",
    });
    await database.save({
      dataType: "text",
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
    expect(result).toContain("330");
  });
});
