import { http, createStorage, cookieStorage } from "wagmi";
import { celo } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { siteConfig } from "./site";

export const config = getDefaultConfig({
  appName: siteConfig.name,
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [celo],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [celo.id]: http(),
  },
});
