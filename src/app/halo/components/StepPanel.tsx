import Image from 'next/image';
import type { Step } from '../content';

// One "How it works" panel: a tall rounded picture with a frosted label,
// and the step's title and copy underneath. Without a picture it shows a
// marked placeholder, so a missing photograph is never mistaken for one.
export default function StepPanel({ step, index }: { step: Step; index: number }) {
  return (
    <li className="halo-step rise" style={{ ['--i' as string]: index }}>
      <div className={`halo-step-img${step.src ? '' : ' is-empty'}`}>
        {step.src ? (
          <Image src={step.src} alt={step.alt} fill sizes="(max-width: 860px) 82vw, 31vw" style={{ objectPosition: step.position }} />
        ) : (
          <div className="halo-step-empty" role="img" aria-label={`Photograph to come: ${step.alt}`}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M8.5 6l1.2-2h4.6l1.2 2" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
            <span>Photograph to come</span>
            <span>{step.alt}</span>
          </div>
        )}
        <span className="halo-chip">{index + 1}</span>
      </div>
      <h3 className="halo-step-title">{step.title}</h3>
      <p className="halo-body">{step.body}</p>
    </li>
  );
}
