// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * Local-only Ritual system mocks.
 *
 * These contracts are designed to have their runtime bytecode injected at the
 * canonical Ritual system/precompile addresses on a local Hardhat network.
 *
 * They are NOT production contracts and are NOT intended for deployment to
 * Ritual Chain.
 */

contract MockScheduler {
    struct ScheduledCall {
        address target;
        bytes data;
        uint32 gasLimit;
        uint32 startBlock;
        uint32 numCalls;
        uint32 frequency;
        uint32 ttl;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        uint256 value;
        address payer;
        bool cancelled;
    }

    uint256 public nextCallId;
    mapping(uint256 => ScheduledCall) private _calls;

    function approveScheduler(address) external {}

    function schedule(
        bytes calldata data,
        uint32 gasLimit,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId) {
        callId = ++nextCallId;

        _calls[callId] = ScheduledCall({
            target: msg.sender,
            data: data,
            gasLimit: gasLimit,
            startBlock: startBlock,
            numCalls: numCalls,
            frequency: frequency,
            ttl: ttl,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            value: value,
            payer: payer,
            cancelled: false
        });
    }

    function cancel(uint256 callId) external {
        _calls[callId].cancelled = true;
    }

    function getCallState(uint256 callId) external view returns (uint8) {
        if (_calls[callId].target == address(0)) return 0;
        if (_calls[callId].cancelled) return 2;
        return 1;
    }

    function getScheduledCall(
        uint256 callId
    )
        external
        view
        returns (
            address target,
            bytes memory data,
            uint32 startBlock,
            uint32 numCalls,
            uint32 frequency,
            bool cancelled
        )
    {
        ScheduledCall storage c = _calls[callId];

        return (
            c.target,
            c.data,
            c.startBlock,
            c.numCalls,
            c.frequency,
            c.cancelled
        );
    }

    /**
     * Simulate Ritual Scheduler execution locally.
     *
     * The real Scheduler overwrites calldata bytes 4-35 with executionIndex.
     * This mock reproduces that behaviour.
     */
    function trigger(
        uint256 callId,
        uint256 executionIndex
    ) external {
        ScheduledCall storage c = _calls[callId];

        require(c.target != address(0), "unknown call");
        require(!c.cancelled, "call cancelled");
        require(executionIndex < c.numCalls, "execution out of range");
        require(block.number >= c.startBlock, "too early");

        bytes memory callbackData = c.data;

        assembly {
            mstore(add(callbackData, 36), executionIndex)
        }

        (bool ok, bytes memory result) = c.target.call(callbackData);

        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}


contract MockTEERegistry {
    address public executor;
    bool public available;

    function setExecutor(
        address executor_,
        bool available_
    ) external {
        executor = executor_;
        available = available_;
    }

    function pickServiceByCapability(
        uint8,
        bool,
        uint256,
        uint256
    )
        external
        view
        returns (
            address teeAddress,
            bool found
        )
    {
        return (executor, available);
    }

    function getIndexedServiceCountByCapability(
        uint8
    ) external view returns (uint256 count) {
        return available ? 1 : 0;
    }
}


contract MockRitualWallet {
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _lockUntil;

    function deposit(
        uint256 lockDuration
    ) external payable {
        _balances[msg.sender] += msg.value;
        _lockUntil[msg.sender] = block.number + lockDuration;
    }

    function balanceOf(
        address account
    ) external view returns (uint256) {
        return _balances[account];
    }

    function lockUntil(
        address account
    ) external view returns (uint256) {
        return _lockUntil[account];
    }
}


/**
 * Mock for Ritual HTTP precompile at 0x0801.
 *
 * RitualPredict calls this address directly with abi.encode(...) rather than a
 * Solidity function selector, so fallback() returns the same response envelope
 * shape expected by decodeHttpResponse().
 */
contract MockHttpPrecompile {
    uint16 public status;
    bytes public body;
    string public errorMessage;
    bool public forceRevert;

    function setResponse(
        uint16 status_,
        bytes calldata body_,
        string calldata errorMessage_
    ) external {
        status = status_;
        body = body_;
        errorMessage = errorMessage_;
        forceRevert = false;
    }

    function setForceRevert(
        bool enabled
    ) external {
        forceRevert = enabled;
    }

    fallback() external {
        if (forceRevert) {
            revert("mock HTTP failure");
        }

        string[] memory headerKeys = new string[](0);
        string[] memory headerValues = new string[](0);

        bytes memory actualOutput = abi.encode(
            status,
            headerKeys,
            headerValues,
            body,
            errorMessage
        );

        bytes memory response = abi.encode(
            bytes(""),
            actualOutput
        );

        assembly {
            return(add(response, 32), mload(response))
        }
    }
}


/**
 * Mock for Ritual jq precompile at 0x0803.
 *
 * RitualPredict performs a raw staticcall containing:
 * abi.encode(query, json, outputType).
 *
 * For local tests we configure the uint256 value the mock should return.
 */
contract MockJqPrecompile {
    uint256 public configuredValue;
    bool public forceRevert;

    function setValue(
        uint256 value_
    ) external {
        configuredValue = value_;
        forceRevert = false;
    }

    function setForceRevert(
        bool enabled
    ) external {
        forceRevert = enabled;
    }

    fallback() external {
        if (forceRevert) {
            revert("mock jq failure");
        }

        bytes memory result = abi.encode(configuredValue);

        assembly {
            return(add(result, 32), mload(result))
        }
    }
}