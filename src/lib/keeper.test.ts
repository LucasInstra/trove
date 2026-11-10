import { describe, expect, it } from "vitest";
import { KEEPER_DEFAULT, loadLook, saveLook } from "./keeper";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  seed(value: unknown) {
    this.data.set("trove.keeper.v1", typeof value === "string" ? value : JSON.stringify(value));
  }

  raw() {
    return this.data.get("trove.keeper.v1") ?? null;
  }
}

describe("loadLook", () => {
  it("returns the default when there is nothing stored", () => {
    const storage = new MemoryStorage();
    expect(loadLook(storage)).toEqual(KEEPER_DEFAULT);
    expect(storage.raw()).toBeNull();
  });

  it("keeps a valid saved look", () => {
    const storage = new MemoryStorage();
    storage.seed({ ...KEEPER_DEFAULT, color: "#0f6b4f", snout: false });
    const look = loadLook(storage);
    expect(look.color).toBe("#0f6b4f");
    expect(look.snout).toBe(false);
  });

  it("rejects a colour that is not a six digit hex", () => {
    for (const color of [null, 12, "red", "#fff", "#12345g", ""]) {
      const storage = new MemoryStorage();
      storage.seed({ ...KEEPER_DEFAULT, color });
      expect(loadLook(storage).color).toBe(KEEPER_DEFAULT.color);
    }
  });

  it("rejects a shape or eye style that no longer exists", () => {
    const storage = new MemoryStorage();
    storage.seed({ ...KEEPER_DEFAULT, shape: "star", eyeStyle: "ring" });
    const look = loadLook(storage);
    expect(look.shape).toBe(KEEPER_DEFAULT.shape);
    expect(look.eyeStyle).toBe(KEEPER_DEFAULT.eyeStyle);
  });

  it("rejects booleans that are not booleans", () => {
    const storage = new MemoryStorage();
    storage.seed({ ...KEEPER_DEFAULT, snout: "false", ears: 0, tail: null });
    const look = loadLook(storage);
    expect(look.snout).toBe(KEEPER_DEFAULT.snout);
    expect(look.ears).toBe(KEEPER_DEFAULT.ears);
    expect(look.tail).toBe(KEEPER_DEFAULT.tail);
  });

  it("survives invalid json and a storage that throws", () => {
    const broken = new MemoryStorage();
    broken.seed("{not json");
    expect(loadLook(broken)).toEqual(KEEPER_DEFAULT);

    const hostile = {
      getItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadLook(hostile)).toEqual(KEEPER_DEFAULT);
  });

  it("writes a repaired value back once", () => {
    const storage = new MemoryStorage();
    storage.seed({ ...KEEPER_DEFAULT, shape: "star", eyeStyle: "arcs" });
    loadLook(storage);
    expect(storage.raw()).toContain('"shape":"round"');
    expect(storage.raw()).toContain('"eyeStyle":"arcs"');
    expect(storage.raw()).not.toContain("star");
  });

  it("never returns the shared default object", () => {
    const look = loadLook(new MemoryStorage());
    expect(look).not.toBe(KEEPER_DEFAULT);
    look.color = "#000000";
    expect(KEEPER_DEFAULT.color).toBe("#f0a2b2");
  });
});

describe("saveLook", () => {
  it("round trips", () => {
    const storage = new MemoryStorage();
    saveLook({ ...KEEPER_DEFAULT, eyeStyle: "heart", color: "#0f6b4f" }, storage);
    const look = loadLook(storage);
    expect(look.eyeStyle).toBe("heart");
    expect(look.color).toBe("#0f6b4f");
  });

  it("does not throw without storage", () => {
    expect(() => saveLook(KEEPER_DEFAULT, null)).not.toThrow();
  });
});
