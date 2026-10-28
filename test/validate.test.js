import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickSpawn } from "../src/index.js";

function base(overrides = {}) {
  return {
    points: [{ id: "a", x: 0, y: 0 }],
    threats: [],
    lastUsed: {},
    now: 0,
    ...overrides
  };
}

function expectError(run, name, message) {
  assert.throws(run, { name, message });
}

describe("validation", () => {
  const cases = [
    ["rejects a null input", () => pickSpawn(null), "TypeError", "input must be a plain object"],
    ["rejects an array input", () => pickSpawn([]), "TypeError", "input must be a plain object"],
    [
      "rejects a string input",
      () => pickSpawn("points"),
      "TypeError",
      "input must be a plain object"
    ],
    [
      "rejects a class instance input",
      () => {
        class Bag {}
        return pickSpawn(new Bag());
      },
      "TypeError",
      "input must be a plain object"
    ],
    [
      "rejects missing points",
      () => pickSpawn(base({ points: undefined })),
      "TypeError",
      "points must be an array"
    ],
    [
      "rejects points that are not an array",
      () => pickSpawn(base({ points: {} })),
      "TypeError",
      "points must be an array"
    ],
    [
      "rejects an empty point list",
      () => pickSpawn(base({ points: [] })),
      "RangeError",
      "points must not be empty"
    ],
    [
      "rejects a null point",
      () => pickSpawn(base({ points: [null] })),
      "TypeError",
      "point must be a plain object"
    ],
    [
      "rejects an array point",
      () => pickSpawn(base({ points: [["a", 0, 0]] })),
      "TypeError",
      "point must be a plain object"
    ],
    [
      "rejects a class instance point",
      () => {
        class Point {
          constructor() {
            this.id = "a";
            this.x = 0;
            this.y = 0;
          }
        }
        return pickSpawn(base({ points: [new Point()] }));
      },
      "TypeError",
      "point must be a plain object"
    ],
    [
      "rejects a missing id",
      () => pickSpawn(base({ points: [{ x: 0, y: 0 }] })),
      "TypeError",
      "point id must be a non-empty string"
    ],
    [
      "rejects an empty id",
      () => pickSpawn(base({ points: [{ id: "", x: 0, y: 0 }] })),
      "TypeError",
      "point id must be a non-empty string"
    ],
    [
      "rejects a numeric id",
      () => pickSpawn(base({ points: [{ id: 1, x: 0, y: 0 }] })),
      "TypeError",
      "point id must be a non-empty string"
    ],
    [
      "rejects a duplicate id",
      () =>
        pickSpawn(
          base({
            points: [
              { id: "a", x: 0, y: 0 },
              { id: "a", x: 1, y: 0 }
            ],
            random: "nope"
          })
        ),
      "TypeError",
      "duplicate point id: a"
    ],
    [
      "rejects a missing x",
      () => pickSpawn(base({ points: [{ id: "a", y: 0 }] })),
      "TypeError",
      "point x must be a finite number"
    ],
    [
      "rejects a string x",
      () => pickSpawn(base({ points: [{ id: "a", x: "0", y: 0 }] })),
      "TypeError",
      "point x must be a finite number"
    ],
    [
      "rejects NaN x",
      () => pickSpawn(base({ points: [{ id: "a", x: Number.NaN, y: 0 }] })),
      "TypeError",
      "point x must be a finite number"
    ],
    [
      "rejects infinite y",
      () => pickSpawn(base({ points: [{ id: "a", x: 0, y: Number.POSITIVE_INFINITY }] })),
      "TypeError",
      "point y must be a finite number"
    ],
    [
      "rejects missing threats",
      () => pickSpawn(base({ threats: undefined })),
      "TypeError",
      "threats must be an array"
    ],
    [
      "rejects a null threat",
      () => pickSpawn(base({ threats: [null] })),
      "TypeError",
      "threat must be a plain object"
    ],
    [
      "rejects a class instance threat",
      () => {
        class Threat {
          constructor() {
            this.x = 0;
            this.y = 0;
          }
        }
        return pickSpawn(base({ threats: [new Threat()] }));
      },
      "TypeError",
      "threat must be a plain object"
    ],
    [
      "rejects a missing threat coordinate",
      () => pickSpawn(base({ threats: [{ x: 0 }] })),
      "TypeError",
      "threat y must be a finite number"
    ],
    [
      "rejects a non-finite threat coordinate",
      () => pickSpawn(base({ threats: [{ x: Number.NaN, y: 0 }] })),
      "TypeError",
      "threat x must be a finite number"
    ],
    [
      "rejects a missing lastUsed map",
      () => pickSpawn(base({ lastUsed: undefined })),
      "TypeError",
      "lastUsed must be a plain object"
    ],
    [
      "rejects an array lastUsed map",
      () => pickSpawn(base({ lastUsed: [] })),
      "TypeError",
      "lastUsed must be a plain object"
    ],
    [
      "rejects an unknown lastUsed id before its value is judged",
      () => pickSpawn(base({ lastUsed: { missing: Number.NaN } })),
      "TypeError",
      "unknown lastUsed id: missing"
    ],
    [
      "rejects a non-finite lastUsed time",
      () => pickSpawn(base({ lastUsed: { a: Number.POSITIVE_INFINITY } })),
      "TypeError",
      "lastUsed.a must be a finite number"
    ],
    [
      "rejects a string lastUsed time",
      () => pickSpawn(base({ lastUsed: { a: "0" } })),
      "TypeError",
      "lastUsed.a must be a finite number"
    ],
    [
      "rejects a missing now",
      () => pickSpawn(base({ now: undefined })),
      "TypeError",
      "now must be a finite number"
    ],
    [
      "rejects a string now",
      () => pickSpawn(base({ now: "0" })),
      "TypeError",
      "now must be a finite number"
    ],
    [
      "rejects an infinite now",
      () => pickSpawn(base({ now: Number.NEGATIVE_INFINITY })),
      "TypeError",
      "now must be a finite number"
    ],
    [
      "rejects a non-numeric minimum safe distance",
      () => pickSpawn(base({ minSafeDistance: "10" })),
      "TypeError",
      "minSafeDistance must be a finite number"
    ],
    [
      "rejects NaN cooldown",
      () => pickSpawn(base({ cooldown: Number.NaN })),
      "TypeError",
      "cooldown must be a finite number"
    ],
    [
      "rejects a negative penalty weight",
      () => pickSpawn(base({ cooldownPenalty: -1 })),
      "RangeError",
      "cooldownPenalty must be greater than or equal to 0"
    ],
    [
      "rejects a negative tie epsilon",
      () => pickSpawn(base({ tieEpsilon: -0.1 })),
      "RangeError",
      "tieEpsilon must be greater than or equal to 0"
    ],
    [
      "rejects a negative minimum safe distance",
      () => pickSpawn(base({ minSafeDistance: -1 })),
      "RangeError",
      "minSafeDistance must be greater than or equal to 0"
    ],
    [
      "rejects null as the random source",
      () => pickSpawn(base({ random: null })),
      "TypeError",
      "random must be a function"
    ],
    [
      "rejects a random sample of 1",
      () =>
        pickSpawn(
          base({
            points: [
              { id: "a", x: 0, y: 0 },
              { id: "b", x: 0, y: 0 }
            ],
            random: () => 1
          })
        ),
      "RangeError",
      "random() must return a finite number in [0, 1)"
    ],
    [
      "rejects a negative random sample",
      () =>
        pickSpawn(
          base({
            points: [
              { id: "a", x: 0, y: 0 },
              { id: "b", x: 0, y: 0 }
            ],
            random: () => -0.01
          })
        ),
      "RangeError",
      "random() must return a finite number in [0, 1)"
    ],
    [
      "rejects a non-numeric random sample",
      () =>
        pickSpawn(
          base({
            points: [
              { id: "a", x: 0, y: 0 },
              { id: "b", x: 0, y: 0 }
            ],
            random: () => "0.2"
          })
        ),
      "RangeError",
      "random() must return a finite number in [0, 1)"
    ],
    [
      "rejects NaN from random",
      () =>
        pickSpawn(
          base({
            points: [
              { id: "a", x: 0, y: 0 },
              { id: "b", x: 0, y: 0 }
            ],
            random: () => Number.NaN
          })
        ),
      "RangeError",
      "random() must return a finite number in [0, 1)"
    ]
  ];

  for (const [name, run, errorName, message] of cases) {
    it(name, () => {
      expectError(run, errorName, message);
    });
  }

  it("checks the random source type before a distance overflow", () => {
    expectError(
      () =>
        pickSpawn(
          base({
            points: [{ id: "a", x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
            threats: [{ x: 0, y: 0 }],
            random: "nope"
          })
        ),
      "TypeError",
      "random must be a function"
    );
  });

  it("does not call random when validation fails", () => {
    let calls = 0;
    expectError(
      () =>
        pickSpawn(
          base({
            points: [],
            random: () => {
              calls += 1;
              return 0;
            }
          })
        ),
      "RangeError",
      "points must not be empty"
    );
    assert.equal(calls, 0);
  });
});
