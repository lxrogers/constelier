import { useId } from 'react';
import { layout } from '@/modules/prototypes/sun-arcs-params';
export default function Outline({ params }) {
  const id = useId().replace(/:/g, ''), plan = layout(params);
  let artwork = <g><circle cx={plan.sun.x} cy={plan.sun.y} r={plan.sun.radius} />{plan.rays.map((points, i) => <polygon key={i} points={points.map(p => p.join(',')).join(' ')} />)}</g>;
  plan.groups.forEach((group, i) => {
    artwork = <g><g mask={`url(#${id}-mask-${i})`}>{artwork}</g>{group.rings.map((r, j) => <circle key={j} cx={group.x} cy={group.y} r={r - params.stroke / 2} fill="none" stroke="currentColor" strokeWidth={params.stroke} />)}</g>;
  });
  return <figure className="sun-outline"><figcaption>Live 2D outline <small>Updates as you drag</small></figcaption><svg viewBox="-17 -17 34 34" role="img" aria-label="Live pendant outline" data-params={JSON.stringify(params)}><defs><clipPath id={`${id}-clip`}><circle r={plan.radius} /></clipPath>{plan.groups.map((group, i) => <mask key={i} id={`${id}-mask-${i}`} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><rect x="-60" y="-60" width="120" height="120" fill="white" /><circle cx={group.x} cy={group.y} r={group.maskRadius} fill="black" /></mask>)}</defs><g fill="currentColor" clipPath={`url(#${id}-clip)`}>{artwork}<circle r={plan.radius - plan.rim / 2} fill="none" stroke="currentColor" strokeWidth={plan.rim} /></g></svg><small>Depth affects the 3D mesh only.</small></figure>;
}
