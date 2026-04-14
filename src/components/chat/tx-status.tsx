"use client";

function truncateHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function TxStatus({
  label,
  hash,
}: {
  label: string;
  hash?: string | null;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] px-4 py-3 text-xs text-[color:var(--muted)]">
      <p>{label}</p>
      {hash ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="font-mono text-[11px] text-[color:var(--ink)]">{truncateHash(hash)}</p>
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--accent)] transition hover:opacity-80"
          >
            View on BaseScan
          </a>
        </div>
      ) : null}
    </div>
  );
}
