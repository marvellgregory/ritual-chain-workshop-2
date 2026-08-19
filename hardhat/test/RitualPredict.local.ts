import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEther, stringToHex } from "viem";

import { network } from "hardhat";

const RITUAL = {
  scheduler: "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  ritualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  teeServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  httpPrecompile: "0x0000000000000000000000000000000000000801",
  jqPrecompile: "0x0000000000000000000000000000000000000803",
} as const;

describe("RitualPredict local self-resolving market", async function () {
  const connection = await network.create({
    network: "hardhatMainnet",
    chainType: "l1",
  });

  const { viem } = connection;

  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();

  const wallets = await viem.getWalletClients();

  const creator = wallets[0];
  const yesBettor = wallets[1];
  const noBettor = wallets[2];
  const executorWallet = wallets[3];

  if (
    creator === undefined ||
    yesBettor === undefined ||
    noBettor === undefined ||
    executorWallet === undefined
  ) {
    throw new Error("Hardhat local accounts are unavailable");
  }

  async function injectRuntimeCode(
    contractName: string,
    targetAddress: `0x${string}`,
  ) {
    const deployed = await viem.deployContract(contractName);

    const runtimeCode = await publicClient.getCode({
      address: deployed.address,
    });

    assert.ok(runtimeCode, `${contractName} runtime bytecode missing`);

    await testClient.setCode({
      address: targetAddress,
      bytecode: runtimeCode,
    });
  }

  async function setupRitualMocks() {
    await injectRuntimeCode("MockScheduler", RITUAL.scheduler);
    await injectRuntimeCode("MockRitualWallet", RITUAL.ritualWallet);
    await injectRuntimeCode("MockTEERegistry", RITUAL.teeServiceRegistry);
    await injectRuntimeCode("MockHttpPrecompile", RITUAL.httpPrecompile);
    await injectRuntimeCode("MockJqPrecompile", RITUAL.jqPrecompile);

    const teeRegistry = await viem.getContractAt(
      "MockTEERegistry",
      RITUAL.teeServiceRegistry,
    );

    const http = await viem.getContractAt(
      "MockHttpPrecompile",
      RITUAL.httpPrecompile,
    );

    const jq = await viem.getContractAt(
      "MockJqPrecompile",
      RITUAL.jqPrecompile,
    );

    const scheduler = await viem.getContractAt(
      "MockScheduler",
      RITUAL.scheduler,
    );

    await teeRegistry.write.setExecutor([
      executorWallet.account.address,
      true,
    ]);

    await http.write.setResponse([
      200,
      stringToHex('{"price":2500}'),
      "",
    ]);

    await jq.write.setValue([2500n]);

    return {
      teeRegistry,
      http,
      jq,
      scheduler,
    };
  }

  it("creates, bets, self-resolves YES, pays winner, and blocks double claim", async function () {
    const { scheduler } = await setupRitualMocks();

    const predict = await viem.deployContract(
      "RitualPredict",
      [1000n],
    );

    assert.ok(predict.address);

    const marketParams = {
      question: "Will the mocked ETH price be at least 2000?",
      oracleUrl: "https://example.local/oracle",
      jsonPath: ".price",
      target: 2000n,
      comparator: 1,
      bettingSeconds: 30n,
      resolveDelaySeconds: 15n,
    } as const;

    await predict.write.createMarket(
      [marketParams],
      {
        account: creator.account,
      },
    );

    assert.equal(
      await predict.read.marketCount(),
      1n,
    );

    let market = await predict.read.getMarket([1n]);

    assert.equal(market.id, 1n);
    assert.equal(market.creator.toLowerCase(), creator.account.address.toLowerCase());
    assert.equal(market.question, marketParams.question);
    assert.equal(market.target, 2000n);
    assert.equal(market.state, 0);
    assert.equal(market.outcome, 0);
    assert.ok(market.scheduleId > 0n);

    const schedule = await scheduler.read.getScheduledCall([
      market.scheduleId,
    ]);

    assert.equal(
      schedule[0].toLowerCase(),
      predict.address.toLowerCase(),
    );

    assert.equal(schedule[3], 3);
    assert.equal(schedule[4], 200);

    await predict.write.bet(
      [1n, true],
      {
        account: yesBettor.account,
        value: parseEther("1"),
      },
    );

    await predict.write.bet(
      [1n, false],
      {
        account: noBettor.account,
        value: parseEther("0.5"),
      },
    );

    market = await predict.read.getMarket([1n]);

    assert.equal(
      market.totalYes,
      parseEther("1"),
    );

    assert.equal(
      market.totalNo,
      parseEther("0.5"),
    );

    const yesStakesBefore = await predict.read.stakesOf([
      1n,
      yesBettor.account.address,
    ]);

    const noStakesBefore = await predict.read.stakesOf([
      1n,
      noBettor.account.address,
    ]);

    assert.equal(
      yesStakesBefore[0],
      parseEther("1"),
    );

    assert.equal(
      noStakesBefore[1],
      parseEther("0.5"),
    );

    const currentBlock = await publicClient.getBlockNumber();

    if (market.resolveBlock > currentBlock) {
      await testClient.mine({
        blocks: Number(
          market.resolveBlock - currentBlock,
        ),
      });
    }

    await scheduler.write.trigger([
      market.scheduleId,
      0n,
    ]);

    market = await predict.read.getMarket([1n]);

    assert.equal(
      market.state,
      3,
      "market should be Resolved",
    );

    assert.equal(
      market.outcome,
      1,
      "YES should win",
    );

    assert.equal(
      market.observedValue,
      2500n,
    );

    assert.equal(
      market.attempts,
      1,
    );

    const winnerStake = await predict.read.stakesOf([
      1n,
      yesBettor.account.address,
    ]);

    const loserStake = await predict.read.stakesOf([
      1n,
      noBettor.account.address,
    ]);

    assert.equal(
      winnerStake[3],
      parseEther("1.5"),
      "YES bettor should claim the full pool",
    );

    assert.equal(
      loserStake[3],
      0n,
      "NO bettor should have nothing claimable",
    );

    await predict.write.claimWinnings(
      [1n],
      {
        account: yesBettor.account,
      },
    );

    const winnerAfterClaim = await predict.read.stakesOf([
      1n,
      yesBettor.account.address,
    ]);

    assert.equal(
      winnerAfterClaim[2],
      true,
    );

    assert.equal(
      winnerAfterClaim[3],
      0n,
    );

    await assert.rejects(
      predict.write.claimWinnings(
        [1n],
        {
          account: yesBettor.account,
        },
      ),
    );

    console.log("");
    console.log("FULL LOCAL MARKET FLOW PASSED");
    console.log(`Market ID: ${market.id}`);
    console.log(`YES pool: ${market.totalYes}`);
    console.log(`NO pool: ${market.totalNo}`);
    console.log(`Observed oracle value: ${market.observedValue}`);
    console.log("Outcome: YES");
    console.log("Winner payout: 1.5 local RITUAL");
    console.log("Double claim protection: PASS");
  });
});