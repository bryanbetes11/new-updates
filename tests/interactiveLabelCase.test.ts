import { toInteractiveTitleCase } from "../src/lib/interactiveLabelCase";

function expectEqual(actual: string, expected: string) {
  if (actual !== expected) throw new Error(`Expected "${expected}", got "${actual}"`);
}

expectEqual(toInteractiveTitleCase("Review survey content"), "Review Survey Content");
expectEqual(toInteractiveTitleCase("Continue to introduction"), "Continue to Introduction");
expectEqual(toInteractiveTitleCase("Test with one member"), "Test With One Member");
expectEqual(toInteractiveTitleCase("Save and exit"), "Save and Exit");
expectEqual(toInteractiveTitleCase("Open in YouTube"), "Open in YouTube");
expectEqual(toInteractiveTitleCase("iPad preview"), "iPad Preview");
expectEqual(toInteractiveTitleCase("ServeSync update"), "ServeSync Update");
expectEqual(toInteractiveTitleCase("2026 Ministry Reflection"), "2026 Ministry Reflection");
