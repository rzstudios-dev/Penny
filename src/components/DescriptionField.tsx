import { useId, useRef, useState } from "react";
import Icon from "./Icon";

export default function DescriptionField({
  value,
  onChange,
  saved,
  saveForLater,
  onSaveForLater,
  onRemove,
}: {
  value: string;
  onChange: (text: string) => void;
  saved: string[];
  saveForLater: boolean;
  onSaveForLater: (checked: boolean) => void;
  onRemove: (text: string) => void;
}) {
  const [open, setOpen] = useState(false),
    labelId = useId(),
    input = useRef<HTMLInputElement>(null);
  const matches = saved
      .filter(
        (text) => !value || text.toLowerCase().includes(value.toLowerCase()),
      )
      .slice(0, 8),
    isSaved = saved.some((text) => text.toLowerCase() === value.trim().toLowerCase());
  return (
    <div
      className="description-control"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label id={labelId} htmlFor={`${labelId}-input`}>
        Title
      </label>
      <div className="description-input">
        <input
          ref={input}
          id={`${labelId}-input`}
          value={value}
          required
          maxLength={160}
          autoComplete="off"
          placeholder="Coffee, groceries, payday…"
          aria-controls={`${labelId}-saved`}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      <button
        type="button"
        className={`save-title-action ${saveForLater || isSaved ? "selected" : ""}`}
        role="switch"
        aria-checked={saveForLater || isSaved}
        disabled={isSaved}
        onClick={() => onSaveForLater(!saveForLater)}
      >
        <span className="save-title-action-label">
          <Icon name="bookmark" size={17} />
          {isSaved ? "Title already saved" : "Save title for later"}
        </span>
        <span className="save-title-switch" aria-hidden="true"><span /></span>
      </button>
      {open && matches.length > 0 && (
        <div
          id={`${labelId}-saved`}
          className="saved-descriptions"
          aria-label="Saved titles"
        >
          <small>Saved titles</small>
          {matches.map((text) => (
            <div className="saved-title-row" key={text}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(text);
                  setOpen(false);
                  input.current?.focus();
                }}
              >
                <Icon name="reset" size={14} />
                <span>{text}</span>
              </button>
              <button
                className="remove-saved-title"
                type="button"
                aria-label={`Remove saved title ${text}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(text)}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
