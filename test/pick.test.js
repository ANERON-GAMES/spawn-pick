import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  DEFAULT_COOLDOWN,
  DEFAULT_COOLDOWN_PENALTY,
  DEFAULT_MIN_SAFE_DISTANCE,
  DEFAULT_TIE_EPSILON,
  pickSpawn
} from "../src/index.js";

const originalRandom = Math.random;
const originalNow = Date.now;

before(() => {
  Math.random = () => {
    throw new Error("Math.random called");
  };
  Date.now = () => {
    throw new Error("Date.now called");
  };
});

after(() => {
  Math.random = originalRandom;
  Date.now = originalNow;
});

function usageInput(overrides = {}) {
  return {
    points: [
      { id: "gate", x: 0, y: 0 },
      { id: "hill", x: 6, y: 8 },
      { id: "dock", x: 40, y: 0 }
    ],
    threats: [{ x: 0, y: 0 }],
    lastUsed: { dock: 1000 },
    now: 1000,
    minSafeDistance: 10,
    cooldown: 500,
    cooldownPenalty: 40,
    ...overrides
  };
}

describe("usage example", () => {
  it("picks the hill and ranks the dock ahead of the gate", () => {
    const result = pickSpawn(usageInput());
    assert.deepEqual(result.ranked, [
      {
        id: "hill",
        x: 6,
        y: 8,
        score: 10,
        clearance: 10,
        nearest: 10,
        safe: true,
        penalty: 0,
        rank: 0
      },
      {
        id: "dock",
        x: 40,
        y: 0,
        score: 0,
        clearance: 40,
        nearest: 40,
        safe: true,
        penalty: 40,
        rank: 1
      },
      {
        id: "gate",
        x: 0,
        y: 0,
        score: -10,
        clearance: -10,
        nearest: 0,
        safe: false,
        penalty: 0,
        rank: 2
      }
    ]);
    assert.equal(result.best, result.ranked[0]);
    assert.equal(result.best.id, "hill");
  });
});

describe("distance", () => {
  it("uses the nearest threat, not the first, the last, or the sum", () => {
    const result = pickSpawn({
      points: [{ id: "a", x: 0, y: 0 }],
      threats: [
        { x: 10, y: 0 },
        { x: 0, y: 3 },
        { x: 8, y: 0 }
      ],
      lastUsed: {},
      now: 0
    });
    assert.equal(result.best.nearest, 3);
    assert.equal(result.best.clearance, 3);
    assert.equal(result.best.score, 3);
    assert.equal(result.best.safe, true);
  });

  it("measures a 3-4-5 distance and keeps negative coordinates", () => {
    const result = pickSpawn({
      points: [{ id: "a", x: -3, y: -4 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0
    });
    assert.equal(result.best.nearest, 5);
    assert.equal(result.best.score, 5);
  });

  it("preserves negative zero coordinates", () => {
    const result = pickSpawn({
      points: [{ id: "a", x: -0, y: -0 }],
      threats: [{ x: 0, y: 1 }],
      lastUsed: {},
      now: 0
    });
    assert.equal(Object.is(result.best.x, -0), true);
    assert.equal(Object.is(result.best.y, -0), true);
    assert.equal(result.best.nearest, 1);
  });

  it("accepts a finite distance at the largest finite coordinate on one axis", () => {
    const result = pickSpawn({
      points: [
        { id: "far", x: Number.MAX_VALUE, y: 0 },
        { id: "near", x: 1, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0
    });
    assert.equal(result.best.id, "far");
    assert.equal(result.best.nearest, Number.MAX_VALUE);
  });

  it("gives every point clearance 0 when there are no threats", () => {
    const result = pickSpawn({
      points: [
        { id: "c", x: 100, y: 0 },
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 5, y: 5 }
      ],
      threats: [],
      lastUsed: { b: 1, c: 5 },
      now: 10
    });
    assert.deepEqual(
      result.ranked.map((point) => point.id),
      ["a", "b", "c"]
    );
    for (const point of result.ranked) {
      assert.equal(point.nearest, null);
      assert.equal(point.clearance, 0);
      assert.equal(point.score, 0);
      assert.equal(point.safe, true);
      assert.equal(point.penalty, 0);
      assert.equal(result.ranked[point.rank], point);
    }
    assert.equal(result.best.id, "a");
  });
});

describe("minimum safe distance", () => {
  it("treats a point on the radius as safe and a point inside it as unsafe", () => {
    const result = pickSpawn({
      points: [
        { id: "inside", x: 0, y: 3 },
        { id: "edge", x: 3, y: 4 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0,
      minSafeDistance: 5
    });
    assert.deepEqual(result.ranked[0], {
      id: "edge",
      x: 3,
      y: 4,
      score: 5,
      clearance: 5,
      nearest: 5,
      safe: true,
      penalty: 0,
      rank: 0
    });
    assert.deepEqual(result.ranked[1], {
      id: "inside",
      x: 0,
      y: 3,
      score: 1,
      clearance: 1,
      nearest: 3,
      safe: false,
      penalty: 0,
      rank: 1
    });
  });

  it("ranks a point closer to the radius above a deeper unsafe point", () => {
    const result = pickSpawn({
      points: [
        { id: "deep", x: 1, y: 0 },
        { id: "shallow", x: 4, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0,
      minSafeDistance: 10
    });
    assert.equal(result.ranked[0].id, "shallow");
    assert.equal(result.ranked[0].clearance, -2);
    assert.equal(result.ranked[1].id, "deep");
    assert.equal(result.ranked[1].clearance, -8);
    assert.equal(result.ranked[0].safe, false);
    assert.equal(result.ranked[1].safe, false);
  });

  it("treats distance 0 as safe when the minimum safe distance is 0", () => {
    const result = pickSpawn({
      points: [
        { id: "occupied", x: 0, y: 0 },
        { id: "clear", x: 2, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0,
      minSafeDistance: 0
    });
    assert.equal(result.ranked[0].id, "clear");
    assert.equal(result.ranked[0].score, 2);
    assert.equal(result.ranked[1].safe, true);
    assert.equal(result.ranked[1].nearest, 0);
    assert.equal(result.ranked[1].score, 0);
  });

  it("uses the default minimum safe distance of 0", () => {
    assert.equal(DEFAULT_MIN_SAFE_DISTANCE, 0);
    const explicit = pickSpawn({
      points: [{ id: "a", x: 1, y: 0 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0,
      minSafeDistance: 0,
      cooldown: 0,
      cooldownPenalty: 0,
      tieEpsilon: 0
    });
    const implied = pickSpawn({
      points: [{ id: "a", x: 1, y: 0 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: {},
      now: 0
    });
    assert.deepEqual(explicit, implied);
  });
});

describe("cooldown penalty", () => {
  it("fades linearly and ends at the cooldown boundary", () => {
    function penaltyAt(now) {
      const result = pickSpawn({
        points: [{ id: "a", x: 0, y: 0 }],
        threats: [],
        lastUsed: { a: 1000 },
        now,
        cooldown: 8,
        cooldownPenalty: 4
      });
      return result.best.penalty;
    }

    assert.equal(penaltyAt(1000), 4);
    assert.equal(penaltyAt(1002), 3);
    assert.equal(penaltyAt(1004), 2);
    assert.equal(penaltyAt(1007), 0.5);
    assert.equal(penaltyAt(1008), 0);
    assert.equal(penaltyAt(1100), 0);
  });

  it("treats a future last-used time as age zero", () => {
    const result = pickSpawn({
      points: [{ id: "a", x: 5, y: 0 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { a: 50 },
      now: 0,
      cooldown: 10,
      cooldownPenalty: 4
    });
    assert.equal(result.best.penalty, 4);
    assert.equal(result.best.clearance, 5);
    assert.equal(result.best.score, 1);
  });

  it("accepts a negative time scale", () => {
    const result = pickSpawn({
      points: [{ id: "a", x: 0, y: 0 }],
      threats: [],
      lastUsed: { a: -150 },
      now: -100,
      cooldown: 100,
      cooldownPenalty: 8
    });
    assert.equal(result.best.penalty, 4);
    assert.equal(result.best.score, -4);
  });

  it("adds no penalty when cooldown or the penalty weight is 0", () => {
    assert.equal(DEFAULT_COOLDOWN, 0);
    assert.equal(DEFAULT_COOLDOWN_PENALTY, 0);
    const quiet = pickSpawn({
      points: [{ id: "a", x: 4, y: 0 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { a: 10 },
      now: 10,
      cooldown: 0,
      cooldownPenalty: 99
    });
    const weightless = pickSpawn({
      points: [{ id: "a", x: 4, y: 0 }],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { a: 10 },
      now: 10,
      cooldown: 99,
      cooldownPenalty: 0
    });
    assert.equal(quiet.best.penalty, 0);
    assert.equal(quiet.best.score, 4);
    assert.equal(weightless.best.penalty, 0);
    assert.equal(weightless.best.score, 4);
  });

  it("lets a fresh safe point fall below an unused unsafe point", () => {
    const result = pickSpawn({
      points: [
        { id: "fresh", x: 30, y: 0 },
        { id: "unsafe", x: 1, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { fresh: 0 },
      now: 0,
      minSafeDistance: 10,
      cooldown: 10,
      cooldownPenalty: 40
    });
    assert.equal(result.ranked[0].id, "unsafe");
    assert.equal(result.ranked[0].safe, false);
    assert.equal(result.ranked[0].score, -8);
    assert.equal(result.ranked[1].id, "fresh");
    assert.equal(result.ranked[1].safe, true);
    assert.equal(result.ranked[1].score, -10);
  });

  it("reads own toString and constructor ids as ordinary keys", () => {
    const lastUsed = {};
    lastUsed.toString = 0;
    lastUsed.constructor = 0;
    const result = pickSpawn({
      points: [
        { id: "toString", x: 0, y: 0 },
        { id: "constructor", x: 0, y: 0 }
      ],
      threats: [],
      lastUsed,
      now: 0,
      cooldown: 10,
      cooldownPenalty: 6
    });
    assert.equal(result.ranked[0].penalty, 6);
    assert.equal(result.ranked[1].penalty, 6);
    assert.deepEqual(
      result.ranked.map((point) => point.id),
      ["constructor", "toString"]
    );
  });
});

describe("deterministic ties", () => {
  it("prefers a missing last-used time, then an earlier time, then a lower id", () => {
    const result = pickSpawn({
      points: [
        { id: "b", x: 0, y: 5 },
        { id: "a", x: 0, y: -5 },
        { id: "c", x: 5, y: 0 },
        { id: "d", x: -5, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { b: 2, a: 2, d: 1 },
      now: 9,
      cooldown: 0
    });
    assert.deepEqual(
      result.ranked.map((point) => [point.id, point.score]),
      [
        ["c", 5],
        ["d", 5],
        ["a", 5],
        ["b", 5]
      ]
    );
    assert.equal(result.best.id, "c");
  });

  it("orders ids by code unit, so an upper-case id can beat a lower-case id", () => {
    const result = pickSpawn({
      points: [
        { id: "a", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 }
      ],
      threats: [],
      lastUsed: {},
      now: 0
    });
    assert.deepEqual(
      result.ranked.map((point) => point.id),
      ["B", "a"]
    );
  });

  it("does not depend on input order", () => {
    const forward = pickSpawn(usageInput());
    const reversed = pickSpawn(
      usageInput({
        points: [
          { id: "dock", x: 40, y: 0 },
          { id: "hill", x: 6, y: 8 },
          { id: "gate", x: 0, y: 0 }
        ],
        threats: [{ x: 0, y: 0, label: "ignored" }]
      })
    );
    assert.deepEqual(
      forward.ranked.map((point) => point.id),
      reversed.ranked.map((point) => point.id)
    );
  });

  it("keeps an equal score from undoing the penalty when the timestamps differ", () => {
    const result = pickSpawn({
      points: [
        { id: "penalized", x: 30, y: 0 },
        { id: "plain", x: 20, y: 0 }
      ],
      threats: [{ x: 0, y: 0 }],
      lastUsed: { penalized: 0 },
      now: 0,
      cooldown: 10,
      cooldownPenalty: 10
    });
    assert.equal(result.ranked[0].score, 20);
    assert.equal(result.ranked[1].score, 20);
    assert.equal(result.ranked[0].id, "plain");
    assert.equal(result.ranked[1].id, "penalized");
  });
});

describe("injected random source", () => {
  it("is not called when the top score is unique", () => {
    let calls = 0;
    const result = pickSpawn(
      usageInput({
        random: () => {
          calls += 1;
          return 0;
        }
      })
    );
    assert.equal(calls, 0);
    assert.equal(result.best.id, "hill");
    assert.equal(result.best, result.ranked[0]);
  });

  it("is not called when it is omitted or undefined", () => {
    const omitted = pickSpawn({
      points: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0, y: 0 }
      ],
      threats: [],
      lastUsed: {},
      now: 0
    });
    const explicit = pickSpawn({
      points: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0, y: 0 }
      ],
      threats: [],
      lastUsed: {},
      now: 0,
      random: undefined
    });
    assert.equal(omitted.best.id, "a");
    assert.deepEqual(omitted, explicit);
  });

  it("splits an exact tie into equal slices and gives an edge to the later point", () => {
    assert.equal(DEFAULT_TIE_EPSILON, 0);
    const points = [
      { id: "b", x: 0, y: 0 },
      { id: "a", x: 1, y: 0 }
    ];
    const threats = [];
    const lastUsed = {};
    function pick(sample) {
      return pickSpawn({
        points,
        threats,
        lastUsed,
        now: 0,
        random: () => sample
      });
    }

    const low = pick(0);
    const edge = pick(0.5);
    const high = pick(1 - Number.EPSILON);
    const negativeZero = pick(-0);
    assert.equal(low.best.id, "a");
    assert.equal(low.best, low.ranked[0]);
    assert.equal(edge.best.id, "b");
    assert.equal(edge.best.rank, 1);
    assert.equal(edge.ranked[0].id, "a");
    assert.equal(edge.best, edge.ranked[1]);
    assert.equal(high.best.id, "b");
    assert.equal(negativeZero.best.id, "a");
  });

  it("includes a score on the epsilon boundary and excludes a score beyond it", () => {
    const points = [
      { id: "best", x: 10, y: 0 },
      { id: "near", x: 7, y: 0 },
      { id: "far", x: 0, y: 0 }
    ];
    const threats = [{ x: 0, y: 0 }];
    const lastUsed = {};

    function pick(tieEpsilon, sample) {
      return pickSpawn({
        points,
        threats,
        lastUsed,
        now: 0,
        tieEpsilon,
        random: () => sample
      });
    }

    const inside = pick(3, 0.999);
    assert.deepEqual(
      inside.ranked.map((point) => point.id),
      ["best", "near", "far"]
    );
    assert.equal(inside.best.id, "near");
    assert.equal(pick(3, 0).best.id, "best");
    assert.equal(pick(2.999, 0.999).best.id, "best");
    assert.equal(pick(10, 0.999).best.id, "far");
  });

  it("calls random once for a band of three", () => {
    const samples = [];
    const result = pickSpawn({
      points: [
        { id: "c", x: 0, y: 0 },
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0, y: 0 }
      ],
      threats: [],
      lastUsed: {},
      now: 0,
      random: () => {
        samples.push(1 / 3);
        return 1 / 3;
      }
    });
    assert.deepEqual(samples, [1 / 3]);
    assert.equal(result.best.id, "b");
    assert.deepEqual(
      result.ranked.map((point) => point.id),
      ["a", "b", "c"]
    );
  });

  it("propagates an exception from random and does not return a ranking", () => {
    const boom = new Error("source failed");
    assert.throws(
      () =>
        pickSpawn({
          points: [
            { id: "a", x: 0, y: 0 },
            { id: "b", x: 0, y: 0 }
          ],
          threats: [],
          lastUsed: {},
          now: 0,
          random: () => {
            throw boom;
          }
        }),
      (error) => error === boom
    );
  });
});

describe("purity", () => {
  it("does not mutate the input and returns fresh results", () => {
    const point = { id: "a", x: 1, y: 2, tag: "keep" };
    const threat = { x: 3, y: 4, tag: "keep" };
    const lastUsed = { a: 8 };
    const input = {
      points: [point],
      threats: [threat],
      lastUsed,
      now: 9,
      note: "ignored"
    };
    const snapshot = structuredClone(input);
    const first = pickSpawn(input);
    const second = pickSpawn(input);
    assert.deepEqual(input, snapshot);
    assert.equal(input.points[0], point);
    assert.equal(input.threats[0], threat);
    assert.equal(input.lastUsed, lastUsed);
    assert.notEqual(first, second);
    assert.notEqual(first.ranked, second.ranked);
    assert.notEqual(first.best, second.best);
    assert.deepEqual(first, second);
    assert.deepEqual(Object.keys(first.best).sort(), [
      "clearance",
      "id",
      "nearest",
      "penalty",
      "rank",
      "safe",
      "score",
      "x",
      "y"
    ]);
  });

  it("accepts a null-prototype input and ignores a space-only id only when it is non-empty", () => {
    const input = Object.create(null);
    input.points = [Object.assign(Object.create(null), { id: " ", x: 1, y: -2 })];
    input.threats = [Object.assign(Object.create(null), { x: 0, y: 0 })];
    input.lastUsed = Object.create(null);
    input.now = 0;
    const result = pickSpawn(input);
    assert.equal(result.best.id, " ");
    assert.equal(result.best.x, 1);
    assert.equal(result.best.y, -2);
    assert.equal(result.best.nearest, Math.hypot(1, -2));
  });

  it("returns one ranked row per candidate", () => {
    const result = pickSpawn(usageInput());
    assert.equal(result.ranked.length, 3);
    assert.deepEqual(result.ranked.map((point) => point.id).sort(), ["dock", "gate", "hill"]);
  });
});

describe("finite results", () => {
  it("rejects a nearest distance that overflows", () => {
    assert.throws(
      () =>
        pickSpawn({
          points: [{ id: "a", x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
          threats: [{ x: 0, y: 0 }],
          lastUsed: {},
          now: 0,
          random: () => {
            throw new Error("random called");
          }
        }),
      { name: "RangeError", message: "nearest distance must be finite" }
    );
  });

  it("rejects a score that overflows from a huge penalty on a deep clearance", () => {
    assert.throws(
      () =>
        pickSpawn({
          points: [{ id: "a", x: 0, y: 0 }],
          threats: [{ x: 0, y: 0 }],
          lastUsed: { a: 0 },
          now: 0,
          minSafeDistance: Number.MAX_VALUE,
          cooldown: 10,
          cooldownPenalty: Number.MAX_VALUE
        }),
      { name: "RangeError", message: "score must be finite" }
    );
  });

  it("rejects a clearance that overflows inside a huge safe radius", () => {
    assert.throws(
      () =>
        pickSpawn({
          points: [{ id: "a", x: Number.MAX_VALUE * 0.75, y: 0 }],
          threats: [{ x: 0, y: 0 }],
          lastUsed: {},
          now: 0,
          minSafeDistance: Number.MAX_VALUE
        }),
      { name: "RangeError", message: "score must be finite" }
    );
  });
});
