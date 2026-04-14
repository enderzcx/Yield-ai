"use client";

import { useEffect, useRef } from "react";

export function useWelcome({
  walletAddress,
  sendMessage,
}: {
  walletAddress?: string;
  sendMessage: (content: string) => Promise<void>;
}) {
  const greetedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!walletAddress || greetedAddress.current === walletAddress) return;
    greetedAddress.current = walletAddress;
    void sendMessage("Analyze my wallet");
  }, [sendMessage, walletAddress]);
}
