import { describe, expect, it } from "vitest";
import {
  IMAGE_LONG_EDGE,
  IMAGE_MIN_EDGE,
  computeScaledSize,
  shrinkSizeForBytes,
} from "../imageCompression";

describe("imageCompression sizing", () => {
  it("only shrinks long edge to 1024", () => {
    expect(computeScaledSize(3840, 2077, IMAGE_LONG_EDGE)).toEqual({
      width: 1024,
      height: 554,
    });
    expect(computeScaledSize(600, 1600, IMAGE_LONG_EDGE)).toEqual({
      width: 384,
      height: 1024,
    });
  });

  it("does not upscale small images", () => {
    expect(computeScaledSize(800, 600, IMAGE_LONG_EDGE)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("further shrink keeps edges >= 256 when possible", () => {
    const next = shrinkSizeForBytes(1024, 554, 0.85, IMAGE_MIN_EDGE);
    expect(next.width).toBeLessThan(1024);
    expect(next.height).toBeLessThan(554);
    expect(Math.min(next.width, next.height)).toBeGreaterThanOrEqual(
      IMAGE_MIN_EDGE,
    );
  });

  it("stops shrinking when already at min edge", () => {
    expect(shrinkSizeForBytes(256, 256, 0.85, IMAGE_MIN_EDGE)).toEqual({
      width: 256,
      height: 256,
    });
  });
});
