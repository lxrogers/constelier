// Copy and imagery for the homepage.

export const DESIGN_PATH = '/chart';

export interface Step {
  label: string;
  title: string;
  body: string;
  alt: string;
  // Leave out until the photograph exists: the panel shows a placeholder.
  src?: string;
  position?: string;
}

export const STEPS: Step[] = [
  {
    label: 'Design',
    title: 'Map your sky',
    body: 'Enter your date, time and place of birth. Your chart is drawn as you type, and the pendant takes shape behind it.',
    src: '/renders/photo/configurator-card-2.jpg',
    alt: 'The configurator: a natal chart wheel with the gold pendant behind it and a date of birth picker',
    position: '50% 0%',
  },
  {
    label: 'Make',
    title: 'Finished by hand',
    body: 'Each piece is cast to order in solid gold, then finished and polished at the bench.',
    // Stand-in picture (AI generated), to be replaced with a real photograph.
    src: '/renders/photo/bench-placeholder.webp',
    alt: 'A jeweller polishing a pendant with a rotary tool at a workbench',
    position: '72% 50%',
  },
  {
    label: 'Wear',
    title: 'A piece you keep',
    body: 'The minute you arrived, in metal. No two are alike, because no two skies are.',
    src: '/renders/photo/stone-sun_nyc-1990.jpg',
    alt: 'Gold pendant and chain lying on sunlit stone',
    position: '50% 62%',
  },
];

const NYC = { sky: 'January 15, 1990', detail: '8:30 AM · New York' };
const SYDNEY = { sky: 'June 21, 2010', detail: '3:40 AM · Sydney' };

export interface SkyCard {
  src: string;
  sky: string;
  detail: string;
  // Transparent cut-outs sit on a tinted tile; photographs fill the card.
  cutout?: boolean;
}

export const SKIES: SkyCard[] = [
  { src: '/renders/pendant-front-1.webp', sky: 'June 21, 1994', detail: '2:30 PM · New York', cutout: true },
  { src: '/renders/photo/wall-rest_nyc-1990.jpg', ...NYC },
  { src: '/renders/pendant-front-2.webp', sky: 'January 1, 2000', detail: '12:00 PM · Lexington', cutout: true },
  { src: '/renders/photo/oxblood_nyc-1990.jpg', ...NYC },
  { src: '/renders/pendant-front-3.webp', sky: 'October 3, 1989', detail: '6:10 AM · Los Angeles', cutout: true },
  { src: '/renders/photo/studio-grey_nyc-1990.jpg', ...NYC },
  { src: '/renders/photo/night-sky_nyc-1990.jpg', ...NYC },
];

export const CLOSING_IMAGE = {
  src: '/renders/photo/wall-dangle_sydney-2010.jpg',
  alt: 'Gold pendant hanging in sunlight, casting its shadow on a wall',
  caption: `${SYDNEY.sky} · ${SYDNEY.detail}`,
};
