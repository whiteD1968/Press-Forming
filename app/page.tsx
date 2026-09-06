import Link from "next/link";
import { processSequence, researchQuestions } from "../lib/research";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Architectural Products Lab · Press Forming Research</p>
        <h1>Forming Material</h1>
        <p className="hero-copy">
          A shared research environment for investigating thin-sheet forming with 3D-printed tools, compliant tooling, sequential press operations, and undercut / re-entrant geometries.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/experiments">Browse experiments</Link>
          <Link className="button" href="/submit">Record an experiment</Link>
        </div>
      </section>

      <section className="section grid-2">
        <div>
          <p className="section-index">Research premise</p>
          <h2>Process is treated as sequential multimaterial forming.</h2>
        </div>
        <ol className="sequence-list">
          {processSequence.map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>
          ))}
        </ol>
      </section>

      <section className="section">
        <p className="section-index">Research questions</p>
        <div className="question-grid">
          {researchQuestions.map((question, index) => (
            <article className="question-card" key={question}>
              <span>Q{index + 1}</span>
              <p>{question}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section callout">
        <div>
          <p className="section-index">Working method</p>
          <h2>Precedent → principle → translation → experiment.</h2>
        </div>
        <p>
          The atlas connects historical and contemporary forming techniques to testable tool behaviors, then tracks each physical experiment as part of an evolving lineage rather than only presenting final outcomes.
        </p>
      </section>
    </>
  );
}
