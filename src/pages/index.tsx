import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Link
        href="/api/auth/start"
        className="bg-blue-500 text-white px-6 py-3 rounded"
      >
        Install GoHighLevel App
      </Link>
    </div>
  );
}
