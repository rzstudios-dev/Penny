import { useEffect, useRef, useState } from "react";
import type { SpendingTip } from "../lib/tips";
import Icon from "./Icon";

export default function ReportsTips({ tips }: { tips: SpendingTip[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (tips.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const element = viewport.current;
      if (!element) return;
      const next = (Math.round(element.scrollLeft / element.clientWidth) + 1) % tips.length;
      element.scrollTo({ left: next * element.clientWidth, behavior: "smooth" });
    }, 6200);
    return () => window.clearInterval(timer);
  }, [tips.length, paused]);

  return (
    <section className="reports-tips" id="reports-tip" aria-label="Monthly spending tips" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="reports-tips-mark"><Icon name="leaf" size={17} /></span>
      <div className="reports-tips-viewport" ref={viewport} onScroll={(event) => {
        const element = event.currentTarget;
        setActive(Math.min(tips.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
      }}>
        {tips.map((tip) => <p className="reports-tip-slide" key={tip.key}>{tip.text}</p>)}
      </div>
      {tips.length > 1 && <div className="reports-tips-dots" aria-hidden="true">{tips.map((tip, index) => <span className={index === active ? "active" : ""} key={tip.key} />)}</div>}
    </section>
  );
}
