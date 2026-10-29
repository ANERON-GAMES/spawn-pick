# spawn-pick

Rank candidate spawn points and pick one.

## Purpose

`@aneron/spawn-pick` scores each candidate point by its distance from the nearest threat, then subtracts a penalty for recent use. A configurable minimum safe distance pulls a point inside that radius below the radius. A configurable cooldown fades the recent-use penalty to zero. The call returns the chosen point and the full ranking.

Ties in that ranking break in a fixed order. An optional function, supplied by the caller, picks among scores that sit within a configurable band of the best score. The same points, threats, times, and random sequence always produce the same result.

The caller passes the current time. The library does not call `Math.random`, does not read a clock, and does not touch the network or the filesystem. It has no runtime dependencies.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/spawn-pick`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/spawn-pick.git
cd spawn-pick
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/spawn-pick
```

```js
import { pickSpawn } from "@aneron/spawn-pick";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

Positions are planar. `now` and every `lastUsed` value share one time scale. The numbers below are exact: the hill is 6 units east and 8 units north of the only threat, which is 10 units away.

```js
import { pickSpawn } from "@aneron/spawn-pick";

const result = pickSpawn({
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
  cooldownPenalty: 40
});
```

`result.best` is the hill entry below. `result.ranked` is:

```json
[
  {
    "id": "hill",
    "x": 6,
    "y": 8,
    "score": 10,
    "clearance": 10,
    "nearest": 10,
    "safe": true,
    "penalty": 0,
    "rank": 0
  },
  {
    "id": "dock",
    "x": 40,
    "y": 0,
    "score": 0,
    "clearance": 40,
    "nearest": 40,
    "safe": true,
    "penalty": 40,
    "rank": 1
  },
  {
    "id": "gate",
    "x": 0,
    "y": 0,
    "score": -10,
    "clearance": -10,
    "nearest": 0,
    "safe": false,
    "penalty": 0,
    "rank": 2
  }
]
```

The gate sits on the threat, inside the safe distance of 10, so its clearance is `2 * 0 - 10`. The hill is exactly 10 away, so it is safe and its clearance is 10. The dock is 40 away, but it was used at the current time. The cooldown is 500 and the full penalty is 40, so its score is `40 - 40`. The dock stays ahead of the gate. The hill wins.

Omit `random` and the pick is the first row of `ranked`. Pass `random` only when a near-equal band should be sampled.

## API

All behavior is pure. `pickSpawn` does not mutate its argument. It does not keep state between calls.

### Constants

| Export                      | Value | Meaning                                                                           |
| --------------------------- | ----- | --------------------------------------------------------------------------------- |
| `DEFAULT_MIN_SAFE_DISTANCE` | `0`   | Used when `minSafeDistance` is omitted. Every finite distance is safe.            |
| `DEFAULT_COOLDOWN`          | `0`   | Used when `cooldown` is omitted. Recent use adds no penalty.                      |
| `DEFAULT_COOLDOWN_PENALTY`  | `0`   | Used when `cooldownPenalty` is omitted. Recent use adds no penalty.               |
| `DEFAULT_TIE_EPSILON`       | `0`   | Used when `tieEpsilon` is omitted. Only an exact score tie joins the random band. |

### `pickSpawn(input)`

Return `{ best, ranked }`.

`input` must be a plain object. A plain object has prototype `Object.prototype` or `null`. Arrays and class instances are rejected. The checks run in the order below. The first problem throws, and `random` is not called.

| Field             | Required | Meaning                                                                                                     |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `points`          | yes      | Non-empty array of candidate points.                                                                        |
| `threats`         | yes      | Array of threat positions. An empty array means there are no threats.                                       |
| `lastUsed`        | yes      | Plain object. Keys are point ids. Values are last-used times. An empty object means no point has been used. |
| `now`             | yes      | Finite number. The current time on the same scale as `lastUsed`.                                            |
| `minSafeDistance` | no       | Finite number greater than or equal to 0. Defaults to `DEFAULT_MIN_SAFE_DISTANCE`.                          |
| `cooldown`        | no       | Finite number greater than or equal to 0. Defaults to `DEFAULT_COOLDOWN`.                                   |
| `cooldownPenalty` | no       | Finite number greater than or equal to 0. Defaults to `DEFAULT_COOLDOWN_PENALTY`.                           |
| `tieEpsilon`      | no       | Finite number greater than or equal to 0. Defaults to `DEFAULT_TIE_EPSILON`.                                |
| `random`          | no       | Function returning a finite number in `[0, 1)`. Omit it, or pass `undefined`, for a deterministic pick.     |

A point is a plain object:

| Field | Meaning                                                                      |
| ----- | ---------------------------------------------------------------------------- |
| `id`  | Non-empty string. Unique among `points`. Compared by UTF-16 code unit order. |
| `x`   | Finite number.                                                               |
| `y`   | Finite number.                                                               |

A threat is a plain object with finite `x` and `y`. Threats have no ids. Duplicate threat positions are kept. Other own fields on the input, on a point, and on a threat are ignored. They are not copied onto the result.

`lastUsed` is read from its own enumerable string keys. A key that is not a candidate id throws. A value must be a finite number. A missing key means that point has no last-used time.

`now` may be negative. `lastUsed` values may be negative. They are not required to be Unix times.

Validation errors:

| Condition                                     | Error                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `input` is not a plain object                 | `TypeError` `input must be a plain object`                                           |
| `points` is not an array                      | `TypeError` `points must be an array`                                                |
| `points` is empty                             | `RangeError` `points must not be empty`                                              |
| a point is not a plain object                 | `TypeError` `point must be a plain object`                                           |
| a point id is missing, not a string, or empty | `TypeError` `point id must be a non-empty string`                                    |
| two points share an id                        | `TypeError` `duplicate point id: <id>`                                               |
| a point coordinate is missing or not finite   | `TypeError` `point x must be a finite number` or `point y must be a finite number`   |
| `threats` is not an array                     | `TypeError` `threats must be an array`                                               |
| a threat is not a plain object                | `TypeError` `threat must be a plain object`                                          |
| a threat coordinate is missing or not finite  | `TypeError` `threat x must be a finite number` or `threat y must be a finite number` |
| `lastUsed` is not a plain object              | `TypeError` `lastUsed must be a plain object`                                        |
| a `lastUsed` key is not a candidate id        | `TypeError` `unknown lastUsed id: <id>`                                              |
| a `lastUsed` value is not finite              | `TypeError` `lastUsed.<id> must be a finite number`                                  |
| `now` is missing or not finite                | `TypeError` `now must be a finite number`                                            |
| a tuning number is present and not finite     | `TypeError` `<name> must be a finite number`                                         |
| a tuning number is negative                   | `RangeError` `<name> must be greater than or equal to 0`                             |
| `random` is present and not a function        | `TypeError` `random must be a function`                                              |
| the nearest distance overflows                | `RangeError` `nearest distance must be finite`                                       |
| the clearance, penalty, or score overflows    | `RangeError` `score must be finite`                                                  |
| `random()` returns a value outside `[0, 1)`   | `RangeError` `random() must return a finite number in [0, 1)`                        |

`<name>` is `minSafeDistance`, `cooldown`, `cooldownPenalty`, or `tieEpsilon`. An exception thrown by `random` itself is not wrapped. `null` is not a valid `random`. `-0` is a valid sample and selects the same point as `0`.

`ranked` has one entry per candidate, best first. `best` is one of those objects, the same reference as `ranked[best.rank]`. Each entry has:

| Field       | Type             | Meaning                                                                                        |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `id`        | string           | The candidate id.                                                                              |
| `x`         | number           | The candidate `x`, including `-0` when that was the input.                                     |
| `y`         | number           | The candidate `y`, including `-0` when that was the input.                                     |
| `nearest`   | number or `null` | Distance to the nearest threat. `null` when `threats` is empty.                                |
| `safe`      | boolean          | `true` when `nearest` is `null` or `nearest` is greater than or equal to `minSafeDistance`.    |
| `clearance` | number           | Distance score before the recent-use penalty.                                                  |
| `penalty`   | number           | Recent-use penalty subtracted from `clearance`. `0` when the point is not inside the cooldown. |
| `score`     | number           | `clearance - penalty`. Higher is better.                                                       |
| `rank`      | number           | Zero-based index in `ranked`.                                                                  |

`best.rank` is `0` when `random` is omitted or the band has one point. When `random` selects another row, `best.rank` is that row's index and `ranked` stays in deterministic order.

Distance is the Euclidean length `Math.hypot(point.x - threat.x, point.y - threat.y)`. `nearest` is the minimum of those lengths. A later threat does not add to an earlier one. With no threats, `nearest` is `null` and `clearance` is `0` for every point.

For a finite `nearest`:

- When `nearest` is greater than or equal to `minSafeDistance`, `clearance` is `nearest`.
- When `nearest` is below `minSafeDistance`, `clearance` is `2 * nearest - minSafeDistance`.

The two branches meet at the radius: both return `minSafeDistance`. Inside the radius the clearance is strictly below `minSafeDistance`. With a zero penalty, every safe point outranks every unsafe point. `minSafeDistance` of `0` makes every finite distance safe, including a point that shares its position with a threat.

The penalty uses the age `max(0, now - lastUsed)`. A last-used time later than `now` has age `0`. A point with no last-used time has penalty `0`. When `cooldown` is `0` or `cooldownPenalty` is `0`, the penalty is `0`. Otherwise, when `age` is greater than or equal to `cooldown`, the penalty is `0`. When `age` is below `cooldown`, the penalty is:

```text
cooldownPenalty * (1 - age / cooldown)
```

Age `0` pays the full `cooldownPenalty`. The window is half-open: the instant `age` reaches `cooldown`, the penalty is gone. The penalty is subtracted after clearance, so a freshly used safe point can rank below an unused unsafe point. No point is removed from `ranked`.

`ranked` is a total order:

1. Higher `score`.
2. Earlier last-used time. A point with no last-used time is earlier than every timestamp.
3. Lower `id`, in UTF-16 code unit order, the same order as `<` on strings.

`tieEpsilon` does not change that order. It only chooses who may become `best`. The band is the prefix of `ranked` whose score `s` satisfies `bestScore - s <= tieEpsilon`. One point in the band, or a missing `random`, selects `ranked[0]` and does not call `random`. Two or more points call `random` once. The half-open interval `[0, 1)` is split into `count` equal slices in rank order. The index is `min(count - 1, floor(sample * count))`. Sample `0` selects the first row. A sample that lands on a slice edge belongs to the later row. A product that rounds to `count` still selects the last row.

## Design

The score is one number so the ranking is a single comparison, plus two deterministic keys that only matter when that number ties. Callers read `nearest`, `safe`, `clearance`, and `penalty` when they need the parts.

The nearest threat is the only threat that matters. A point beside one threat and far from another is as exposed as the near one. Summing distances would hide that. Averaging would hide it too. Empty `threats` is not a distance of zero: zero means a threat occupies the point. Empty means there is nothing to measure, so every clearance is `0` and the recent-use keys decide.

The safe-distance branch is continuous at the radius and strict inside it. A point one unit inside a radius of 10 scores 8, which is below every safe score. A point on the radius scores 10. The cliff is only the gap from "almost safe" to "safe", and it shrinks as the point approaches the radius. The library still returns unsafe points. A caller that wants a hard exclusion can ignore rows with `safe: false`, or can raise `cooldownPenalty` until a fresh point sinks below the rows that should win.

The cooldown is a fade, not a lock. At the start of the window the point loses `cooldownPenalty` score units. Halfway through, it loses half. At the end, it loses nothing. Setting either `cooldown` or `cooldownPenalty` to `0` turns the fade off. The tie-break still prefers an earlier last-used time when scores match, including when the fade is off. That keeps two unused rules from getting tangled: the penalty moves the score, and the timestamp only orders equal scores.

A future last-used time is treated as age zero, not as a negative penalty. Clock skew then pays the full penalty instead of rewarding the point.

The random source is optional and injected so the module never chooses its own entropy. It is called only when the band has two or more rows. A unique best score does not consume a sample. The band is a score band, not a last-used band: two equal scores are both eligible even though `ranked` lists the earlier timestamp first. `tieEpsilon` of `0` is exact equality. A larger epsilon is how a caller defines near-equal. A very large epsilon puts the whole list in the band. `ranked` itself never depends on `random` or on `tieEpsilon`.

`Math.hypot` is used so a moderate coordinate does not overflow inside `dx * dx + dy * dy`. Extreme coordinates can still overflow the hypotenuse or the clearance arithmetic. Those inputs throw, and they throw before `random` is called. Ordinary coordinates and ordinary penalties stay on the formulas above. Addition and division follow IEEE-754.

The module does not store last-used times, advance `now`, or decide what a threat is. A threat can be an enemy, a hazard, or any other position the caller cares about. The caller chooses the time unit and which points are candidates.

## License

Released under the MIT License. Copyright (c) 2026 Vadim Gubin. The full text is in [LICENSE](LICENSE).
