import { providers, utils } from "ethers";

import { Mento } from "@mento-protocol/mento-sdk";

async function main() {
  const provider = new providers.JsonRpcProvider(
    "https://alfajores-forno.celo-testnet.org"
  );
  const mento = await Mento.create(provider);

  const celoTokenAddr = "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9";
  const cUSDTokenAddr = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
  const tokenUnits = 18; // both CELO and cUSD have 18 decimal places

  // how much cUSD can I get for 1 CELO?
  const amountIn = utils.parseUnits("1", tokenUnits);
  const quoteAmountOut = await mento.getAmountOut(
    celoTokenAddr,
    cUSDTokenAddr,
    amountIn
  );

  console.log(
    `~${utils.formatUnits(
      quoteAmountOut,
      tokenUnits
    )} cUSD in exchange for 1 CELO`
  );

  // how much cUSD do I need to buy 1 CELO?
  const amountOut = utils.parseUnits("1", tokenUnits);
  const quoteAmountIn = await mento.getAmountIn(
    cUSDTokenAddr,
    celoTokenAddr,
    amountOut
  );

  console.log(
    `~${utils.formatUnits(quoteAmountIn, tokenUnits)} cUSD needed to buy 1 CELO`
  );
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));
