"use client";

import { useEffect } from "react";

export function UploadSuccess() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("uploaded");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, []);

  return <p className="banner banner-ok">Foto guardada. Seguí con el próximo requisito.</p>;
}
