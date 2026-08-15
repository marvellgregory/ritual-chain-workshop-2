# Ritual Predict

A self-resolving binary prediction market on [Ritual Chain](https://docs.ritualfoundation.org).

Create a market like _"Will ETH/USD be at least $4,000 when this market resolves?"_, stake native
RITUAL on YES or NO, and watch it settle itself. When the betting window closes, **nobody presses a
resolve button and no backend cron job runs**. The Ritual Scheduler wakes the contract at a block
fixed when the market was created; the contract calls the HTTP precompile to read the configured
oracle URL, extracts one number with the jq precompile, compares it to the target, and settles.
Winners then pull their proportional share of the pool.

---

## Architecture

```
                 createMarket()                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   user  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚  RitualPredict.sol       â”‚
   user  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ bet(id, YES|NO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚                          â”‚
                                                   â”‚  markets, pools, stakes  â”‚
                                     schedule() â—€â”€â”€â”¤                          â”‚
                                                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â–²              â”‚
    â”‚ Scheduler  0x56e7â€¦D58B      â”‚  onScheduledResolve â”‚              â”‚ deposit()
    â”‚ system contract             â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â–¼
    â”‚ fires at resolveBlock,      â”‚                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ 3 attempts, 200 blocks apartâ”‚                        â”‚ RitualWallet 0x532Fâ€¦   â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                        â”‚ prepaid execution fees â”‚
                                                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        inside that one scheduled transaction:

   TEEServiceRegistry 0x9644â€¦  â”€â”€pickServiceByCapability(HTTP_CALL)â”€â”€â–¶  executor address
   HTTP precompile    0x0801   â”€â”€GET oracleUrl (in a TEE)â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶  demo oracle
   jq  precompile     0x0803   â”€â”€jsonPath, outputType=uint256â”€â”€â”€â”€â”€â”€â”€â–¶  observed value
                                          â”‚
                                          â–¼
                        observed â‹ˆ target  â†’  Resolved(YES|NO)
                        read failed 3Ã—     â†’  Invalid (everyone refunds)
```

---

### Design decisions worth knowing

**Deadlines are block numbers, not timestamps.** The Scheduler fires at a _block_, so betting also
closes at a _block_. That way "betting is closed" and "the Scheduler woke us" can never disagree,
whatever the chain's block time does. `createMarket` takes human durations in seconds and converts
them using the `blockTimeMs` fixed at deployment. Nothing on-chain reads `block.timestamp`.

**On Ritual Chain, `block.timestamp` is Unix milliseconds** (â‰ˆ`1.786e12`), not seconds â€” verified
against the live chain, not assumed. That is a good reason to avoid it entirely, which this contract
does. Measured block time was â‰ˆ195 ms when this was written; run
`npx hardhat run scripts/block-time.ts` to check it for yourself.

**A failed oracle read is never a NO.** `onScheduledResolve` treats a precompile failure, a non-200
response, an undecodable envelope, an executor error message, and an unparseable body all as
_failures_, not as a negative outcome. The response decode happens through an external `try`, so
malformed bytes surface as a caught failure instead of reverting the execution and rolling back the
attempt counter.

**Retries are the Scheduler's own mechanism.** `createMarket` books `numCalls = 3` executions
`frequency = 200` blocks apart in a single `schedule()` call. Attempt 1 lands at `resolveBlock`; if
it succeeds, the contract `cancel()`s the remainder; if all three fail, the market becomes `Invalid`
and every stake is refundable. Each attempt re-rolls the TEE executor seed, so one unhealthy
executor cannot sink a market. The callback is idempotent, so a leftover execution is harmless.

**No executor is hardcoded.** The contract calls
`TEEServiceRegistry.pickServiceByCapability(HTTP_CALL, true, seed, 8)` at resolution time.

**Payouts are pull-based and loop-free.** `claimWinnings` computes
`stake Ã— totalPool Ã· winningPool` for the caller only. Integer division leaves sub-wei dust in the
contract; that is deliberate and negligible.

**Empty winning side â†’ refundable.** Pari-mutuel has no denominator when nobody backed the winning
answer, so the market records the outcome and observed value, then becomes `Invalid` so everyone
takes their stake back.

**Resolution parameters are immutable.** `target`, `comparator`, `oracleUrl`, `jsonPath`, and
`resolveBlock` have no setter. The `ResolutionRuleSet` event records them at creation.

---

## Prerequisites

- Node.js 20+ and `pnpm`
- A wallet with testnet RITUAL from <https://faucet.ritualfoundation.org>

## Setup

```bash
cd hardhat
pnpm install
cp .env.example .env
```

---

## Scope

Intentionally not included: an AMM, an order book, an order-matching engine, governance, a separate
ERC-20, a centralized resolver, or an upgrade proxy. Staking uses the chain's native asset and the
betting model is plain pari-mutuel: two running totals and one mapping per side.

## Reference

- Ritual Chain docs â€” <https://docs.ritualfoundation.org>
- dApp skills â€” <https://github.com/ritual-foundation/ritual-dapp-skills>
- Explorer â€” <https://explorer.ritualfoundation.org> Â· Faucet â€” <https://faucet.ritualfoundation.org>

---

## Workshop completion status

Workshop #2 was completed locally by reviewing the RitualPredict architecture, market lifecycle, Scheduler integration, RitualWallet execution funding, TEE / HTTP / jq resolution path, and supplied operational scripts.

The smart contracts compile successfully with Solidity 0.8.28.

Onchain deployment was not performed because the Ritual testnet used by the workshop was no longer available at the time of completion.

See [WORKSHOP_COMPLETION.md](./WORKSHOP_COMPLETION.md) for the detailed completion record and repository test-suite observations.
