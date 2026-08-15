"use client";

import { useState } from "react";
import { formatDateInput } from "@/lib/time";

function maskDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function ForcedDateInput({ defaultDate }: { defaultDate: string }) {
  const [value, setValue] = useState(() => formatDateInput(defaultDate));

  return (
    <input
      type="text"
      name="fecha"
      value={value}
      onChange={(event) => {
        event.currentTarget.setCustomValidity("");
        setValue(maskDate(event.currentTarget.value));
      }}
      onInvalid={(event) => {
        event.currentTarget.setCustomValidity("Ingresá una fecha con formato DD/MM/AAAA");
      }}
      inputMode="numeric"
      autoComplete="off"
      placeholder="DD/MM/AAAA"
      pattern="\d{2}/\d{2}/\d{4}"
      maxLength={10}
      title="Usá el formato DD/MM/AAAA"
      aria-describedby="date-format-help"
      className="field font-mono"
    />
  );
}
