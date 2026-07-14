import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLLOW_UP_BEHAVIOR,
  invertFollowUpBehavior,
  resolveSendBehavior,
} from "../followUpBehavior";

describe("followUpBehavior", () => {
  it("defaults to queue", () => {
    expect(DEFAULT_FOLLOW_UP_BEHAVIOR).toBe("queue");
  });

  it("inverts single-message behavior without changing mode", () => {
    expect(invertFollowUpBehavior("queue")).toBe("steer");
    expect(invertFollowUpBehavior("steer")).toBe("queue");
  });

  it("uses mode for normal send and inverted mode for ctrl-shift", () => {
    expect(resolveSendBehavior("queue", { invertOnce: false })).toBe("queue");
    expect(resolveSendBehavior("queue", { invertOnce: true })).toBe("steer");
    expect(resolveSendBehavior("steer", { invertOnce: true })).toBe("queue");
  });
});
