import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
type Option = { value: string; label: ReactNode; disabled?: boolean };
export default function Select({
  children,
  value,
  onChange,
  disabled,
  className = "",
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const options: Option[] = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const option = child.props as {
        value?: string | number;
        children: ReactNode;
        disabled?: boolean;
      };
      return {
        value: String(option.value ?? option.children),
        label: option.children,
        disabled: option.disabled,
      };
    });
  const selected = options.find((o) => o.value === String(value)) || options[0],
    listId = `select-${generatedId}`;
  function show() {
    if (disabled) return;
    const rect = trigger.current!.getBoundingClientRect(),
      estimatedHeight = Math.min(270, options.length * 42 + 12);
    setPosition({
      left: Math.min(rect.left, innerWidth - rect.width - 12),
      width: rect.width,
      top:
        innerHeight - rect.bottom < estimatedHeight &&
        rect.top > estimatedHeight
          ? rect.top - estimatedHeight - 6
          : rect.bottom + 6,
    });
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === String(value)),
      ),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
        ?.focus();
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const reposition = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);
  return (
    <div className={`select-control ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{selected?.label || "Choose an option"}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="select-menu"
            id={listId}
            role="listbox"
            aria-label={props["aria-label"] || "Choose an option"}
            style={position}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                trigger.current?.focus();
              } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive(
                  (a) =>
                    (a + (e.key === "ArrowDown" ? 1 : options.length - 1)) %
                    options.length,
                );
              } else if (e.key === "Home") {
                e.preventDefault();
                setActive(0);
              } else if (e.key === "End") {
                e.preventDefault();
                setActive(options.length - 1);
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose(active);
              } else if (e.key === "Tab") {
                e.preventDefault();
                setOpen(false);
                trigger.current?.focus();
              } else if (e.key.length === 1) {
                const match = options.findIndex((o) =>
                  String(o.label).toLowerCase().startsWith(e.key.toLowerCase()),
                );
                if (match >= 0) setActive(match);
              }
            }}
          >
            {options.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === String(value)}
                disabled={option.disabled}
                data-option-index={index}
                tabIndex={-1}
                className={option.value === String(value) ? "selected" : ""}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === String(value) && (
                  <Icon name="check" size={16} />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
