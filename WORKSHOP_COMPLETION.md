# Ritual Chain Workshop #2 — Completion Record

## Participant

GitHub: @marvellgregory

## Workshop

**Ritual Predict**

A self-resolving binary prediction market designed for Ritual Chain.

## Work completed

The Workshop #2 repository was forked, cloned, configured, inspected, and compiled locally.

The following areas were reviewed as part of the workshop:

- RitualPredict market architecture
- Binary YES / NO market flow
- Native RITUAL staking model
- Market creation parameters
- Block-based betting and resolution deadlines
- Ritual Scheduler integration
- Scheduled autonomous resolution
- Retry behavior for failed resolutions
- RitualWallet prepaid execution funding
- TEE service discovery
- HTTP precompile usage
- jq precompile extraction
- Oracle response handling
- Invalid-market and refund behavior
- Pull-based winner payouts
- Deployment script
- Execution funding script
- Demo-market creation script
- Market status script

## Local build result

The supplied RitualPredict contracts compile successfully with:

- Hardhat 3.13.0
- Solidity 0.8.28
- Viem
- pnpm

Compilation result:

```text
Compiled 2 Solidity files with solc 0.8.28 (evm target: cancun)
```

A later clean compilation correctly reported:

```text
No contracts to compile
```

## Deployment status

Onchain contract deployment was not performed.

At the time this workshop was completed, the Ritual testnet used by the workshop was no longer available for deployment.

The configured public RPC endpoint was unreachable during preflight testing, and community guidance confirmed that contract deployment could no longer be completed because the testnet had ended.

For that reason:

- No contract address is claimed
- No transaction hash is claimed
- No fake deployment evidence has been created
- No onchain market creation is claimed

## Test-suite observation

The supplied workshop README references RitualPredict Solidity and TypeScript tests, including 33 Solidity tests and 2 TypeScript tests.

However, the checked-out workshop source contained:

```text
contracts/RitualPredict.sol
contracts/ritual/RitualChain.sol
test/Counter.ts
```

The supplied Counter.ts test references a Counter contract that is not present in the repository.

Running that supplied test therefore results in an artifact-not-found error for Counter.

No unsupported claim is made that the documented RitualPredict test suite passed.

## Final result

**Local Workshop #2 implementation review and contract compilation completed successfully.**

The prediction-market architecture and supplied operational scripts were reviewed locally.

Onchain deployment, market creation, Scheduler execution, and explorer verification were unavailable because the relevant Ritual testnet had ended.
