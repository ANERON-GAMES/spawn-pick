export const DEFAULT_MIN_SAFE_DISTANCE = 0;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_COOLDOWN_PENALTY = 0;
export const DEFAULT_TIE_EPSILON = 0;

export function pickSpawn(input) {
  const options = validate(input);
  const scored = scorePoints(options);
  const ranked = rankPoints(scored);
  const best = chooseBest(ranked, options);
  return { best, ranked };
}

function validate(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("input must be a plain object");
  }

  const points = readPoints(own(input, "points"));
  const threats = readThreats(own(input, "threats"));
  const ids = new Set(points.map((point) => point.id));
  const lastUsed = readLastUsed(own(input, "lastUsed"), ids);
  const now = readNow(own(input, "now"));
  const minSafeDistance = readNonNegative(
    own(input, "minSafeDistance"),
    "minSafeDistance",
    DEFAULT_MIN_SAFE_DISTANCE
  );
  const cooldown = readNonNegative(own(input, "cooldown"), "cooldown", DEFAULT_COOLDOWN);
  const cooldownPenalty = readNonNegative(
    own(input, "cooldownPenalty"),
    "cooldownPenalty",
    DEFAULT_COOLDOWN_PENALTY
  );
  const tieEpsilon = readNonNegative(own(input, "tieEpsilon"), "tieEpsilon", DEFAULT_TIE_EPSILON);
  const random = readRandom(own(input, "random"));

  return {
    points,
    threats,
    lastUsed,
    now,
    minSafeDistance,
    cooldown,
    cooldownPenalty,
    tieEpsilon,
    random
  };
}

function own(input, key) {
  if (!Object.hasOwn(input, key)) {
    return undefined;
  }
  return input[key];
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readPoints(points) {
  if (!Array.isArray(points)) {
    throw new TypeError("points must be an array");
  }
  if (points.length === 0) {
    throw new RangeError("points must not be empty");
  }

  const seen = new Set();
  const read = [];
  for (const point of points) {
    if (!isPlainObject(point)) {
      throw new TypeError("point must be a plain object");
    }
    const id = readId(point);
    if (seen.has(id)) {
      throw new TypeError(`duplicate point id: ${id}`);
    }
    seen.add(id);
    read.push({
      id,
      x: readCoordinate(point, "x", "point x must be a finite number"),
      y: readCoordinate(point, "y", "point y must be a finite number")
    });
  }
  return read;
}

function readId(point) {
  if (!Object.hasOwn(point, "id") || typeof point.id !== "string" || point.id.length === 0) {
    throw new TypeError("point id must be a non-empty string");
  }
  return point.id;
}

function readCoordinate(record, key, message) {
  if (!Object.hasOwn(record, key)) {
    throw new TypeError(message);
  }
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(message);
  }
  return value;
}

function readThreats(threats) {
  if (!Array.isArray(threats)) {
    throw new TypeError("threats must be an array");
  }

  const read = [];
  for (const threat of threats) {
    if (!isPlainObject(threat)) {
      throw new TypeError("threat must be a plain object");
    }
    read.push({
      x: readCoordinate(threat, "x", "threat x must be a finite number"),
      y: readCoordinate(threat, "y", "threat y must be a finite number")
    });
  }
  return read;
}

function readLastUsed(lastUsed, ids) {
  if (!isPlainObject(lastUsed)) {
    throw new TypeError("lastUsed must be a plain object");
  }

  const read = new Map();
  for (const id of Object.keys(lastUsed)) {
    if (!ids.has(id)) {
      throw new TypeError(`unknown lastUsed id: ${id}`);
    }
    const time = lastUsed[id];
    if (typeof time !== "number" || !Number.isFinite(time)) {
      throw new TypeError(`lastUsed.${id} must be a finite number`);
    }
    read.set(id, time);
  }
  return read;
}

function readNow(now) {
  if (typeof now !== "number" || !Number.isFinite(now)) {
    throw new TypeError("now must be a finite number");
  }
  return now;
}

function readNonNegative(value, name, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }
  return value;
}

function readRandom(random) {
  if (random === undefined) {
    return null;
  }
  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }
  return random;
}

function scorePoints(options) {
  const scored = [];
  for (const point of options.points) {
    const nearest = nearestDistance(point, options.threats);
    const clearance = clearanceFor(nearest, options.minSafeDistance);
    const usedAt = options.lastUsed.has(point.id) ? options.lastUsed.get(point.id) : null;
    const penalty = penaltyFor(usedAt, options);
    const score = clearance - penalty;
    if (!Number.isFinite(clearance) || !Number.isFinite(penalty) || !Number.isFinite(score)) {
      throw new RangeError("score must be finite");
    }
    scored.push({
      id: point.id,
      x: point.x,
      y: point.y,
      score,
      clearance,
      nearest,
      safe: nearest === null || nearest >= options.minSafeDistance,
      penalty,
      usedAt
    });
  }
  return scored;
}

function nearestDistance(point, threats) {
  if (threats.length === 0) {
    return null;
  }

  let nearest = Infinity;
  for (const threat of threats) {
    const distance = Math.hypot(point.x - threat.x, point.y - threat.y);
    if (distance < nearest) {
      nearest = distance;
    }
  }
  if (!Number.isFinite(nearest)) {
    throw new RangeError("nearest distance must be finite");
  }
  return nearest;
}

function clearanceFor(nearest, minSafeDistance) {
  if (nearest === null) {
    return 0;
  }
  if (nearest >= minSafeDistance) {
    return nearest;
  }
  return 2 * nearest - minSafeDistance;
}

function penaltyFor(usedAt, options) {
  if (usedAt === null || options.cooldown === 0 || options.cooldownPenalty === 0) {
    return 0;
  }

  let age = options.now - usedAt;
  if (age < 0) {
    age = 0;
  }
  if (age >= options.cooldown) {
    return 0;
  }
  return options.cooldownPenalty * (1 - age / options.cooldown);
}

function rankPoints(scored) {
  const ordered = scored.slice();
  ordered.sort(compareScored);

  const ranked = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const point = ordered[index];
    ranked.push({
      id: point.id,
      x: point.x,
      y: point.y,
      score: point.score,
      clearance: point.clearance,
      nearest: point.nearest,
      safe: point.safe,
      penalty: point.penalty,
      rank: index
    });
  }
  return ranked;
}

function compareScored(left, right) {
  if (left.score !== right.score) {
    return left.score > right.score ? -1 : 1;
  }
  if (left.usedAt !== right.usedAt) {
    if (left.usedAt === null) {
      return -1;
    }
    if (right.usedAt === null) {
      return 1;
    }
    return left.usedAt < right.usedAt ? -1 : 1;
  }
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
}

function chooseBest(ranked, options) {
  const count = bandCount(ranked, options.tieEpsilon);
  if (options.random === null || count < 2) {
    return ranked[0];
  }

  const sample = options.random();
  if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("random() must return a finite number in [0, 1)");
  }
  const index = Math.min(count - 1, Math.floor(sample * count));
  return ranked[index];
}

function bandCount(ranked, tieEpsilon) {
  const top = ranked[0].score;
  let count = 1;
  while (count < ranked.length && top - ranked[count].score <= tieEpsilon) {
    count += 1;
  }
  return count;
}
