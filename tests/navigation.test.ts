import { describe, expect, it } from "vitest";
import { isNavItemActive } from "../src/lib/components/app-header";

describe("primary navigation route matching", () => {
  it("activates an exact route and its nested routes", () => {
    expect(isNavItemActive("/learn", "/learn")).toBe(true);
    expect(isNavItemActive("/learn/lesson-1", "/learn")).toBe(true);
    expect(
      isNavItemActive("/cs-duolingo/learn/lesson-1", "/cs-duolingo/learn"),
    ).toBe(true);
  });

  it("keeps similarly prefixed routes inactive", () => {
    expect(isNavItemActive("/learners", "/learn")).toBe(false);
    expect(isNavItemActive("/cs-duolingo/review", "/cs-duolingo/learn")).toBe(
      false,
    );
  });

  it("ignores trailing slashes when comparing paths", () => {
    expect(isNavItemActive("/cs-duolingo/learn/", "/cs-duolingo/learn")).toBe(
      true,
    );
  });
});
