"use client";

import { useState } from "react";
import { X } from "lucide-react";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseEmails(value: string) {
  return value
    .split(/[\s,;\n]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

export function EmailChipsInput({
  value,
  onChange,
  placeholder = "Add email...",
  disabled = false,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);

  function commit(raw: string) {
    const candidates = parseEmails(raw);
    if (!candidates.length) return;

    const valid = candidates.filter(isValidEmail);
    const invalidEmails = candidates.filter((email) => !isValidEmail(email));
    const next = Array.from(new Set([...value.map(normalizeEmail), ...valid]));

    onChange(next);
    setInvalid(invalidEmails);
    setDraft("");
  }

  function remove(email: string) {
    onChange(value.filter((item) => item !== email));
  }

  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 focus-within:border-[#d7ff3f]/50">
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-2 rounded-full border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-1 text-xs font-semibold text-[#d7ff3f]">
            {email}
            <button type="button" onClick={() => remove(email)} disabled={disabled} className="rounded-full p-0.5 hover:bg-white/15 disabled:opacity-40" aria-label={`Remove ${email}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (/[\s,;\n]/.test(next)) commit(next);
            else {
              setDraft(next);
              setInvalid([]);
            }
          }}
          onKeyDown={(event) => {
            if (["Enter", "Tab", ",", ";"].includes(event.key)) {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && !draft && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (/[\s,;\n]/.test(pasted)) {
              event.preventDefault();
              commit(`${draft} ${pasted}`);
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[160px] flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
      </div>
      {invalid.length > 0 ? <p className="mt-2 text-xs font-medium text-amber-300">Invalid email ignored: {invalid.join(", ")}</p> : null}
    </div>
  );
}
