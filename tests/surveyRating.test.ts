import { strict as assert } from "node:assert";
import { parseSurveyRating } from "../src/lib/survey";

assert.equal(parseSurveyRating("3"), 3);
assert.equal(parseSurveyRating("3.5"), 3.5);
assert.equal(parseSurveyRating("4"), 4);
assert.equal(parseSurveyRating("na"), null);
assert.equal(parseSurveyRating("6"), null);
