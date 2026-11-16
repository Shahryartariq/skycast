import { describe, expect, it } from "vitest";

import { COLD_TO, HOT_FROM, effectFor } from "./effects";

describe("background effect", () => {
  it("shows what's falling first", () => {
    expect(effectFor("rain", 40)).toBe("rain");
    expect(effectFor("drizzle", 20)).toBe("rain");
    expect(effectFor("thunder", 30)).toBe("rain");
    expect(effectFor("snow", -4)).toBe("snow");
  });

  it("otherwise goes by how hot or cold it feels", () => {
    expect(effectFor("clear", HOT_FROM)).toBe("hot");
    expect(effectFor("clear", 44)).toBe("hot");
    expect(effectFor("clouds", COLD_TO)).toBe("cold");
    expect(effectFor("mist", -10)).toBe("cold");
  });

  it("is calm in between", () => {
    expect(effectFor("clear", 22)).toBe("calm");
    expect(effectFor("clouds", HOT_FROM - 1)).toBe("calm");
    expect(effectFor("partly", COLD_TO + 1)).toBe("calm");
  });
});
