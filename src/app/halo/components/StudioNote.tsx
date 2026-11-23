import MakerAvatar from '@/components/MakerAvatar';
import { MAKER } from '@/config/maker';

function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg className="halo-note-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 11.5L11.5 4.5" />
      <path d="M5.5 4.5H11.5V10.5" />
    </svg>
  );
}

// A personal studio note from the maker, placed directly below the hero.
export default function StudioNote() {
  return (
    <div className="halo-note rise">
      <div className="halo-note-head">
        <MakerAvatar size={48} />
        <div className="halo-note-meta">
          <h2 className="halo-note-title">A note from {MAKER.name}</h2>
          <p className="halo-note-byline">{MAKER.byline}</p>
        </div>
      </div>

      <div className="halo-note-body">
        <p>
          I’m making Constelier one piece at a time out of my studio in Brooklyn. Since I’m just getting started, I’m taking on a small handful of pendants at a time so I can review every chart and finish each casting by hand.
        </p>
        <p>
          You can design yours now and send it my way—I’ll reach out personally with photos, sizing, and exact pricing as spots open up. In the meantime, you can follow along at the bench on Instagram.
        </p>
      </div>

      <a
        href={MAKER.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="halo-note-ig"
      >
        <InstagramGlyph />
        <span>Follow {MAKER.instagramHandle}</span>
        <ArrowUpRight />
      </a>
    </div>
  );
}
