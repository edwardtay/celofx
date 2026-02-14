// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract AgentRegistry {
    address public immutable agent;

    event DecisionCommitted(bytes32 indexed hash, string action, uint256 timestamp);
    event DecisionBatchCommitted(uint256 count, uint256 timestamp);
    event AttestationAnchored(bytes32 indexed hash, string attestationType, uint256 timestamp);

    modifier onlyAgent() {
        require(msg.sender == agent, "not agent");
        _;
    }

    constructor() {
        agent = msg.sender;
    }

    function commitDecision(bytes32 hash, string calldata action) external onlyAgent {
        emit DecisionCommitted(hash, action, block.timestamp);
    }

    function commitDecisionBatch(bytes32[] calldata hashes, string[] calldata actions) external onlyAgent {
        require(hashes.length == actions.length, "length mismatch");
        for (uint256 i = 0; i < hashes.length; i++) {
            emit DecisionCommitted(hashes[i], actions[i], block.timestamp);
        }
        emit DecisionBatchCommitted(hashes.length, block.timestamp);
    }

    function anchorAttestation(bytes32 hash, string calldata attestationType) external onlyAgent {
        emit AttestationAnchored(hash, attestationType, block.timestamp);
    }
}
