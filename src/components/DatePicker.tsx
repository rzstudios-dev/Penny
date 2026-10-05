import { useEffect, useId, useRef, useState } from "react";
import { dateKey, formatDate, type Settings } from "../lib/model";
import Select from "./Select";
import Icon from "./Icon";

export default function DatePicker({
  value,
  onChange,
  order,
  label = "Date",
}: {
  value: string;
  onChange: (date: string) => void;
  order: Settings["dateOrder"];
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(() => new Date(value + "T12:00:00"));
  const control = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    selectedDay = useRef<HTMLButtonElement>(null),
    labelId = useId();
  useEffect(() => {
    if (open) selectedDay.current?.focus();
  }, [open, month]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (
        !control.current?.contains(e.target as Node) &&
        !(e.target as Element).closest(".select-menu")
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  const year = month.getFullYear(),
    index = month.getMonth(),
    days = new Date(year, index + 1, 0).getDate(),
    offset = (new Date(year, index, 1).getDay() + 6) % 7;
  function choose(date: string) {
    onChange(date);
    setOpen(false);
    trigger.current?.focus();
  }
  function shift(delta: number) {
    const next = new Date(year, index + delta, 1);
    if (next.getFullYear() >= 1900 && next.getFullYear() <= 2200)
      setMonth(next);
  }
  return (
    <div
      className="date-control"
      ref={control}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <span id={labelId} className="field-label">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="date-trigger"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(new Date(value + "T12:00:00"));
          setOpen(!open);
        }}
      >
        <Icon name="calendar" size={19} />
        <span>{formatDate(value, order)}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="penny-calendar" role="dialog" aria-label="Choose date">
          <div className="calendar-heading">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <Icon name="left" size={18} />
            </button>
            <Select
              aria-label="Calendar month"
              value={index}
              onChange={(e) =>
                setMonth(new Date(year, Number(e.target.value), 1))
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(2000, i, 1).toLocaleDateString("en", {
                    month: "short",
                  })}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Calendar year"
              value={year}
              onChange={(e) =>
                setMonth(new Date(Number(e.target.value), index, 1))
              }
            >
              {Array.from({ length: 301 }, (_, i) => (
                <option key={i} value={1900 + i}>
                  {1900 + i}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="icon-button"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <Icon name="right" size={18} />
            </button>
          </div>
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <span key={i}>{day}</span>
              ))}
            </div>
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = new Date(year, index, i + 1),
                key = dateKey(date);
              return (
                <button
                  ref={key === value ? selectedDay : undefined}
                  type="button"
                  key={key}
                  className={`${key === value ? "selected" : ""} ${key === dateKey() ? "today" : ""}`}
                  aria-label={date.toLocaleDateString("en", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  aria-pressed={key === value}
                  onClick={() => choose(key)}
                  onKeyDown={(e) => {
                    const delta = {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                    }[e.key];
                    if (delta) {
                      e.preventDefault();
                      const next = new Date(year, index, i + 1 + delta);
                      if (next.getMonth() !== index)
                        setMonth(
                          new Date(next.getFullYear(), next.getMonth(), 1),
                        );
                      else
                        control.current
                          ?.querySelector<HTMLButtonElement>(
                            `[data-date="${dateKey(next)}"]`,
                          )
                          ?.focus();
                    }
                  }}
                  data-date={key}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => choose(dateKey())}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
