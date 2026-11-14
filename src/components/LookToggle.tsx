import { useEffect, useState } from "react";
import newLook from "../styles/look-new.css?inline";

const KEY = "trove.look";

/** Test switch: the new look is a stylesheet added on top; removing it shows the previous look. */
export function LookToggle() {
  const [isNew, setIsNew] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "before";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isNew) return;
    const style = document.createElement("style");
    style.dataset.look = "new";
    style.textContent = newLook;
    document.head.appendChild(style);
    return () => style.remove();
  }, [isNew]);

  const toggle = () => {
    const next = !isNew;
    setIsNew(next);
    try {
      localStorage.setItem(KEY, next ? "new" : "before");
    } catch {
      /* the choice just is not remembered */
    }
  };

  return (
    <button
      type="button"
      className="look-toggle"
      onClick={toggle}
      aria-pressed={isNew}
      title="Compare the new look with the one from before"
    >
      {isNew ? "Visual: novo" : "Visual: antes"}
    </button>
  );
}
