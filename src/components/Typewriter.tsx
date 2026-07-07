import { useEffect, useRef, useState } from "react";

/** Typewriter reveal. Click anywhere on the text to reveal instantly. */
export default function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setShown(0);
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 400)); // ~3–4s for long passages
    const timer = setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(i);
      if (i >= text.length) {
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, 12);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const finished = shown >= text.length;

  return (
    <span
      onClick={() => {
        if (!finished) {
          setShown(text.length);
          if (!doneRef.current) {
            doneRef.current = true;
            onDone?.();
          }
        }
      }}
      className={finished ? "" : "caret cursor-pointer"}
      title={finished ? undefined : "Click to reveal"}
    >
      {text.slice(0, shown)}
    </span>
  );
}
