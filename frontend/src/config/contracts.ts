// ERC-8004 Testnet (Celo Alfajores / Sepolia)
export const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const REPUTATION_REGISTRY_ADDRESS = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;

// Mainnet addresses (for reference / production switch)
// export const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
// export const REPUTATION_REGISTRY_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;

export const identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string", internalType: "string" }],
    outputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "register",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "newURI", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isAuthorizedOrOwner",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "agentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export const reputationRegistryAbi = [
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "value", type: "int128", internalType: "int128" },
      { name: "valueDecimals", type: "uint8", internalType: "uint8" },
      { name: "tag1", type: "string", internalType: "string" },
      { name: "tag2", type: "string", internalType: "string" },
      { name: "endpoint", type: "string", internalType: "string" },
      { name: "feedbackURI", type: "string", internalType: "string" },
      { name: "feedbackHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "clientAddresses", type: "address[]", internalType: "address[]" },
      { name: "tag1", type: "string", internalType: "string" },
      { name: "tag2", type: "string", internalType: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64", internalType: "uint64" },
      { name: "summaryValue", type: "int128", internalType: "int128" },
      { name: "summaryValueDecimals", type: "uint8", internalType: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "readAllFeedback",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "clientAddresses", type: "address[]", internalType: "address[]" },
      { name: "tag1", type: "string", internalType: "string" },
      { name: "tag2", type: "string", internalType: "string" },
      { name: "includeRevoked", type: "bool", internalType: "bool" },
    ],
    outputs: [
      { name: "clients", type: "address[]", internalType: "address[]" },
      { name: "feedbackIndexes", type: "uint64[]", internalType: "uint64[]" },
      { name: "values", type: "int128[]", internalType: "int128[]" },
      { name: "valueDecimals", type: "uint8[]", internalType: "uint8[]" },
      { name: "tag1s", type: "string[]", internalType: "string[]" },
      { name: "tag2s", type: "string[]", internalType: "string[]" },
      { name: "revokedStatuses", type: "bool[]", internalType: "bool[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClients",
    inputs: [{ name: "agentId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastIndex",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "clientAddress", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
] as const;
