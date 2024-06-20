"use server";

export const testServer = async (function_: () => Promise<ReadableStream | null>) => {
  "use server";

  const idk = function_();

  return idk;
};
