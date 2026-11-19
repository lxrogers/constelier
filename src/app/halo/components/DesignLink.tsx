import type { AnchorHTMLAttributes } from 'react';
import { DESIGN_PATH } from '../content';

// A link into the configurator. A plain <a>, so the browser loads the page
// afresh instead of swapping it in place. The configurator fills the screen
// and never scrolls; Chrome on iPhone, entering it in place from a page
// whose toolbars were scrolled away, brought the toolbars back over the top
// of it and left a gap underneath, with no scrolling to put that right.
export default function DesignLink(props: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <a {...props} href={DESIGN_PATH} />;
}
