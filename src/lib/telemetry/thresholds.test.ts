import { describe, expect, it } from "vitest";

import { bpLevel, heartRateLevel, proximityLevel, spo2Level, worstLevel } from "./thresholds";

describe("heart rate limits", () => {
  it("60–100 bpm is normal", () => {
    expect(heartRateLevel(60)).toBe("safe");
    expect(heartRateLevel(100)).toBe("safe");
  });
  it("101–120 or 50–59 bpm is a warning", () => {
    expect(heartRateLevel(101)).toBe("warning");
    expect(heartRateLevel(120)).toBe("warning");
    expect(heartRateLevel(55)).toBe("warning");
  });
  it("above 120 or below 50 bpm is critical", () => {
    expect(heartRateLevel(121)).toBe("critical");
    expect(heartRateLevel(49)).toBe("critical");
  });
  it("no reading is not treated as a value", () => {
    expect(heartRateLevel(null)).toBe("idle");
    expect(heartRateLevel(0)).toBe("idle");
  });
});

describe("SpO2 limits", () => {
  it("95% and above is normal", () => expect(spo2Level(95)).toBe("safe"));
  it("90–94% is a warning", () => {
    expect(spo2Level(94)).toBe("warning");
    expect(spo2Level(90)).toBe("warning");
  });
  it("below 90% is critical", () => expect(spo2Level(89)).toBe("critical"));
});

describe("blood pressure", () => {
  it("stays 'no data' unless both real values are present", () => {
    expect(bpLevel(null, null)).toBe("idle");
    expect(bpLevel(120, null)).toBe("idle");
  });
  it("140/90 or higher is critical", () => {
    expect(bpLevel(140, 80)).toBe("critical");
    expect(bpLevel(120, 90)).toBe("critical");
  });
  it("130/85 is a warning, 120/80 is normal", () => {
    expect(bpLevel(130, 80)).toBe("warning");
    expect(bpLevel(120, 80)).toBe("safe");
  });
});

describe("machine proximity zones", () => {
  it("closer than 30 cm is danger", () => expect(proximityLevel(29)).toBe("critical"));
  it("30–79 cm is warning", () => {
    expect(proximityLevel(30)).toBe("warning");
    expect(proximityLevel(79)).toBe("warning");
  });
  it("80 cm and beyond is safe", () => expect(proximityLevel(80)).toBe("safe"));
});

describe("overall status", () => {
  it("takes the worst level", () => {
    expect(worstLevel("safe", "warning", "idle")).toBe("warning");
    expect(worstLevel("safe", "critical", "warning")).toBe("critical");
  });
});
