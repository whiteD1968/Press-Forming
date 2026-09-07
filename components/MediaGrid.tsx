import type { LibraryMedia } from "../lib/library";

export function MediaGrid({ items }: { items: LibraryMedia[] }) {
  if (!items.length) {
    return <div className="media-placeholder">No image recorded.</div>;
  }

  return (
    <div className="media-grid">
      {items.map((item) => {
        const src = item.signedUrl || item.external_url;
        return (
          <figure key={item.id}>
            {src ? (
              <img loading="lazy" src={src} alt={item.caption || item.media_type || "Research media"} />
            ) : (
              <div className="media-placeholder">Image unavailable.</div>
            )}
            <figcaption>
              {item.media_type && <span>{item.media_type}</span>}
              {item.caption || "Untitled image"}
              {item.credit && <small>Credit: {item.credit}</small>}
              {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Source</a>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
