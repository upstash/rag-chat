import { test, expect } from "bun:test";

const url = `http://localhost:8080`;

test(
  "the server is running",
  async () => {
    const res = await fetch(url);

    expect(res.status).toEqual(200);

    const text = await res.text();

    console.log("Server returned >", text, "<");
  },
  {
    timeout: 20_000,
  }
);
