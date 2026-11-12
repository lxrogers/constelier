import { LEGAL_DRAFT } from '../policy';

export default function DraftBanner() {
  if (!LEGAL_DRAFT) return null;
  return (
    <div className="legal-draft" role="note">
      <strong>Draft for review.</strong> Not legal advice, and not yet in force. Bracketed text needs
      filling in and highlighted text is a suggestion to confirm. Have a lawyer read these before launch.
    </div>
  );
}
