// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X1SentinelDepinAnchor
 * @notice Anchors DePIN telemetry aggregates onchain with Merkle root + metadata references.
 */
contract X1SentinelDepinAnchor {
    struct SubjectTelemetryAnchor {
        address subjectAddress;
        bytes32 attestationRoot;
        uint32 attestationCount;
        uint16 healthScoreBps;
        uint16 confidenceBps;
        uint64 timestamp;
        address publisher;
        string metadataUri;
    }

    address public owner;
    mapping(address => bool) public isPublisher;
    mapping(uint256 => SubjectTelemetryAnchor) public anchors;
    mapping(address => uint256[]) public subjectToAnchorIds;
    uint256 public anchorCount;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PublisherUpdated(address indexed publisher, bool allowed);
    event SubjectTelemetryAnchored(
        uint256 indexed anchorId,
        address indexed subjectAddress,
        bytes32 attestationRoot,
        uint32 attestationCount,
        uint16 healthScoreBps,
        uint16 confidenceBps,
        string metadataUri
    );

    error Unauthorized();
    error InvalidAddress();
    error InvalidScore();
    error InvalidRoot();

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

    function anchorSubjectTelemetry(
        address subjectAddress,
        bytes32 attestationRoot,
        uint32 attestationCount,
        uint16 healthScoreBps,
        uint16 confidenceBps,
        string calldata metadataUri
    ) external onlyPublisher returns (uint256 anchorId) {
        if (subjectAddress == address(0)) revert InvalidAddress();
        if (attestationRoot == bytes32(0)) revert InvalidRoot();
        if (healthScoreBps > 10_000 || confidenceBps > 10_000) revert InvalidScore();

        anchorId = anchorCount++;

        anchors[anchorId] = SubjectTelemetryAnchor({
            subjectAddress: subjectAddress,
            attestationRoot: attestationRoot,
            attestationCount: attestationCount,
            healthScoreBps: healthScoreBps,
            confidenceBps: confidenceBps,
            timestamp: uint64(block.timestamp),
            publisher: msg.sender,
            metadataUri: metadataUri
        });

        subjectToAnchorIds[subjectAddress].push(anchorId);

        emit SubjectTelemetryAnchored(
            anchorId,
            subjectAddress,
            attestationRoot,
            attestationCount,
            healthScoreBps,
            confidenceBps,
            metadataUri
        );
    }

    function getAnchorIdsForAddress(address subjectAddress) external view returns (uint256[] memory) {
        return subjectToAnchorIds[subjectAddress];
    }
}
