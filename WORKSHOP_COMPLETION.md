# Ritual Chain Workshop #2 — Completion Record

## Participant

GitHub: @marvellgregory

## Workshop

**Ritual Predict — Self-Resolving Prediction Market**

A self-resolving binary prediction market designed for Ritual Chain.

## Proof of Building

This repository was forked through GitHub and extended with original implementation and local testing work.

Rather than submitting an unchanged workshop fork, the missing prediction-market logic was completed and a local Ritual simulation environment was built so the market could be tested end to end while the public workshop testnet was unavailable.

## Original Work

Key implementation commits:

```text
9b8c457 feat: complete self-resolving prediction market core
1645427 test: add local self-resolving market lifecycle
7544743 docs: update proof of building completion record

```

## Core Prediction Market Work

The completed implementation covers:

- Market creation and validation
- Binary YES / NO staking
- Block-based betting deadlines
- Ritual Scheduler integration
- Scheduled autonomous resolution
- Resolution retry handling
- TEE executor discovery
- HTTP oracle handling
- jq oracle value extraction
- Comparator-based outcome resolution
- Invalid-market handling and refunds
- Pull-based winner payouts
- Double-claim protection
- RitualWallet execution funding

## Local Ritual Simulation

Because the workshop Ritual testnet was no longer available for deployment, local mocks were created for:

```text
MockScheduler
MockTEERegistry
MockRitualWallet
MockHttpPrecompile
MockJqPrecompile
```

The mocks are located at:

```text
hardhat/contracts/mocks/RitualMocks.sol
```

The lifecycle test is located at:

```text
hardhat/test/RitualPredict.local.ts
```

The mock runtime bytecode is injected at the same canonical Ritual system addresses expected by `RitualPredict`, allowing the Ritual-oriented architecture to be exercised locally.

## End-to-End Flow Demonstrated

```text
Create market
→ Schedule autonomous resolution
→ YES participant stakes
→ NO participant stakes
→ Advance local blocks
→ Select mock TEE executor
→ Receive mock HTTP oracle response
→ Extract oracle value through mock jq
→ Execute scheduled resolution
→ Determine YES outcome
→ Calculate winner payout
→ Winner claims
→ Reject second claim
```

## Verified Local Test Result

Command:

```powershell
cd hardhat
npx hardhat test test/RitualPredict.local.ts
```

Verified output:

```text
FULL LOCAL MARKET FLOW PASSED
Market ID: 1
YES pool: 1000000000000000000
NO pool: 500000000000000000
Observed oracle value: 2500
Outcome: YES
Winner payout: 1.5 local RITUAL
Double claim protection: PASS

RitualPredict local self-resolving market
  ✔ creates, bets, self-resolves YES, pays winner, and blocks double claim

1 passing (1 nodejs)
```

## Compilation

The completed project compiles successfully with Hardhat 3.13.0, Solidity 0.8.28, Viem, and TypeScript.

A clean verification run reports:

```text
No contracts to compile
```

followed by the passing lifecycle test above.

## Testnet Deployment Status

No new Ritual testnet deployment is claimed.

At the time this Proof of Building work was completed, the workshop testnet was no longer available for deployment.

Therefore:

- No new contract address is claimed
- No new transaction hash is claimed
- No explorer deployment is claimed
- No fabricated onchain evidence is presented

The project instead provides reproducible local Hardhat evidence.

## Starter Test Cleanup

The checked-out starter included `test/Counter.ts`, which referenced a `Counter` contract that was not present in the workshop source.

That unrelated starter test was removed and replaced with the RitualPredict-specific local lifecycle test.

## Reproducing the Proof

From the repository root:

```powershell
cd hardhat
npx hardhat compile
npx hardhat test test/RitualPredict.local.ts
```

A successful run should finish with:

```text
FULL LOCAL MARKET FLOW PASSED
1 passing
```

## Final Result

**Ritual Chain Workshop #2 self-resolving prediction market completed and demonstrated locally.**

The repository contains original contract implementation, Ritual integration logic, local Ritual infrastructure mocks, and a passing end-to-end prediction-market lifecycle covering creation, betting, autonomous resolution, winner payout, and double-claim protection.