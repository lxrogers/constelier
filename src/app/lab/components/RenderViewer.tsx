'use client';

import { useEffect } from 'react';
import { renderImageUrl, type RenderJob } from '@/lib/lab-render';

interface Props {
  job: RenderJob;
  sceneLabel: string;
  onClose: () => void;
}

// Full-size view of one finished render, with a download link.
export default function RenderViewer({ job, sceneLabel, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const file = `${job.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${job.scene}.png`;

  return (
    <div className="lab-viewer" role="dialog" aria-modal="true" aria-label={`${job.label}, ${sceneLabel}`} onClick={onClose}>
      <div className="lab-viewer-inner" onClick={(e) => e.stopPropagation()}>
        <img src={renderImageUrl(job)} alt={`${job.label}, ${sceneLabel}`} />
        <div className="lab-viewer-bar">
          <span>{job.label} · {sceneLabel} · {job.quality}</span>
          <span className="lab-viewer-actions">
            <a className="lab-btn" href={renderImageUrl(job)} download={file}>Download PNG</a>
            <button type="button" className="lab-btn primary" onClick={onClose}>Close</button>
          </span>
        </div>
      </div>
    </div>
  );
}
