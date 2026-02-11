import type { VaultDeposit } from "./types";

const now = Date.now();
const h = (hours: number) => now - hours * 60 * 60 * 1000;

export const seedDeposits: VaultDeposit[] = [
  {
    id: "deposit-1",
    depositor: "0x3A29e45dB26b7E4E8FC05a5fC2385c5F0B8c4a91",
    amount: 50,
    sharesIssued: 50,
    sharePriceAtEntry: 1.0,
    txHash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    status: "active",
    timestamp: h(12),
  },
  {
    id: "deposit-2",
    depositor: "0x7B2fE816c33A47b59Af92dCa44b9E2C87d5Fe1b3",
    amount: 25,
    sharesIssued: 24.85,
    sharePriceAtEntry: 1.006,
    txHash: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    status: "active",
    timestamp: h(6),
  },
  {
    id: "deposit-3",
    depositor: "0xE4c8F921Bb4d7a5C1eD0fA23b6E90C4d8F7a2B16",
    amount: 100,
    sharesIssued: 98.81,
    sharePriceAtEntry: 1.012,
    txHash: "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    status: "active",
    timestamp: h(2),
  },
];
