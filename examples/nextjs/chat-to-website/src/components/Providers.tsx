"use client";

import { PropsWithChildren } from "react";
import { NextUIProvider } from "@nextui-org/react";

export const Providers = ({ children }: PropsWithChildren) => {
  return <NextUIProvider>{children}</NextUIProvider>;
};
