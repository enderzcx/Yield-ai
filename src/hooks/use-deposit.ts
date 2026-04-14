"use client";

import { useMemo, useState } from "react";
import { useInjectedWallet } from "@/components/providers";
import type { PreparedDepositQuote } from "@/lib/types";
import { DEPOSIT_ENABLED_CHAIN_ID } from "@/config/constants";

type DepositStep = "idle" | "verifying" | "approving" | "approved" | "depositing" | "done" | "error";

export function useDeposit({
  quote,
  onSuccess,
}: {
  quote: PreparedDepositQuote;
  onSuccess?: (result: { hash: `0x${string}`; quote: PreparedDepositQuote }) => Promise<void> | void;
}) {
  const wallet = useInjectedWallet();
  const [step, setStep] = useState<DepositStep>(quote.approvalNeeded ? "approving" : "approved");
  const [error, setError] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);
  const [depositHash, setDepositHash] = useState<`0x${string}` | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const chainMismatch = wallet.chainId !== DEPOSIT_ENABLED_CHAIN_ID;

  const statusLabel = useMemo(() => {
    if (error) return error;
    switch (step) {
      case "verifying":
        return "Checking readiness for Base USDC...";
      case "approving":
        return quote.approvalNeeded
          ? "Approval is required before the deposit transaction."
          : "Approval already looks good.";
      case "approved":
        return "Approval is complete. You can send the deposit transaction.";
      case "depositing":
        return "Deposit transaction is in flight.";
      case "done":
        return "Deposit confirmed and portfolio refresh triggered.";
      default:
        return "Ready when you are.";
    }
  }, [error, quote.approvalNeeded, step]);

  async function switchToBase() {
    await wallet.switchToBase();
  }

  async function approve() {
    if (!quote.approvalNeeded) {
      setStep("approved");
      return;
    }

    try {
      setIsWorking(true);
      setStep("approving");
      const hash = await wallet.approveToken({
        spender: quote.approvalAddress as `0x${string}`,
        amount: BigInt(quote.fromAmount),
      });
      setApprovalHash(hash);
      await wallet.waitForReceipt(hash, DEPOSIT_ENABLED_CHAIN_ID);
      setStep("approved");
      setError(null);
    } catch (cause) {
      setStep("error");
      setError(cause instanceof Error ? cause.message : "Approval failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function deposit() {
    try {
      setIsWorking(true);
      setStep("depositing");
      const tx = quote.transactionRequest;
      const hash = await wallet.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        chainId: tx.chainId,
      });
      setDepositHash(hash);
      await wallet.waitForReceipt(hash, tx.chainId);
      setStep("done");
      setError(null);
      await onSuccess?.({ hash, quote });
    } catch (cause) {
      setStep("error");
      setError(cause instanceof Error ? cause.message : "Deposit failed");
    } finally {
      setIsWorking(false);
    }
  }

  return {
    step,
    statusLabel,
    chainMismatch,
    approvalHash,
    depositHash,
    isWorking,
    approve,
    deposit,
    switchToBase,
  };
}
