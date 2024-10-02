import { test, expect } from "bun:test";

const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

test("the server is running", async () => {
  const res = await fetch(deploymentURL);
  if (res.status !== 200) {
    console.log(await res.text());
  }
  expect(res.status).toEqual(200);
});

test("/chat endpoint returning", async () => {
  const res = await fetch(`${deploymentURL}/chat`);

  expect(res.status).toEqual(200);

  const text = await res.text();

  console.log("/chat returned >", text, "<");
});
