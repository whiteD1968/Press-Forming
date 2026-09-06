import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Forming Material home">
        <span className="brand-mark">FM</span>
        <span>
          <strong>Forming Material</strong>
          <small>Architectural Products Lab</small>
        </span>
      </Link>
      <nav className="main-nav" aria-label="Primary navigation">
        <Link href="/atlas">Atlas</Link>
        <Link href="/experiments">Experiments</Link>
        <Link href="/submit">Submit</Link>
        <Link href="/admin/review">Review</Link>
        <Link href="/login">Login</Link>
      </nav>
    </header>
  );
}
