"use client";

import {
  useSaveDataPreference,
  writeSaveDataPreference,
  type SaveDataPreference,
} from "@/components/use-save-data";

export function DataSaverToggle() {
  const value = useSaveDataPreference();

  return (
    <section className="panel max-w-md">
      <header className="panel-head">
        <h2 className="panel-title">Datos móviles</h2>
      </header>
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted">
          Con mala señal: las fotos no se bajan hasta que las toques, y la búsqueda filtra en el teléfono. El servidor espera a Buscar.
        </p>
        <label className="block">
          <span className="label">Ahorro de datos</span>
          <select
            className="field"
            value={value}
            onChange={(event) => writeSaveDataPreference(event.target.value as SaveDataPreference)}
          >
            <option value="auto">Automático (asume red mala)</option>
            <option value="on">Siempre</option>
            <option value="off">Nunca</option>
          </select>
        </label>
      </div>
    </section>
  );
}
