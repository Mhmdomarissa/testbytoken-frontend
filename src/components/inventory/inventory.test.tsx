import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import {
  UNIQUE_PAGE_SIZE,
  applyFilters,
  countLocatable,
  groupByPage,
  inventoryDisagreement,
  matchesQuery,
  type Element,
} from "./inventory";
import { ElementTable } from "./ElementTable";
import { ModuleSection } from "./ModuleSection";

afterEach(cleanup);

let n = 0;
function el(over: Partial<Element> = {}): Element {
  n += 1;
  return {
    id: `el_${n}`,
    page_url: "https://x.example.com/a",
    label: `Label ${n}`,
    role: "button",
    locator: `#el-${n}`,
    locator_strategy: "css",
    uniquely_locatable: true,
    reason_not_locatable: null,
    ...over,
  };
}
const dup = (over: Partial<Element> = {}) =>
  el({
    uniquely_locatable: false,
    reason_not_locatable: "duplicate_locator",
    ...over,
  });

describe("groupByPage", () => {
  it("groups by page in first-seen order and puts not-unique elements first", () => {
    const a1 = el({ page_url: "https://x/a" });
    const b1 = el({ page_url: "https://x/b" });
    const a2 = dup({ page_url: "https://x/a" });
    const groups = groupByPage([a1, b1, a2]);
    expect(groups.map((g) => g.pageUrl)).toEqual([
      "https://x/a",
      "https://x/b",
    ]);
    expect(groups[0]!.elements).toEqual([a2, a1]);
    expect(groups[0]!.notUnique).toBe(1);
  });
});

describe("filters", () => {
  const items = [
    el({ label: "Submit", role: "button" }),
    el({ label: "Email", role: "textbox", locator: "#email" }),
    dup({ label: "Remove", reason_not_locatable: "duplicate_locator" }),
  ];
  it("searches label, role, locator, page and reason, case-insensitively", () => {
    expect(matchesQuery(items[0]!, "SUBMIT")).toBe(true);
    expect(matchesQuery(items[1]!, "textbox")).toBe(true);
    expect(matchesQuery(items[1]!, "#EMAIL")).toBe(true);
    expect(matchesQuery(items[2]!, "duplicate")).toBe(true);
    expect(matchesQuery(items[0]!, "nope")).toBe(false);
    expect(matchesQuery(items[0]!, "   ")).toBe(true);
  });
  it("a null role and an unrecognised strategy don't break searching", () => {
    const odd = el({
      role: null,
      locator_strategy: new UnrecognisedValue("psychic"),
    });
    expect(matchesQuery(odd, "psychic")).toBe(true);
    expect(matchesQuery(odd, "zzz")).toBe(false);
  });
  it("onlyNotUnique keeps exactly the not-unique ones", () => {
    const out = applyFilters(items, { query: "", onlyNotUnique: true });
    expect(out).toEqual([items[2]]);
  });
});

describe("inventoryDisagreement", () => {
  const mod = { element_count: 3, elements_uniquely_locatable_count: 2 };
  it("is null when the module header and its inventory agree", () => {
    expect(inventoryDisagreement(mod, [el(), el(), dup()])).toBeNull();
  });
  it("names a list shorter than the count it claims to list", () => {
    const text = inventoryDisagreement(mod, [el(), dup()])!;
    expect(text).toMatch(/reports 3 elements .* lists 2/);
  });
  it("names a disagreement about how many are uniquely locatable", () => {
    const text = inventoryDisagreement(mod, [el(), el(), el()])!;
    expect(text).toMatch(/2 uniquely locatable, but the inventory marks 3/);
  });
});

describe("countLocatable", () => {
  it("counts by the flag the server sent, nothing else", () => {
    expect(countLocatable([el(), dup(), dup()])).toEqual({
      total: 3,
      unique: 1,
      notUnique: 2,
    });
  });
});

describe("ElementTable", () => {
  it("never pages away a not-unique element; only well-behaved ones get 'Show more'", () => {
    const uniques = Array.from({ length: UNIQUE_PAGE_SIZE + 5 }, () => el());
    const bad = Array.from({ length: 7 }, () => dup());
    render(<ElementTable caption="c" elements={[...uniques, ...bad]} />);
    expect(document.querySelectorAll('[data-locatable="no"]').length).toBe(7);
    expect(document.querySelectorAll('[data-locatable="yes"]').length).toBe(
      UNIQUE_PAGE_SIZE,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show 5 more" }));
    expect(document.querySelectorAll('[data-locatable="yes"]').length).toBe(
      UNIQUE_PAGE_SIZE + 5,
    );
  });

  it("renders scraped text as text, with the full value in the tooltip, and links nothing", () => {
    const hostile = el({
      label: '<img src=x onerror="alert(1)">',
      locator: "a".repeat(500),
      role: "<b>bold</b>",
    });
    const { container } = render(
      <ElementTable caption="c" elements={[hostile]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText(/onerror/).getAttribute("title")).toContain(
      "onerror",
    );
    expect(
      container.querySelector('td[title^="aaaa"]')!.getAttribute("title"),
    ).toHaveLength(500);
  });

  it("states a missing label and role instead of leaving a blank cell", () => {
    render(
      <ElementTable caption="c" elements={[el({ label: "", role: null })]} />,
    );
    expect(screen.getByText("(no label)")).toBeTruthy();
    expect(screen.getByText("none")).toBeTruthy();
  });

  it("an unrecognised locator strategy is shown as unrecognised, not blank", () => {
    render(
      <ElementTable
        caption="c"
        elements={[el({ locator_strategy: new UnrecognisedValue("psychic") })]}
      />,
    );
    expect(screen.getByText(/unrecognised: psychic/)).toBeTruthy();
  });

  it("a not-unique element says so in words, with its reason, not by colour alone", () => {
    render(
      <ElementTable
        caption="c"
        elements={[dup({ reason_not_locatable: null })]}
      />,
    );
    expect(screen.getByText("Not unique")).toBeTruthy();
    expect(screen.getByText("No reason given")).toBeTruthy();
  });
});

describe("ModuleSection", () => {
  const mod = {
    id: "m1",
    name: "Checkout",
    element_count: 10,
    elements_uniquely_locatable_count: 10,
    pages: [
      {
        id: "p",
        url: "https://x.example.com/a",
        title: "<script>alert(1)</script>",
      },
    ],
  };
  const filters = { query: "", onlyNotUnique: false };

  it("flags an inventory that disagrees with the module's own counts", () => {
    render(
      <ModuleSection
        module={mod}
        inventory={{ status: "ready", elements: [el(), el()] }}
        filters={filters}
      />,
    );
    expect(screen.getByTestId("inventory-disagreement").textContent).toMatch(
      /incomplete/i,
    );
  });

  it("says a module with nothing uniquely locatable has nothing uniquely locatable", () => {
    const m = {
      ...mod,
      element_count: 2,
      elements_uniquely_locatable_count: 0,
    };
    render(
      <ModuleSection
        module={m}
        inventory={{ status: "ready", elements: [dup(), dup()] }}
        filters={filters}
      />,
    );
    expect(screen.getByTestId("module-none-locatable")).toBeTruthy();
    expect(screen.queryByTestId("inventory-disagreement")).toBeNull();
  });

  it("a scraped page title is inert text", () => {
    const { container } = render(
      <ModuleSection
        module={{
          ...mod,
          element_count: 1,
          elements_uniquely_locatable_count: 1,
        }}
        inventory={{ status: "ready", elements: [el()] }}
        filters={filters}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("one module failing is a retryable error in place, not a blank", () => {
    let retried = 0;
    render(
      <ModuleSection
        module={mod}
        inventory={{
          status: "error",
          message: "boom",
          retry: () => (retried += 1),
        }}
        filters={filters}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(1);
  });

  it("filtering states how many it is showing of how many there are", () => {
    const m = {
      ...mod,
      element_count: 2,
      elements_uniquely_locatable_count: 2,
    };
    render(
      <ModuleSection
        module={m}
        inventory={{
          status: "ready",
          elements: [el({ label: "Alpha" }), el({ label: "Beta" })],
        }}
        filters={{ query: "alpha", onlyNotUnique: false }}
      />,
    );
    expect(
      screen.getByText(/Showing 1 of 2 elements in this module/),
    ).toBeTruthy();
  });
});
