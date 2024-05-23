/* eslint-disable @typescript-eslint/no-magic-numbers */
import type { Index } from "@upstash/vector";
import { sleep } from "bun";

export const awaitUntilIndexed = async (client: Index, timeoutMillis = 10_000) => {
  const start = performance.now();

  const getInfo = async () => {
    return await client.info();
  };

  do {
    const info = await getInfo();
    if (info.pendingVectorCount === 0) {
      // OK, nothing more to index.
      return;
    }

    // Not indexed yet, sleep a bit and check again if the timeout is not passed.
    await sleep(1000);
  } while (performance.now() < start + timeoutMillis);

  throw new Error(`Indexing is not completed in ${timeoutMillis} ms.`);
};
