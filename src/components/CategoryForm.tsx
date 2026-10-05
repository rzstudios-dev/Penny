import { useRef, useState, type FormEvent } from "react";
import {
  calculate,
  id,
  SCALE,
  type Category,
  type Settings,
} from "../lib/model";
import Icon from "./Icon";
const colors = ["peach", "sage", "lavender", "yellow", "blue", "pink"] as const;
export const categoryIcons = [
  "fork",
  "basket",
  "coffee",
  "bag",
  "car",
  "house",
  "heart",
  "game",
  "plane",
  "study",
  "pet",
  "sparkle",
  "gift",
  "tshirt",
  "coins",
  "flower",
  "briefcase",
  "baby",
  "film",
  "pizza",
  "drop",
  "electricity",
  "phone",
  "wifi",
  "dog",
  "cat",
  "bicycle",
  "train",
  "book",
  "music",
  "gym",
  "bed",
  "art",
  "camera",
  "suitcase",
  "repair",
  "wine",
  "haircut",
  "desktop",
  "store",
];
export default function CategoryForm({
  initial,
  settings,
  premium,
  onPremium,
  onSave,
  onDelete,
  hasHistory,
}: {
  initial?: Category;
  settings: Settings;
  premium: boolean;
  onPremium: () => void;
  onSave: (category: Category) => void;
  onDelete?: () => void;
  hasHistory?: boolean;
}) {
  const [name, setName] = useState(initial?.name || ""),
    [budget, setBudget] = useState(
      initial?.budget
        ? String(initial.budget / SCALE).replace(".", settings.decimalMark)
        : "",
    ),
    [icon, setIcon] = useState(initial?.icon || "fork"),
    [color, setColor] = useState<Category["color"]>(initial?.color || "peach"),
    [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const iconTouchStart = useRef<number | null>(null);
  const [iconPage, setIconPage] = useState(() =>
    premium ? Math.max(0, Math.floor(categoryIcons.indexOf(initial?.icon || "fork") / 8)) : 0,
  );
  const available = categoryIcons.slice(0, premium ? 40 : 16);
  const pageCount = Math.ceil(available.length / 8);
  const visibleIcons = premium
    ? available.slice(iconPage * 8, (iconPage + 1) * 8)
    : expanded ? available : available.slice(0, 8);
  if (!visibleIcons.includes(icon) && !premium) visibleIcons.push(icon);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!name.trim()) throw new Error("Give your envelope a name.");
      onSave({
        id: initial?.id || id(),
        name: name.trim(),
        budget:
          budget && Number(budget.replace(",", ".")) !== 0
            ? calculate(budget, settings.decimalMark)
            : 0,
        icon,
        color,
        walletBudgets: initial?.walletBudgets || {},
        walletId: initial?.walletId || "",
      });
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Envelope name
        <input
          value={name}
          maxLength={40}
          required
          placeholder="Something you care about"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Monthly budget · {settings.currency}
        <input
          value={budget}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(e) => setBudget(e.target.value)}
        />
        <small>
          Leave empty for no limit. Your spending history always stays.
        </small>
      </label>
      <label>Envelope icon</label>
      <div
        key={premium ? iconPage : "free"}
        className={`icon-picker ${premium ? "icon-picker-paged" : ""}`}
        onTouchStart={premium ? (event) => { iconTouchStart.current = event.touches[0].clientX; } : undefined}
        onTouchEnd={premium ? (event) => {
          if (iconTouchStart.current === null) return;
          const distance = event.changedTouches[0].clientX - iconTouchStart.current;
          if (Math.abs(distance) > 45) setIconPage((page) => Math.min(pageCount - 1, Math.max(0, page + (distance < 0 ? 1 : -1))));
          iconTouchStart.current = null;
        } : undefined}
      >
        {visibleIcons.map((n) => (
          <button
            type="button"
            className={icon === n ? "picked" : ""}
            aria-label={`Choose ${n} icon`}
            aria-pressed={icon === n}
            key={n}
            onClick={() => setIcon(n)}
          >
            <Icon name={n} size={25} />
          </button>
        ))}
      </div>
      {premium ? (
        <div className="icon-pagination" aria-label="Icon pages">
          <button type="button" className="icon-button" aria-label="Previous icons" disabled={iconPage === 0} onClick={() => setIconPage(iconPage - 1)}><Icon name="left" size={18} /></button>
          <span>{iconPage + 1} / {pageCount}</span>
          <button type="button" className="icon-button" aria-label="See more icons" disabled={iconPage === pageCount - 1} onClick={() => setIconPage(iconPage + 1)}><Icon name="right" size={18} /></button>
        </div>
      ) : (
        <button
          type="button"
          className="icon-expand text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "See more"}
          <Icon name={expanded ? "up" : "chevron"} size={16} />
        </button>
      )}
      {!premium && (
        <button
          type="button"
          className="icon-premium-preview"
          onClick={onPremium}
          aria-label="Unlock 24 more icons with Premium"
        >
          <span className="icon-preview-art" aria-hidden="true">
            {categoryIcons.slice(16, 20).map((n) => (
              <Icon key={n} name={n} size={23} />
            ))}
          </span>
          <span>
            <Icon name="crown" size={17} />
            24 more with Premium
          </span>
          <Icon name="right" size={16} />
        </button>
      )}
      <label>And a color</label>
      <div className="color-picker">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Choose ${c}`}
            aria-pressed={color === c}
            className={`color-${c} ${color === c ? "picked" : ""}`}
            onClick={() => setColor(c)}
          >
            {color === c && <Icon name="check" />}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        <Icon name="check" />
        {initial ? "Save envelope" : "Create envelope"}
      </button>
      {initial && onDelete && (
        <>
          <button
            type="button"
            className="button danger full"
            disabled={hasHistory}
            onClick={onDelete}
          >
            Delete envelope
          </button>
          {hasHistory && (
            <small>
              This envelope has transactions. Move or delete those entries
              before deleting the envelope.
            </small>
          )}
        </>
      )}
    </form>
  );
}
