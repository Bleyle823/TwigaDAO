"use client";

import Hero from "@/components/Hero";
import {
  createMetaMaskAccount,
  createDAOVoteDelegation,
  executeDAOVoteOnBehalfOfDelegator,
} from "../app/quickstart";
import { useState } from "react";
import {
  DelegationStruct,
  Implementation,
  MetaMaskSmartAccount,
  getExplorerAddressLink,
  getExplorerTransactionLink,
} from "@codefi/delegator-core-viem";
import { chain, getExplorerUserOperationLink } from "../app/examples/shared";
import { UserOperationReceipt } from "viem/account-abstraction";

function Delegate() {
  const [executeOnBehalfIsLoading, setExecuteOnBehalfIsLoading] =
    useState(false);

  const [delegatorAccount, setDelegatorAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegateAccount, setDelegateAccount] =
    useState<MetaMaskSmartAccount<Implementation>>();
  const [delegation, setDelegation] = useState<DelegationStruct>();
  const [userOperationReceipt, setUserOperationReceipt] =
    useState<UserOperationReceipt>();
  const [userOperationErrorMessage, setUserOperationErrorMessage] =
    useState<string>();

  const [isDelegateDeployed, setIsDelegateDeployed] = useState(false);
  const [isDelegatorDeployed, setIsDelegatorDeployed] = useState(false);

  const handleCreateDelegator = async () => {
    try {
      const account = await createMetaMaskAccount();
      setDelegatorAccount(account);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDelegate = async () => {
    try {
      const account = await createMetaMaskAccount();
      setDelegateAccount(account);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDelegation = async () => {
    if (!delegatorAccount || !delegateAccount) return;

    setDelegation(undefined);
    setUserOperationReceipt(undefined);

    try {
      const delegation = await createDAOVoteDelegation(
        delegatorAccount,
        delegateAccount.address,
        BigInt(1), // Example proposal ID
        true // Example vote of "yes"
      );
      setDelegation(delegation);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExecuteOnBehalf = async () => {
    if (!delegateAccount || !delegatorAccount || !delegation) return;

    setUserOperationReceipt(undefined);
    setExecuteOnBehalfIsLoading(true);

    const { factory, factoryData } = await delegatorAccount.getFactoryArgs();
    const factoryArgs = factory && factoryData ? { factory, factoryData } : undefined;

    try {
      const receipt = await executeDAOVoteOnBehalfOfDelegator(
        delegateAccount,
        delegation,
        BigInt(1), // Example proposal ID
        true, // Example vote of "yes"
        factoryArgs
      );
      if (receipt.success) {
        setUserOperationReceipt(receipt);
      } else {
        throw new Error(`User operation failed: ${receipt.reason}`);
      }
    } catch (error) {
      setUserOperationErrorMessage((error as Error).message);
    }
    setExecuteOnBehalfIsLoading(false);

    delegateAccount.isDeployed().then(setIsDelegateDeployed);
    delegatorAccount.isDeployed().then(setIsDelegatorDeployed);
  };

  const handleStartAgain = () => {
    setDelegatorAccount(undefined);
    setDelegateAccount(undefined);
    setDelegation(undefined);
    setUserOperationReceipt(undefined);
  };

  return (
    <div className="mx-auto">
      <Hero />
      <h2 className="text-2xl font-bold mb-4">
        Delegation Quickstart with MetaMask Delegation Toolkit
      </h2>
      <p className="mb-4">
        This quickstart demonstrates how to set up a delegation using the MetaMask Delegation Toolkit for DAO voting.
      </p>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">Delegator Account</h3>
          <p>
            This is the MetaMask smart account that will delegate authority. Initially, it will be counterfactual (not on-chain) and only deploys when necessary.
          </p>
          {!delegatorAccount && (
            <button
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              onClick={handleCreateDelegator}
            >
              Create Delegator Account
            </button>
          )}
          {delegatorAccount && (
            <div>
              <a
                href={getExplorerAddressLink(
                  chain.id,
                  delegatorAccount.address
                )}
                target="_blank"
                className="text-green-500 font-mono"
              >
                {delegatorAccount.address}
              </a>{" "}
              - {isDelegatorDeployed ? "Deployed" : "Counterfactual"}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold">Delegate Account</h3>
          <p>
            This is the MetaMask smart account that will execute actions on behalf of the delegator. Like the delegator, it starts as counterfactual.
          </p>
          {!delegateAccount && (
            <button
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              onClick={handleCreateDelegate}
            >
              Create Delegate Account
            </button>
          )}
          {delegateAccount && (
            <div>
              <a
                href={getExplorerAddressLink(chain.id, delegateAccount.address)}
                target="_blank"
                className="text-green-500 font-mono"
              >
                {delegateAccount.address}
              </a>{" "}
              - {isDelegateDeployed ? "Deployed" : "Counterfactual"}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold">Delegation</h3>
          <p>
            The <span className="font-mono">delegator</span> signs a delegation, specifying permitted actions for the <span className="font-mono">delegate account</span>. This delegation allows a vote on a specific DAO proposal.
          </p>

          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleCreateDelegation}
            disabled={
              !delegatorAccount || !delegateAccount || executeOnBehalfIsLoading
            }
          >
            Create Delegation
          </button>

          {delegation && (
            <div className="mt-2 p-2 bg-gray-800 rounded">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(
                  delegation,
                  (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold">Execute</h3>
          <p>
            The delegate account can now redeem the delegation and vote on the DAO proposal on behalf of the delegator.
          </p>
          <button
            className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            onClick={handleExecuteOnBehalf}
            disabled={!delegation || executeOnBehalfIsLoading}
          >
            Execute Vote
          </button>

          {executeOnBehalfIsLoading && (
            <span className="animate-spin inline-block ml-2">
              🐊 loading...
            </span>
          )}
          {userOperationReceipt && (
            <div>
              User operation hash:{" "}
              <a
                href={getExplorerUserOperationLink(
                  chain.id,
                  userOperationReceipt.userOpHash
                )}
                className="text-green-500 font-mono"
                target="_blank"
              >
                {userOperationReceipt.userOpHash}
              </a>
              <br />
              Transaction hash:{" "}
              <a
                href={getExplorerTransactionLink(
                  chain.id,
                  userOperationReceipt.receipt.transactionHash
                )}
                className="text-green-500 font-mono"
                target="_blank"
              >
                {userOperationReceipt.receipt.transactionHash}
              </a>
            </div>
          )}
          {userOperationErrorMessage && (
            <div className="mt-2 p-2 bg-gray-800 rounded">
              <pre className="whitespace-pre-wrap break-all">
                Error submitting User Operation: {userOperationErrorMessage}
              </pre>
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={handleStartAgain}
              disabled={
                (!delegateAccount && !delegatorAccount) ||
                executeOnBehalfIsLoading
              }
              className="bg-white text-black rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
            >
              Start Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Delegate;
