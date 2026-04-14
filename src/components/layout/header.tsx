"use client";

export function Header({
  walletConnected,
  hasInjectedWallet,
  walletLabel,
  chainLabel,
  canSwitchToBase,
  walletNotice,
  onConnect,
  onReconnect,
  onDisconnect,
  onSwitchToBase,
}: {
  walletConnected: boolean;
  hasInjectedWallet: boolean;
  walletLabel?: string;
  chainLabel?: string;
  canSwitchToBase: boolean;
  walletNotice?: string;
  onConnect: () => Promise<void> | void;
  onReconnect: () => Promise<void> | void;
  onDisconnect: () => void;
  onSwitchToBase: () => Promise<void> | void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border-soft)] bg-[color:var(--page)]/84 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="space-y-1">
          <p className="eyebrow text-[color:var(--accent)]">
            Yield.AI
          </p>
          <h1 className="font-display text-base tracking-tight text-[color:var(--ink)] sm:text-lg">
            Base-first yield operator
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {walletConnected ? (
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-3 py-2 text-xs text-[color:var(--muted)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
                {walletLabel}
                {chainLabel ? ` / ${chainLabel}` : ""}
              </div>
              {canSwitchToBase ? (
                <button
                  type="button"
                  onClick={() => void onSwitchToBase()}
                  className="action-button action-button--secondary text-[0.7rem] py-2 px-3"
                >
                  Switch to Base
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDisconnect}
                className="text-xs text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void onConnect()}
              disabled={!hasInjectedWallet}
              className="action-button action-button--primary"
            >
              {hasInjectedWallet ? "Connect wallet" : "Install wallet"}
            </button>
          )}
        </div>
      </div>

      {walletNotice ? (
        <div className="border-t border-[color:var(--border-soft)] px-4 py-3 text-sm text-[color:var(--muted)] sm:px-6">
          {walletNotice}
        </div>
      ) : null}
    </header>
  );
}
