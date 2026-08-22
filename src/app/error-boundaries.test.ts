import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";

describe("error boundaries", () => {
  it("preserves the segment recovery UI and digest reference", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorPage, {
        error: Object.assign(new Error("failure"), { digest: "digest-123" }),
        reset: () => undefined,
      }),
    );

    expect(html).toContain("No se pudo completar");
    expect(html).toContain("Referencia: digest-123");
    expect(html).toContain("Reintentar");
  });

  it("renders an HTML document for root-layout failures", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalError, { error: new Error("failure"), reset: () => undefined }),
    );

    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
    expect(html).toContain("Reintentar");
  });
});
