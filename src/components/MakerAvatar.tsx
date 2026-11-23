import Image from 'next/image';
import { MAKER } from '@/config/maker';
import './MakerAvatar.css';

// Circular maker portrait, falling back to a quiet serif monogram until
// MAKER.photoSrc is pointed at a real photograph.
export default function MakerAvatar({ size = 44 }: { size?: number }) {
  return (
    <span
      className="maker-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      aria-hidden={MAKER.photoSrc ? undefined : true}
    >
      {MAKER.photoSrc ? (
        <Image src={MAKER.photoSrc} alt={MAKER.name} fill sizes={`${size}px`} />
      ) : (
        MAKER.initial
      )}
    </span>
  );
}
