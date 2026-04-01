'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div
          className="text-[48px] font-bold leading-none mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}
        >
          Error
        </div>
        <p className="text-[15px] mb-2" style={{ color: 'var(--text-label)' }}>
          Something went wrong.
        </p>
        <p className="text-[13px] font-mono mb-6 break-all" style={{ color: 'var(--text-label)' }}>
          {error.message}
        </p>
        <button
          onClick={reset}
          className="cta-btn text-[14px]"
          style={{ padding: '10px 24px' }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
