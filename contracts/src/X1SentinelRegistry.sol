// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X1SentinelRegistry
 * @notice Community-maintained onchain registry for risk reports and adjudication.
 */
contract X1SentinelRegistry {
    struct Report {
        address reporter;
        address targetAddress;
        string nameTag;
        ReportReason reason;
        string evidence;
        uint256 timestamp;
        uint256 upvotes;
        uint256 downvotes;
        bool resolved;
        bool malicious;
        address resolvedBy;
        uint256 resolvedAt;
    }

    enum ReportReason {
        Phishing,
        Scam,
        RugPull,
        MaliciousContract,
        Spam,
        Other
    }

    mapping(uint256 => Report) public reports;
    mapping(address => uint256[]) public addressToReports;
    mapping(address => mapping(uint256 => bool)) public hasVoted;

    uint256 public reportCount;

    uint256 public constant MIN_UPVOTES_FOR_FLAG = 3;
    uint256 public constant MIN_DOWNVOTES_FOR_SAFE = 3;

    event ReportSubmitted(
        uint256 indexed reportId,
        address indexed reporter,
        address indexed targetAddress,
        ReportReason reason
    );
    event ReportVoted(
        uint256 indexed reportId,
        address indexed voter,
        bool upvote,
        uint256 upvotes,
        uint256 downvotes
    );
    event ReportResolved(uint256 indexed reportId, bool malicious, address indexed resolver);

    /**
     * @notice Submit a new report.
     */
    function submitReport(
        address _targetAddress,
        string memory _nameTag,
        ReportReason _reason,
        string memory _evidence
    ) external returns (uint256) {
        require(_targetAddress != address(0), "Invalid target");
        require(bytes(_evidence).length > 0, "Evidence required");

        uint256 reportId = reportCount++;

        reports[reportId] = Report({
            reporter: msg.sender,
            targetAddress: _targetAddress,
            nameTag: _nameTag,
            reason: _reason,
            evidence: _evidence,
            timestamp: block.timestamp,
            upvotes: 0,
            downvotes: 0,
            resolved: false,
            malicious: false,
            resolvedBy: address(0),
            resolvedAt: 0
        });

        addressToReports[_targetAddress].push(reportId);

        emit ReportSubmitted(reportId, msg.sender, _targetAddress, _reason);
        return reportId;
    }

    /**
     * @notice Vote on an open report.
     */
    function voteOnReport(uint256 _reportId, bool _upvote) external {
        _requireReportExists(_reportId);
        require(!hasVoted[msg.sender][_reportId], "Already voted");

        Report storage report = reports[_reportId];
        require(!report.resolved, "Already resolved");

        hasVoted[msg.sender][_reportId] = true;

        if (_upvote) {
            report.upvotes += 1;
        } else {
            report.downvotes += 1;
        }

        emit ReportVoted(_reportId, msg.sender, _upvote, report.upvotes, report.downvotes);
    }

    /**
     * @notice Resolve a report if thresholds are met.
     * @param _malicious true resolves as malicious, false resolves as safe.
     */
    function resolveReport(uint256 _reportId, bool _malicious) external {
        _requireReportExists(_reportId);

        Report storage report = reports[_reportId];
        require(!report.resolved, "Already resolved");
        require(_canResolve(report, _malicious), "Threshold not met");

        report.resolved = true;
        report.malicious = _malicious;
        report.resolvedBy = msg.sender;
        report.resolvedAt = block.timestamp;

        emit ReportResolved(_reportId, _malicious, msg.sender);
    }

    /**
     * @notice Return whether a report can be resolved in a given direction.
     */
    function canResolve(uint256 _reportId, bool _malicious) external view returns (bool) {
        _requireReportExists(_reportId);
        Report memory report = reports[_reportId];

        if (report.resolved) {
            return false;
        }

        return _canResolve(report, _malicious);
    }

    /**
     * @notice Fetch report IDs for a target address.
     */
    function getReportsForAddress(address _address) external view returns (uint256[] memory) {
        return addressToReports[_address];
    }

    /**
     * @notice Check whether a target address is currently flagged.
     */
    function checkAddress(address _address)
        external
        view
        returns (bool isFlagged, uint256[] memory reportIds)
    {
        reportIds = addressToReports[_address];

        for (uint256 i = 0; i < reportIds.length; i++) {
            Report memory report = reports[reportIds[i]];

            if (report.resolved) {
                if (report.malicious) {
                    isFlagged = true;
                    break;
                }
                continue;
            }

            if (report.upvotes >= MIN_UPVOTES_FOR_FLAG && report.upvotes > report.downvotes) {
                isFlagged = true;
                break;
            }
        }

        return (isFlagged, reportIds);
    }

    /**
     * @notice Score address risk based on net community voting.
     */
    function calculateRiskScore(address _address) external view returns (uint256 score) {
        uint256[] memory reportIds = addressToReports[_address];

        if (reportIds.length == 0) {
            return 0;
        }

        uint256 totalUpvotes = 0;
        uint256 totalDownvotes = 0;
        uint256 activeReports = 0;

        for (uint256 i = 0; i < reportIds.length; i++) {
            Report memory report = reports[reportIds[i]];

            if (report.resolved && !report.malicious) {
                continue;
            }

            activeReports += 1;
            totalUpvotes += report.upvotes;
            totalDownvotes += report.downvotes;
        }

        if (activeReports == 0 || totalUpvotes == 0) {
            return 0;
        }

        uint256 netVotes = totalUpvotes > totalDownvotes ? totalUpvotes - totalDownvotes : 0;

        score = (netVotes * 100) / (activeReports + 1);
        if (score > 100) {
            score = 100;
        }

        return score;
    }

    function _requireReportExists(uint256 _reportId) internal view {
        require(_reportId < reportCount, "Missing report");
    }

    function _canResolve(Report memory report, bool maliciousDirection) internal pure returns (bool) {
        if (maliciousDirection) {
            return report.upvotes >= MIN_UPVOTES_FOR_FLAG && report.upvotes > report.downvotes;
        }

        return report.downvotes >= MIN_DOWNVOTES_FOR_SAFE && report.downvotes >= report.upvotes;
    }
}
