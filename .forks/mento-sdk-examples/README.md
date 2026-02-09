# mento-sdk-examples

A set of runnable example code snippets for using the [Mento Protocol SDK](https://www.npmjs.com/package/@mento-protocol/mento-sdk).

## Installation and usage

```sh
# clone the repo
git clone https://github.com/mento-protocol/mento-sdk-examples.git

# cd into the directory
cd mento-sdk-examples

# install all dependencies
yarn

# Set up environment variables:
cp .env.example .env
# Add your private key to the .env file:

# run the example snippets
yarn ts-node src/discovery.ts
yarn ts-node src/quotes.ts
yarn ts-node src/swap.ts
yarn ts-node src/routerSwap.ts
```
