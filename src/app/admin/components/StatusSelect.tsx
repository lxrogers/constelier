'use client';

// The status dropdown on a request: saves as soon as it changes.
export default function StatusSelect({ action, value, options }: {
  action: (form: FormData) => void | Promise<void>;
  value: string;
  options: { id: string; label: string }[];
}) {
  return (
    <form action={action} className="admin-status-form">
      <label htmlFor="request-status">Status</label>
      <select id="request-status" name="status" defaultValue={value} key={value} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </form>
  );
}
