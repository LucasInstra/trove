import { describe, expect, it } from "vitest";
import { highlights, summary } from "./highlights";

const notes = `# trove 0.8.4

The ledger counts the salary.

## Improved

- **Salary in the ledger summary.** "In" now includes the salary.
- **Crypto notice.** It only closes with "Turn on".
- A plain bullet. With a second sentence.
`;

describe("release highlights", () => {
  it("takes the bold lead-in of each bullet, or the first sentence", () => {
    expect(highlights(notes)).toEqual([
      { title: "Salary in the ledger summary", detail: '"In" now includes the salary.' },
      { title: "Crypto notice", detail: 'It only closes with "Turn on".' },
      { title: "A plain bullet", detail: "With a second sentence." },
    ]);
  });

  it("stops at the limit", () => {
    expect(highlights(notes, 2)).toHaveLength(2);
  });

  it("reads the line under the title as the summary", () => {
    expect(summary(notes)).toBe("The ledger counts the salary.");
    expect(summary("")).toBe("");
  });
});
