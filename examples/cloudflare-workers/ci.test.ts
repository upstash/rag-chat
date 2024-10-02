import { test, expect } from "bun:test";

const url = `http://localhost:8787`;

test("the server is running", async () => {
  const res = await fetch(url);
  if (res.status !== 200) {
    console.log(await res.text());
  }
  expect(res.status).toEqual(200);
});

test("/chat endpoint returning", async () => {
  const res = await fetch(`${url}/chat`);

  expect(res.status).toEqual(200);

  const text = await res.text();

  console.log("/chat returned", text);
});
