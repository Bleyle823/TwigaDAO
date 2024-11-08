import {
  type Call,
  type DelegationStruct,
  type ExecutionStruct,
  createCaveatBuilder,
  createRootDelegation,
  DelegationFramework,
  Implementation,
  MetaMaskSmartAccount,
  SINGLE_DEFAULT_MODE,
  toMetaMaskSmartAccount,
} from "@codefi/delegator-core-viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { encodeFunctionData, type Address, type Hex, isAddressEqual, zeroAddress } from "viem";
import { bundlerClient, createSalt, publicClient, getFeePerGas } from "./examples/shared";

// DAO contract address
const daoVotingContractAddress: Address = "0xd9145CCE52D386f254917e481eB44e9943F39138";

// Create DAO voting data
function createDAOCallData(proposalId: bigint, support: boolean): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "vote",
        inputs: [
          { name: "proposalId", type: "uint256" },
          { name: "support", type: "bool" },
        ],
        outputs: [],
      },
    ],
    functionName: "vote",
    args: [proposalId, support],
  });
}

/**
 * Create a MetaMaskSmartAccount for the hybrid delegator.
 * @returns MetaMaskSmartAccount instance.
 */
export const createMetaMaskAccount = async () => {
  const owner = privateKeyToAccount(generatePrivateKey());
  return await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [owner.address, [], [], []],
    deploySalt: createSalt(),
    signatory: { account: owner },
  });
};

/**
 * Create and sign a root delegation for voting on DAO proposals.
 * @param delegatorAccount - The MetaMaskSmartAccount of the delegator.
 * @param delegateAddress - Address of the delegate.
 * @param proposalId - The DAO proposal ID to vote on.
 * @param support - True for "yes" vote, false for "no" vote.
 * @returns Signed delegation.
 */
export const createDAOVoteDelegation = async (
  delegatorAccount: MetaMaskSmartAccount<Implementation>,
  delegateAddress: Address,
  proposalId: bigint,
  support: boolean
) => {
  const callData = createDAOCallData(proposalId, support);

  // Apply caveats to limit the delegation's scope to voting on the DAO contract
  const caveats = createCaveatBuilder(delegatorAccount.environment)
    .addCaveat("allowedTargets", [daoVotingContractAddress])
    .addCaveat("allowedMethods", ["vote(uint256,bool)"]);

  const delegation = createRootDelegation(
    delegateAddress,
    delegatorAccount.address,
    caveats,
    BigInt(createSalt())
  );

  const signature = await delegatorAccount.signDelegation({ delegation });

  return { ...delegation, signature };
};

/**
 * Redeem the delegation to cast a vote on behalf of the delegator.
 * @param redeemerAccount - MetaMaskSmartAccount of the redeemer (delegate).
 * @param delegation - The signed delegation.
 * @param proposalId - DAO proposal ID to vote on.
 * @param support - True for "yes", false for "no".
 * @param delegatorFactoryArgs - Optional factory arguments for delegator creation.
 * @returns User operation receipt.
 */
export const executeDAOVoteOnBehalfOfDelegator = async (
  redeemerAccount: MetaMaskSmartAccount<Implementation>,
  delegation: DelegationStruct,
  proposalId: bigint,
  support: boolean,
  delegatorFactoryArgs?: { factory: Address; factoryData: Hex }
) => {
  // Validate delegate account
  if (!isAddressEqual(redeemerAccount.address, delegation.delegate)) {
    throw new Error(`Redeemer account does not match delegate address.`);
  }

  const callData = createDAOCallData(proposalId, support);

  const executions: ExecutionStruct[] = [
    {
      target: daoVotingContractAddress,
      value: 0n,
      callData: callData,
    },
  ];

  const redeemDelegationCalldata = DelegationFramework.encode.redeemDelegations(
    [[delegation]],
    [SINGLE_DEFAULT_MODE],
    [executions]
  );

  const calls: Call[] = [
    {
      to: redeemerAccount.address,
      data: redeemDelegationCalldata,
    },
  ];

  if (delegatorFactoryArgs) {
    const { factory, factoryData } = delegatorFactoryArgs;
    calls.unshift({
      to: factory,
      data: factoryData,
    });
  }

  const feePerGas = await getFeePerGas();
  
  const userOperationHash = await bundlerClient.sendUserOperation({
    account: redeemerAccount,
    calls,
    ...feePerGas,
  });

  return await bundlerClient.waitForUserOperationReceipt({
    hash: userOperationHash,
  });
};
