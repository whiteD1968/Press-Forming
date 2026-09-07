import Link from "next/link";
import { AccountNav } from "./AccountNav";

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
      <AccountNav />
    </header>
  );
}
