// Copy and imagery for the Studio homepage direction.

export const DESIGN_PATH = '/chart';

const NYC = { sky: 'January 15, 1990', detail: '8:30 AM · New York' };
const SYDNEY = { sky: 'June 21, 2010', detail: '3:40 AM · Sydney' };

export interface SkyCard {
  src: string;
  sky: string;
  detail: string;
  // Transparent cut-outs sit on a grey tile; photographs fill the card.
  cutout?: boolean;
}

export const HERO_IMAGES = [
  { src: '/renders/photo/wall-dangle_sydney-2010.jpg', alt: 'Gold pendant hanging in sunlight, casting its shadow on a wall', position: '30% 62%' },
  { src: '/renders/photo/stone-sun_nyc-1990.jpg', alt: 'Gold pendant resting on sunlit stone', position: '50% 70%' },
];

export const SKIES: SkyCard[] = [
  { src: '/renders/pendant-front-1.webp', sky: 'June 21, 1994', detail: '2:30 PM · New York', cutout: true },
  { src: '/renders/photo/studio-soft_sydney-2010.jpg', ...SYDNEY },
  { src: '/renders/pendant-front-2.webp', sky: 'January 1, 2000', detail: '12:00 PM · Lexington', cutout: true },
  { src: '/renders/photo/oxblood_nyc-1990.jpg', ...NYC },
  { src: '/renders/pendant-front-3.webp', sky: 'October 3, 1989', detail: '6:10 AM · Los Angeles', cutout: true },
  { src: '/renders/photo/wall-rest_nyc-1990.jpg', ...NYC },
  { src: '/renders/photo/night-sky_nyc-1990.jpg', ...NYC },
];

export interface Feature {
  src: string;
  alt: string;
  cutout?: boolean;
  title: string;
  body: string;
  cta: string;
}

export const FEATURES: Feature[] = [
  {
    src: '/renders/photo/studio-grey_nyc-1990.jpg',
    alt: 'Gold pendant on a chain against a grey studio backdrop',
    title: 'Start with your birth minute',
    body: 'Your date, time and place of birth give the position of every planet. Each angle between two of them becomes a line, and we read every one with you before anything is drawn in metal.',
    cta: 'Map your sky',
  },
  {
    src: '/renders/pendant-angle-1.webp',
    alt: 'Gold pendant seen at an angle',
    cutout: true,
    title: 'Choose how the gold moves',
    body: 'Liquid, Pebble or Crisp. The lines thicken, meet and close into one form, then the piece is cast to order and finished by hand.',
    cta: 'Start designing',
  },
];

export const TICKER = ['Wear the sky you were born under', 'Cast to order', 'Finished by hand', 'No two are alike'];
