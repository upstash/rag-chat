import { test, expect } from "bun:test";

const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

test(
  "the server is running",
  async () => {
    const res = await fetch(deploymentURL);

    expect(res.status).toEqual(200);

    const text = await res.text();

    console.log("Server returned >", text, "<");
  },
  {
    timeout: 20_000,
  }
);
