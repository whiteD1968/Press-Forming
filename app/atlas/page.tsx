import { atlasGroups } from "../../lib/research";

export default function AtlasPage() {
  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Atlas</p>
        <h1>Methods, materials, tool systems, and behaviors</h1>
        <p>The atlas is intentionally organized around what each reference contributes to an experiment.</p>
      </div>

      <div className="atlas-grid">
        {atlasGroups.map((group) => (
          <article className="atlas-card" key={group.code}>
            <div className="atlas-card-head"><span>{group.code}</span><h2>{group.title}</h2></div>
            <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>

      <div className="lineage-panel">
        <p className="section-index">Research lineage</p>
        <div className="lineage">
          <span>Precedent</span><b>→</b><span>Principle</span><b>→</b><span>Tool translation</span><b>→</b><span>Experiment</span><b>→</b><span>Next test</span>
        </div>
      </div>
    </section>
  );
}
