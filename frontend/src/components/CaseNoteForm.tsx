import { FormEvent, useState } from "react";

interface CaseNoteFormProps {
  roleName: string | undefined;
  disabled?: boolean;
  onSubmit: (content: string) => void;
}

export function CaseNoteForm({
  roleName,
  disabled,
  onSubmit,
}: CaseNoteFormProps) {
  const [note, setNote] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (note.trim()) {
      onSubmit(note);
      setNote("");
    }
  };

  const isAgent = roleName === "agent";

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      <label htmlFor="case-note">
        {isAgent ? "Request operational support" : "Add case note"}
      </label>
      <textarea
        id="case-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Record context without sensitive or real customer information."
      />
      <button className="button primary" disabled={!note.trim() || disabled}>
        Add to timeline
      </button>
    </form>
  );
}
