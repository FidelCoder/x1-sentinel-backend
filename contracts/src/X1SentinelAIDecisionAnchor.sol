// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X1SentinelAIDecisionAnchor
 * @notice Anchors AI decision artifacts onchain while keeping full payloads offchain.
 */
contract X1SentinelAIDecisionAnchor {
    struct DecisionAnchor {
        address subjectAddress;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 modelVersionHash;
        uint16 riskScoreBps;
        uint16 confidenceBps;
        uint8 policyAction;
        uint64 timestamp;
        address publisher;
        string metadataUri;
    }

    address public owner;
    mapping(address => bool) public isPublisher;
    mapping(uint256 => DecisionAnchor) public decisions;
    mapping(address => uint256[]) public subjectToDecisionIds;
    uint256 public decisionCount;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PublisherUpdated(address indexed publisher, bool allowed);
    event DecisionAnchored(
        uint256 indexed decisionId,
        address indexed subjectAddress,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 modelVersionHash,
        uint16 riskScoreBps,
        uint16 confidenceBps,
        uint8 policyAction,
        string metadataUri
    );

    error Unauthorized();
    error InvalidAddress();
    error InvalidScore();
    error InvalidHash();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyPublisher() {
        if (!isPublisher[msg.sender]) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        isPublisher[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit PublisherUpdated(msg.sender, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setPublisher(address publisher, bool allowed) external onlyOwner {
        if (publisher == address(0)) revert InvalidAddress();
        isPublisher[publisher] = allowed;
        emit PublisherUpdated(publisher, allowed);
    }

    function anchorDecision(
        address subjectAddress,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 modelVersionHash,
        uint16 riskScoreBps,
        uint16 confidenceBps,
        uint8 policyAction,
        string calldata metadataUri
    ) external onlyPublisher returns (uint256 decisionId) {
        if (subjectAddress == address(0)) revert InvalidAddress();
        if (inputHash == bytes32(0) || outputHash == bytes32(0) || modelVersionHash == bytes32(0)) {
            revert InvalidHash();
        }
        if (riskScoreBps > 10_000 || confidenceBps > 10_000) revert InvalidScore();

        decisionId = decisionCount++;

        decisions[decisionId] = DecisionAnchor({
            subjectAddress: subjectAddress,
            inputHash: inputHash,
            outputHash: outputHash,
            modelVersionHash: modelVersionHash,
            riskScoreBps: riskScoreBps,
            confidenceBps: confidenceBps,
            policyAction: policyAction,
            timestamp: uint64(block.timestamp),
            publisher: msg.sender,
            metadataUri: metadataUri
        });

        subjectToDecisionIds[subjectAddress].push(decisionId);

        emit DecisionAnchored(
            decisionId,
            subjectAddress,
            inputHash,
            outputHash,
            modelVersionHash,
            riskScoreBps,
            confidenceBps,
            policyAction,
            metadataUri
        );
    }

    function getDecisionIdsForAddress(address subjectAddress) external view returns (uint256[] memory) {
        return subjectToDecisionIds[subjectAddress];
    }
}
