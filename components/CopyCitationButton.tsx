"use client";

import { useState } from "react";

export function CopyCitationButton({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(citation);
    setCopied(true);
  }

  return <button className="button" type="button" onClick={copy}>{copied ? "Copied" : "COPY CITATION"}</button>;
}
