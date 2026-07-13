import { describe, expect, mock, test } from "bun:test";
import { Database } from "./database";

describe("Database.retrieve — empty / missing metadata (#49)", () => {
  test("returns [] when every result has undefined data", async () => {
    const query = mock(() =>
      Promise.resolve([
        { id: "1", score: 0.9, data: undefined, metadata: undefined },
        { id: "2", score: 0.8, data: undefined, metadata: undefined },
        { id: "3", score: 0.7, data: undefined, metadata: undefined },
        { id: "4", score: 0.6, data: undefined, metadata: undefined },
        { id: "5", score: 0.5, data: undefined, metadata: undefined },
      ])
    );

    const database = new Database({ query } as never);
    const result = await database.retrieve({
      question: "unrelated question",
      topK: 5,
      similarityThreshold: 0.5,
      namespace: "",
    });

    expect(result).toEqual([]);
    expect(query).toHaveBeenCalled();
  });

  test("returns [] when the vector index yields no rows", async () => {
    const query = mock(() => Promise.resolve([]));
    const database = new Database({ query } as never);

    const result = await database.retrieve({
      question: "anything",
      topK: 5,
      similarityThreshold: 0.5,
      namespace: "",
    });

    expect(result).toEqual([]);
  });

  test("coerces missing metadata to {} instead of undefined", async () => {
    const query = mock(() =>
      Promise.resolve([
        { id: "1", score: 0.95, data: "Tokyo is the capital of Japan.", metadata: undefined },
        { id: "2", score: 0.9, data: "Kyoto was the former capital.", metadata: { unit: "A" } },
      ])
    );

    const database = new Database({ query } as never);
    const result = await database.retrieve<{ unit?: string }>({
      question: "capital of Japan",
      topK: 5,
      similarityThreshold: 0.5,
      namespace: "",
    });

    expect(result.map(({ id, metadata }) => ({ id, metadata }))).toEqual([
      { id: "1", metadata: {} },
      { id: "2", metadata: { unit: "A" } },
    ]);
  });
});
