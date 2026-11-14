import { describe, expect, it } from "vitest";
import { initialsOf } from "./avatar";

describe("initialsOf", () => {
  it("uses the first letter of the first and last name, two at most", () => {
    expect(initialsOf("Lucas Langel")).toBe("LL");
    expect(initialsOf("maria da silva souza")).toBe("MS");
  });

  it("falls back to one letter, and to nothing", () => {
    expect(initialsOf("Lucas")).toBe("L");
    expect(initialsOf("   ")).toBe("");
    expect(initialsOf("ana  --  Álvares")).toBe("AÁ");
  });
});
