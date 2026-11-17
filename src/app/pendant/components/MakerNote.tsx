// A short written note from the maker. "{name}" becomes the first name.
export default function MakerNote({ from, paragraphs, firstName }: {
  from: string;
  paragraphs: string[];
  firstName: string;
}) {
  return (
    <figure className="pdp-note">
      <blockquote>
        {paragraphs.map((p, i) => <p key={i}>{p.replaceAll('{name}', firstName || 'there')}</p>)}
      </blockquote>
      <figcaption>{from}</figcaption>
    </figure>
  );
}
