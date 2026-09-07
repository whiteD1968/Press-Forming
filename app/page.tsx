import Link from "next/link";
import { processSequence, researchQuestions } from "../lib/research";
import { getResearchAccessState, isApprovedState } from "../lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { state } = await getResearchAccessState();

  if (!isApprovedState(state)) {
    return (
      <>
        <section className="hero">
          <p className="eyebrow">Architectural Products Lab</p>
          <h1>Forming Material</h1>
          <p className="hero-copy">
            An experimental research platform investigating thin-sheet forming, 3D-printed tooling, compliant tooling, sequential deformation, and undercut geometries.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/login">Sign In</Link>
            <Link className="button" href="/login">Request Research Access</Link>
          </div>
        </section>

        <section className="section callout">
          <div>
            <p className="section-index">Research Access</p>
            <h2>The working archive is available to approved collaborators.</h2>
          </div>
          <p>
            The Forming Material archive contains ongoing experimental research, fabrication methods, material knowledge, and lab resources that require confirmed and approved research access.
          </p>
        </section>
      </>
    );
  }

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
