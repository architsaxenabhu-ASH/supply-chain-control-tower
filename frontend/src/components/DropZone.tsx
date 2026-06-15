import { useRef, useState, type ReactNode } from "react";

// A click-or-drag file picker. Wraps a hidden <input type="file"> so the same
// area works by clicking to browse or dragging a file onto it — friendlier for
// someone who just wants to drop a scan in and move on.

export function DropZone({
  onFile,
  disabled = false,
  multiple = false,
  className = "",
  ariaLabel,
  children,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | null) {
    if (!list || disabled) return;
    const files = multiple ? Array.from(list) : list[0] ? [list[0]] : [];
    for (const file of files) onFile(file);
  }

  return (
    <div
      className={`dropzone${over ? " is-over" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        hidden
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
