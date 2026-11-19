"use client";

import { useId, useState } from "react";

/**
 * Parte de uma lista que abre com um botão no fim ("Ver mais" / "Ver menos").
 * Abre deslizando; fechada, os links de dentro não recebem foco.
 */
export function ShowMore({
  children,
  more,
  less = "Ver menos",
}: {
  children: React.ReactNode;
  more: React.ReactNode;
  less?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div
        id={id}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
      <div className="flex justify-center px-4 pt-1.5 pb-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-[14px] font-semibold text-ink-2 hover:bg-line/70 active:scale-[0.98]"
        >
          {open ? less : more}
          <svg
            viewBox="0 0 24 24"
            className={`size-4 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </>
  );
}
