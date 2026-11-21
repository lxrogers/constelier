// Specialized readings for every achievable planet pair × major aspect.
// Keyed canonically by PLANET_ORDER ("p1-p2") so lookup is order-independent.

export type MajorLineAspect = 'opposition' | 'trine' | 'square' | 'sextile';

const PLANET_ORDER = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

type AspectMap = Partial<Record<MajorLineAspect, string>>;

const PAIR_READINGS: Record<string, AspectMap> = {
  // ── Sun ───────────────────────────────────────────────────────────
  'sun-moon': {
    opposition: 'What you are trying to become and what makes you feel safe pull in opposite directions — you see both sides of a room because you live with both inside you.',
    trine: 'Your outward direction and your inner instincts naturally agree, giving you an easy steadiness people tend to trust right away.',
    square: 'Your willpower and your gut feelings push against each other, turning inner restlessness into the drive to prove what you are made of.',
    sextile: 'Your sense of purpose and your emotional instincts are on good terms — when you check in with both, choices tend to click into place.',
  },
  'sun-mars': {
    opposition: 'Your pride and your impulse face off across the wheel, teaching you when to push forward and when to let someone else swing first.',
    trine: 'Confidence and momentum move together effortlessly — once you decide on a course, your energy lines up right behind it.',
    square: 'Ambition and impatience rub against each other, creating a fierce engine that does its best work when you have something real to build.',
    sextile: 'Your sense of self and your courage back each other up, giving you steady stamina whenever you choose to step forward.',
  },
  'sun-jupiter': {
    opposition: 'Big appetite meets self-command — you are always balancing the urge to say yes to everything with knowing what actually fits you.',
    trine: 'Warmth and optimism come naturally to you, making it easier to attract good timing when you do not coast on it.',
    square: 'Your ambition reaches further than your calendar, stretching you to grow big without losing sight of the details.',
    sextile: 'Curiosity and confidence open doors easily here; the more generously you put yourself out there, the more comes back.',
  },
  'sun-saturn': {
    opposition: 'Self-expression faces an inner editor — you may feel tested by expectations early on, then grow into quiet, unmistakable authority.',
    trine: 'Identity and discipline reinforce each other, giving you the patience to build things that still look good ten years later.',
    square: 'What you want to shine at meets real resistance, forging self-respect the slow way — through work nobody can take away from you.',
    sextile: 'Your vitality has a steady backbone; steady effort comes more naturally to you than shortcuts ever do.',
  },
  'sun-uranus': {
    opposition: 'Your core self stands across from your need to break the mold, pulling you between belonging and keeping your edge.',
    trine: 'Originality comes to you without trying too hard — you bend the rules smoothly enough that people rarely realize you did.',
    square: 'You bristle at being boxed in; the friction between who you are and what is expected of you keeps you reinventing your path.',
    sextile: 'Fresh perspectives find you easily, letting you update how you live and work without blowing everything up first.',
  },
  'sun-neptune': {
    opposition: 'A clear sense of self faces a porous imagination — learning where you end and other people begin is one of your quiet superpowers.',
    trine: 'Creativity and empathy flow naturally into your identity, giving you an easy feel for mood, beauty, and timing.',
    square: 'Your ideals sit higher than everyday reality, creating a tender tension that fuels art, compassion, and a search for meaning.',
    sextile: 'Intuition quietly informs your choices; when you pause to listen to a hunch, it usually steers you right.',
  },
  'sun-pluto': {
    opposition: 'Your sense of self meets deep intensity, often mirrored through strong personalities who push you to claim your own power.',
    trine: 'Quiet resilience runs straight through your core — you recover from setbacks deeper and steadier than before.',
    square: 'You do not settle for half-measures; pressure strips away what is superficial and leaves you with real self-command.',
    sextile: 'When something in your life has run its course, you have a steady instinct for letting it go and starting cleaner.',
  },

  // ── Moon ──────────────────────────────────────────────────────────
  'moon-mercury': {
    opposition: 'Heart and head pull to opposite corners, making you acutely aware of the gap between what makes sense and what actually feels right.',
    trine: 'Feelings translate smoothly into words for you, making it easy to say what you mean and hear what others leave unsaid.',
    square: 'Your emotions and your logic argue at cross-purposes, sharpening your honesty once you stop trying to out-think a feeling.',
    sextile: 'Instinct and intellect stay in easy conversation, helping you read a room and find the right words in the moment.',
  },
  'moon-venus': {
    opposition: 'What comforts you and what charms you pull from opposite ends, teaching you the difference between pleasing someone and actually feeling fed.',
    trine: 'Warmth, taste, and emotional ease flow together here — people often feel instantly at home around you.',
    square: 'What you crave emotionally and how you show affection can fall out of sync, pushing you to ask clearly for what you really want.',
    sextile: 'Tenderness and good taste reinforce each other, making it easy to create spaces and friendships that feel genuinely warm.',
  },
  'moon-mars': {
    opposition: 'Tenderness faces heat across the chart — your moods can swing between holding back and speaking straight from the gut.',
    trine: 'Emotional honesty and courage move together, giving you quick reflexes and the nerve to stand up for what you care about.',
    square: 'Feelings ignite fast here, turning emotional friction into protective fierceness and real creative momentum.',
    sextile: 'Your instincts and your energy cooperate well, helping you turn a gut feeling into decisive action without burning out.',
  },
  'moon-jupiter': {
    opposition: 'Big-hearted feelings stretch toward excess — you feel things generously and learn over time how to give without emptying your own cup.',
    trine: 'Emotional resilience and quiet optimism come naturally, helping you bounce back with grace and lift the mood around you.',
    square: 'Your heart wants more room than routine allows, nudging you to outgrow small comforts in favor of a fuller life.',
    sextile: 'Warmth and generosity reinforce each other, making hospitality, humor, and perspective easy tools to reach for.',
  },
  'moon-saturn': {
    opposition: 'A real need for closeness faces an instinct to stay guarded — trusting without losing your footing is the quiet work of this line.',
    trine: 'Emotional steadiness comes naturally to you; people lean on your calm when everyone else is spinning.',
    square: 'Feelings run into an inner wall of duty or caution, building deep loyalty and self-reliance as you learn to soften on your own terms.',
    sextile: 'Your feelings have quiet structure behind them, letting you show care in dependable, lasting ways.',
  },
  'moon-uranus': {
    opposition: 'Your need for closeness pulls against your need for space, teaching you how to stay connected without ever feeling caged.',
    trine: 'Emotional freshness and quick intuition come easily — you adapt to sudden turns faster than most people expect.',
    square: 'Restlessness stirs right under your comfort zone, nudging you out of stale routines the moment they stop feeling alive.',
    sextile: 'Openness to change sits comfortably beside your instincts, letting you welcome surprises without losing your center.',
  },
  'moon-neptune': {
    opposition: 'Your own feelings sit across from everyone else’s atmosphere — learning to keep your empathy without absorbing every mood is key.',
    trine: 'Deep intuition and tenderness flow together effortlessly, giving you a natural sensitivity to music, art, and unspoken emotion.',
    square: 'Imagination and feeling amplify each other, creating vivid inner weather that rewards grounding in honest, tangible things.',
    sextile: 'A gentle intuitive streak colors your instincts, helping you sense what someone needs before they have to spell it out.',
  },
  'moon-pluto': {
    opposition: 'Emotional needs meet fierce depth, often played out in close bonds that ask for complete honesty and real transformation.',
    trine: 'Quiet emotional grit runs deep here — you can sit with heavy truths without flinching and come out clearer for it.',
    square: 'Feelings run all the way to the bedrock; emotional friction is rarely casual for you, and it teaches you profound self-trust.',
    sextile: 'You have a natural gift for emotional renewal, able to look honestly at what hurts and turn it into quiet strength.',
  },

  // ── Mercury ───────────────────────────────────────────────────────
  'mercury-venus': {
    sextile: 'Thought and taste meet easily here, giving your words natural grace and an eye for how ideas look and sound.',
  },
  'mercury-mars': {
    opposition: 'Sharp thought faces quick temper — debates energize you, and your best arguments land when you pause half a beat before firing.',
    trine: 'Mind and action move in lockstep; you turn an idea into a finished move faster than most people finish talking about it.',
    square: 'Mental speed and impatience collide, giving you cutting clarity and a restless urge to get straight to the real point.',
    sextile: 'Clear thinking and initiative back each other up, making it easy to speak candidly and follow through on what you say.',
  },
  'mercury-jupiter': {
    opposition: 'Details face the wide horizon — you toggle between checking the facts and chasing the grand theory until both fit together.',
    trine: 'Big-picture intuition and everyday thinking flow straight into each other, making it easy to connect dots and explain what you see.',
    square: 'Your mind leaps ahead of the fine print, stretching you to pair ambitious ideas with enough precision to make them stick.',
    sextile: 'Curiosity and perspective open doors together; learning, writing, and teaching tend to reward you whenever you lean in.',
  },
  'mercury-saturn': {
    opposition: 'Quick ideas meet a demanding skeptic — you test your own thoughts hard, which eventually makes your word carry real weight.',
    trine: 'Clear structure comes naturally to your thinking, letting you organize complex problems calmly and thoroughly.',
    square: 'Self-doubt and high standards wrestle in your head, pushing you to master your craft until your voice is unmistakable.',
    sextile: 'Focus and plainspoken precision work quietly together, helping you turn stray thoughts into dependable plans.',
  },
  'mercury-uranus': {
    opposition: 'Conventional logic faces sudden flashes of insight, keeping your mind alert and allergic to stale conclusions.',
    trine: 'Original connections spark effortlessly — you often arrive at the sideways answer long before the straight path gets there.',
    square: 'Your thoughts jump faster than conversation allows, creating electric curiosity that thrives whenever you have room to experiment.',
    sextile: 'An inventive streak sits lightly beside your everyday mind, making fresh angles and clever fixes easy to spot.',
  },
  'mercury-neptune': {
    opposition: 'Plain facts face daydream and nuance — you are always translating between what is measurable and what can only be felt.',
    trine: 'Words and imagination flow together smoothly, giving you an instinct for story, metaphor, and reading between the lines.',
    square: 'Logic and intuition pull in different directions, blurring neat lines until you learn to trust both what you know and what you sense.',
    sextile: 'Subtlety and imagination enrich how you think, helping you spot creative solutions a strictly linear view would miss.',
  },
  'mercury-pluto': {
    opposition: 'Everyday conversation faces an urge to get to the bone — small talk rarely holds you when something deeper is sitting unsaid.',
    trine: 'Focus and perception cut cleanly together, letting you see straight to the heart of a problem without making a scene.',
    square: 'Your mind does not let go of a question until it cracks open, turning mental intensity into piercing insight.',
    sextile: 'Research, honesty, and quiet observation come easily here — you notice the small detail that explains the whole picture.',
  },

  // ── Venus ─────────────────────────────────────────────────────────
  'venus-mars': {
    opposition: 'Attraction and pursuit pull from opposite poles, creating undeniable chemistry and a lifelong dance between closeness and autonomy.',
    trine: 'Charm and initiative move in easy rhythm — you know how to go after what you love without forcing the moment.',
    square: 'Desire and affection pull at different speeds, generating real creative spark and magnetic friction whenever you channel it.',
    sextile: 'Warmth and boldness cooperate naturally, giving your relationships and creative work an effortless, lively pulse.',
  },
  'venus-jupiter': {
    opposition: 'Taste meets abundance across the chart — you love generously and learn over time that the richest things are the ones you actually savor.',
    trine: 'Ease, warmth, and an eye for beauty come naturally here, drawing good company and small strokes of grace into your orbit.',
    square: 'Your appetite for pleasure and meaning runs larger than ordinary days, pushing you to create beauty instead of merely chasing it.',
    sextile: 'Generosity and charm open doors quietly; kindness and good taste tend to multiply wherever you put them to work.',
  },
  'venus-saturn': {
    opposition: 'An open heart faces a cautious gatekeeper — love deepens for you over time, growing steadier and more honest with every year.',
    trine: 'Loyalty and understated taste come naturally; you value real devotion and craftsmanship that holds up long after trends fade.',
    square: 'Affection meets hesitation or high standards, teaching you that real intimacy begins the moment you stop earning it and let it in.',
    sextile: 'Commitment sits comfortably beside warmth here, giving your relationships and aesthetic choices quiet staying power.',
  },
  'venus-uranus': {
    opposition: 'Desire for closeness pulls against a fierce love of freedom, drawing you toward unconventional bonds that keep both people awake.',
    trine: 'An effortless, offbeat charm sets your taste apart — you gravitate toward original people and beauty nobody else thought to pair.',
    square: 'Routine dulls your heart quickly; the tension between intimacy and independence pushes you to build love on honest, fresh terms.',
    sextile: 'Spontaneity keeps affection lively here, letting friendship and surprise breathe fresh air into what you value.',
  },
  'venus-neptune': {
    opposition: 'Real affection faces a high romantic ideal, teaching you to love people as they actually are without losing your sense of wonder.',
    trine: 'Softness, artistry, and devotion blend effortlessly — beauty moves you deeply, and you have a gentle eye for creating it.',
    square: 'Longing and reality pull against each other, turning romantic idealism into rich creative fuel once you keep one foot on the ground.',
    sextile: 'A quiet romantic sensibility colors what you love, making art, tenderness, and atmosphere easy sources of joy.',
  },
  'venus-pluto': {
    opposition: 'Love meets intensity head-on, drawing you into bonds that change you and ask for honesty all the way down.',
    trine: 'Deep devotion and quiet magnetism come naturally — what you love, you love with lasting, unmistakable presence.',
    square: 'Affection and intensity collide here, stirring strong attachments that teach you the difference between depth and control.',
    sextile: 'Your heart has real staying power and emotional radar, drawn to authentic connection and beauty with weight behind it.',
  },

  // ── Mars ──────────────────────────────────────────────────────────
  'mars-jupiter': {
    opposition: 'Action faces outsized ambition — knowing when to sprint and when to pace yourself turns sheer momentum into lasting results.',
    trine: 'Drive and optimism fuel each other cleanly, giving you natural confidence to bet on yourself and cover real ground.',
    square: 'Big aims meet urgent energy, pushing you to swing hard and learn your real reach by testing the edges.',
    sextile: 'Initiative and good timing work well together; when you say yes to a challenge, energy and opportunity tend to meet you halfway.',
  },
  'mars-saturn': {
    opposition: 'Gas pedal meets brake across the wheel — learning to time your push turns frustration into disciplined, unstoppable grit.',
    trine: 'Energy and endurance reinforce each other, giving you the rare ability to work steadily long after the first burst fades.',
    square: 'Drive runs straight into resistance, building formidable toughness and precision whenever you refuse to quit too early.',
    sextile: 'Controlled effort comes naturally here — you pace your strength well and finish what you start cleanly.',
  },
  'mars-uranus': {
    opposition: 'Willpower faces sudden lightning, teaching you to harness sudden bursts of nerve without burning bridges you still want.',
    trine: 'Quick reflexes and fearless originality move together, letting you pivot cleanly when the room stalls out.',
    square: 'Impatience and a fierce independent streak spark against each other, driving bold breakthroughs whenever you feel hemmed in.',
    sextile: 'Inventiveness energizes how you act, giving you a knack for fresh approaches and decisive, well-timed moves.',
  },
  'mars-neptune': {
    opposition: 'Direct drive faces subtle intuition — you move strongest when your effort serves something you genuinely believe in, not just a checklist.',
    trine: 'Action and imagination flow smoothly together, lending grace, timing, and quiet artistry to what you pursue.',
    square: 'Willpower and daydream pull at right angles, nudging you to turn elusive visions into concrete, step-by-step action.',
    sextile: 'Empathy and quiet inspiration guide your energy well, helping you work creatively without needing brute force.',
  },
  'mars-pluto': {
    opposition: 'Force faces deep resolve across the chart, teaching you when to channel your strength cleanly and when to step out of a power struggle.',
    trine: 'Focused willpower and endurance run deep here — once committed, you can move mountains with surprisingly little noise.',
    square: 'Fierce drive collides with deep intensity, creating immense stamina that does its best work aimed at something worthy of it.',
    sextile: 'Quiet determination backs up everything you pursue, giving you resilience when a project demands a second wind.',
  },

  // ── Jupiter ───────────────────────────────────────────────────────
  'jupiter-saturn': {
    opposition: 'Expansion faces realism across the wheel, teaching you how to dream big while still checking whether the foundation will hold.',
    trine: 'Vision and patience work in quiet partnership, helping you grow steadily in ways that actually last.',
    square: 'The urge to leap pushes against the need to plan, turning careful ambition into real, earned milestones.',
    sextile: 'Optimism and practical judgment balance each other well, letting you spot solid opportunities and build on them.',
  },
  'jupiter-uranus': {
    opposition: 'Big beliefs face sudden disruption, keeping your worldview flexible and ready for the turn nobody saw coming.',
    trine: 'Serendipity and originality travel together — fresh ideas and unexpected breaks tend to open up right when you need room.',
    square: 'A hunger for freedom stretches past safe boundaries, pushing you toward bold detours that widen your whole horizon.',
    sextile: 'Curiosity and openness to the new work easily together, helping you catch rising trends and unusual chances early.',
  },
  'jupiter-neptune': {
    opposition: 'Faith meets boundless imagination, teaching you to keep your sense of wonder while still testing what is actually true.',
    trine: 'Compassion, generosity, and creative vision flow easily here, giving you a wide-angle faith in what is possible.',
    square: 'Big hopes outrun practical limits, fueling vivid dreams that shine brightest when anchored to one real craft.',
    sextile: 'Quiet idealism and kindness reinforce each other, making imagination and generosity easy strengths to draw on.',
  },
  'jupiter-pluto': {
    opposition: 'Growth faces deep transformation, teaching you that real influence comes from depth and integrity rather than sheer scale.',
    trine: 'Resourcefulness and quiet ambition amplify each other, helping you rebuild bigger and wiser whenever a chapter shifts.',
    square: 'Big convictions meet relentless drive, pushing you to aim high and remake whatever feels too small for you.',
    sextile: 'Strategic vision and persistence cooperate well, giving you an instinct for spotting hidden potential and drawing it out.',
  },

  // ── Saturn ────────────────────────────────────────────────────────
  'saturn-uranus': {
    opposition: 'Tradition and reinvention stand face to face — you are wired to bridge what should be kept with what needs to change.',
    trine: 'Structure and originality cooperate cleanly, letting you modernize old systems without losing what makes them work.',
    square: 'The urge to build something solid pushes against the urge to break the mold, keeping your life moving between craft and breakthrough.',
    sextile: 'Practical discipline and fresh thinking reinforce each other, helping you turn unconventional ideas into something durable.',
  },
  'saturn-neptune': {
    opposition: 'Hard reality faces quiet idealism — the work of this line is turning a fragile vision into something tangible without losing its soul.',
    trine: 'Imagination and patience meet smoothly here, giving you a calm knack for bringing subtle ideas down to earth.',
    square: 'Structure and dream pull at cross-purposes, teaching you to strip away illusions while still protecting what inspires you.',
    sextile: 'Quiet focus supports your intuition, making it easier to give creative or spiritual ideals a workable form.',
  },
  'saturn-pluto': {
    opposition: 'Duty faces deep upheaval across the chart, forging rare staying power when old foundations have to be rebuilt from scratch.',
    trine: 'Endurance and quiet authority run hand in hand — you handle long, demanding arcs with calm, methodical resolve.',
    square: 'Pressure and responsibility grind against each other, building unshakable grit and a clear sense of what truly matters.',
    sextile: 'Steady discipline and deep focus back each other up, letting you reshape lasting structures one deliberate move at a time.',
  },

  // ── Uranus ────────────────────────────────────────────────────────
  'uranus-neptune': {
    opposition: 'Awakening faces collective longing — a subtle push-pull between sharp clarity and dissolving old boundaries.',
    trine: 'Intuition and originality move in quiet harmony, attuning you to shifts in culture, art, and technology before they go mainstream.',
    square: 'Restless innovation rubs against deep idealism, stirring a drive to imagine freer ways of living and actually test them.',
    sextile: 'Quiet inventiveness and imagination reinforce each other, lending an easy openness to new ideas and shifting cultural tides.',
  },
  'uranus-pluto': {
    opposition: 'Sudden change meets slow, deep transformation — a potent undercurrent of breaking out of inherited molds for good.',
    trine: 'Evolution and originality flow together smoothly, giving you an instinct for adapting to big shifts without losing your footing.',
    square: 'The urge for freedom collides with deep upheaval, fueling a generational impatience with structures that have stopped working.',
    sextile: 'A quiet current of reinvention runs in the background — an instinct for spotting what is ready to evolve and helping move it along.',
  },

  // ── Neptune ───────────────────────────────────────────────────────
  'neptune-pluto': {
    opposition: 'Collective ideals face deep transformation, reflecting wide cultural shifts in what a whole era holds sacred.',
    trine: 'Intuition and deep renewal move gently together, a long quiet current running beneath the surface of your era.',
    square: 'Deep undercurrents of dream and upheaval press against each other, reshaping collective myths slowly over decades.',
    sextile: 'A subtle undercurrent of imagination and renewal — a quiet background harmony shared across decades of charts.',
  },
};

export function canonicalPairKey(a: string, b: string): string {
  const ia = PLANET_ORDER.indexOf(a);
  const ib = PLANET_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return a < b ? `${a}-${b}` : `${b}-${a}`;
  return ia <= ib ? `${a}-${b}` : `${b}-${a}`;
}

export function pairReading(p1: string, p2: string, aspect: MajorLineAspect): string | null {
  return PAIR_READINGS[canonicalPairKey(p1, p2)]?.[aspect] ?? null;
}
