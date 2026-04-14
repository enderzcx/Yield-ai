"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { custom, type Hex, createWalletClient } from "viem";
import { base, mainnet, optimism, arbitrum } from "viem/chains";
import { getPublicClient } from "@/lib/chain-clients";
import { ASSET_REGISTRY, DEPOSIT_ENABLED_CHAIN_ID } from "@/config/constants";
import { erc20Abi } from "viem";

type ChainConfig = typeof mainnet | typeof optimism | typeof base | typeof arbitrum;

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WalletContextValue = {
  address?: Hex;
  chainId?: number;
  isConnected: boolean;
  hasProvider: boolean;
  shortAddress?: string;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearConnection: () => void;
  switchToBase: () => Promise<void>;
  approveToken: (input: { spender: Hex; amount: bigint }) => Promise<Hex>;
  sendTransaction: (input: {
    to: Hex;
    data: Hex;
    value?: bigint;
    gas?: bigint;
    gasPrice?: bigint;
    chainId: number;
  }) => Promise<Hex>;
  waitForReceipt: (hash: Hex, chainId: number) => Promise<unknown>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const MANUAL_DISCONNECT_KEY = "yield-ai:manual-disconnect";

const chainConfigMap: Record<number, ChainConfig> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
};

function getEthereumProvider() {
  if (typeof window === "undefined") return undefined;
  return window.ethereum as Eip1193Provider | undefined;
}

async function loadWalletState(provider: Eip1193Provider) {
  const [accountsResponse, chainIdResponse] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);

  const accounts = Array.isArray(accountsResponse) ? (accountsResponse as string[]) : [];
  const chainIdHex = typeof chainIdResponse === "string" ? chainIdResponse : "0x0";

  return {
    address: accounts[0] as Hex | undefined,
    chainId: Number.parseInt(chainIdHex, 16),
  };
}

function subscribeToInjectedWallet(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => callback();
  window.addEventListener("ethereum#initialized", listener);
  window.addEventListener("focus", listener);

  return () => {
    window.removeEventListener("ethereum#initialized", listener);
    window.removeEventListener("focus", listener);
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Hex | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const hasProvider = useSyncExternalStore(
    subscribeToInjectedWallet,
    () => Boolean(getEthereumProvider()),
    () => false,
  );
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(MANUAL_DISCONNECT_KEY) === "true";
  });

  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) return;

    let cancelled = false;
    if (!isManuallyDisconnected) {
      void loadWalletState(provider).then((state) => {
        if (cancelled) return;
        setAddress(state.address);
        setChainId(state.chainId);
      });
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      if (isManuallyDisconnected) return;
      const accounts = (args[0] as string[] | undefined) ?? [];
      setAddress(accounts[0] as Hex | undefined);
    };

    const handleChainChanged = (...args: unknown[]) => {
      if (isManuallyDisconnected) return;
      const nextChainIdHex = args[0] as string | undefined;
      if (!nextChainIdHex) return;
      setChainId(Number.parseInt(nextChainIdHex, 16));
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [isManuallyDisconnected]);

  const value = useMemo<WalletContextValue>(() => {
    async function requestWalletConnection(forcePermissionPrompt = false) {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found. Open MetaMask, Rabby, or another browser wallet.");

      setIsManuallyDisconnected(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(MANUAL_DISCONNECT_KEY);
      }

      if (forcePermissionPrompt) {
        try {
          await provider.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // Some injected wallets do not support wallet_requestPermissions.
        }
      }

      const accountsResponse = await provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(accountsResponse) ? (accountsResponse as string[]) : [];
      const account = accounts[0] as Hex | undefined;
      if (!account) throw new Error("Wallet connection returned no account.");

      const chainIdResponse = await provider.request({ method: "eth_chainId" });
      const nextChainId = Number.parseInt(String(chainIdResponse), 16);

      setAddress(account);
      setChainId(nextChainId);
    }

    async function connect() {
      await requestWalletConnection(false);
    }

    async function reconnect() {
      await requestWalletConnection(true);
    }

    function clearConnection() {
      setAddress(undefined);
      setChainId(undefined);
      setIsManuallyDisconnected(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(MANUAL_DISCONNECT_KEY, "true");
      }
    }

    async function switchToBase() {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found.");

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${DEPOSIT_ENABLED_CHAIN_ID.toString(16)}` }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("4902")) throw error;

        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${base.id.toString(16)}`,
              chainName: base.name,
              nativeCurrency: base.nativeCurrency,
              rpcUrls: base.rpcUrls.default.http,
              blockExplorerUrls: [base.blockExplorers?.default.url].filter(Boolean),
            },
          ],
        });
      }

      setChainId(DEPOSIT_ENABLED_CHAIN_ID);
    }

    async function getWalletClient(targetChainId: number) {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No injected wallet found.");
      if (!address) throw new Error("Connect your wallet before sending transactions.");

      const chain = chainConfigMap[targetChainId];
      if (!chain) throw new Error(`Unsupported chain for wallet client: ${targetChainId}`);

      return createWalletClient({
        account: address,
        chain,
        transport: custom(provider),
      });
    }

    async function approveToken(input: { spender: Hex; amount: bigint }) {
      const client = await getWalletClient(DEPOSIT_ENABLED_CHAIN_ID);
      return client.writeContract({
        account: address,
        address: ASSET_REGISTRY.USDC_BASE.tokenAddress as Hex,
        abi: erc20Abi,
        functionName: "approve",
        args: [input.spender, input.amount],
      });
    }

    async function sendTransaction(input: {
      to: Hex;
      data: Hex;
      value?: bigint;
      gas?: bigint;
      gasPrice?: bigint;
      chainId: number;
    }) {
      const client = await getWalletClient(input.chainId);
      return client.sendTransaction({
        account: address,
        to: input.to,
        data: input.data,
        value: input.value,
        gas: input.gas,
        gasPrice: input.gasPrice,
        chain: chainConfigMap[input.chainId],
      });
    }

    async function waitForReceipt(hash: Hex, targetChainId: number) {
      const client = getPublicClient(targetChainId);
      return client.waitForTransactionReceipt({ hash });
    }

    return {
      address,
      chainId,
      isConnected: Boolean(address),
      hasProvider,
      shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined,
      connect,
      reconnect,
      clearConnection,
      switchToBase,
      approveToken,
      sendTransaction,
      waitForReceipt,
    };
  }, [address, chainId, hasProvider]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useInjectedWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useInjectedWallet must be used within Providers.");
  }

  return context;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
