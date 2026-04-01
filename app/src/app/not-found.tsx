import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div
          className="text-[72px] font-bold leading-none mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}
        >
          404
        </div>
        <p className="text-[15px] mb-6" style={{ color: 'var(--text-label)' }}>
          This route does not exist. The trail ends here.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="cta-btn text-[14px]" style={{ padding: '10px 24px' }}>
            Home
          </Link>
          <Link
            href="/bridge"
            className="px-6 py-2.5 text-[14px]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-body)',
              border: '1px solid var(--border-strong)',
              textDecoration: 'none',
            }}
          >
            Launch App
          </Link>
        </div>
      </div>
    </div>
  );
}
