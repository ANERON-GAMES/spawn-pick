import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.js";

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("package metadata", () => {
  it("matches the package contract", () => {
    const pkg = JSON.parse(read("../package.json"));
    assert.equal(pkg.name, "@aneron/spawn-pick");
    assert.equal(pkg.license, "MIT");
    assert.equal(pkg.author, "Vadim Gubin");
    assert.equal(pkg.type, "module");
    assert.equal(pkg.engines.node, ">=20");
    assert.equal(pkg.repository.type, "git");
    assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/spawn-pick.git");
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.main, "./src/index.js");
    assert.equal(pkg.exports, "./src/index.js");
    assert.equal(pkg.sideEffects, false);
  });

  it("names Vadim Gubin on the license", () => {
    const license = read("../LICENSE");
    assert.match(license, /Copyright \(c\) 2026 Vadim Gubin/);
    assert.equal(license.includes("anerongames"), false);
  });

  it("documents the public sections", () => {
    const readme = read("../README.md");
    for (const heading of [
      "## Purpose",
      "## Install",
      "## Usage",
      "## API",
      "## Design",
      "## License"
    ]) {
      assert.equal(readme.includes(heading), true);
    }
  });

  it("locks the public exports", () => {
    assert.deepEqual(Object.keys(api).sort(), [
      "DEFAULT_COOLDOWN",
      "DEFAULT_COOLDOWN_PENALTY",
      "DEFAULT_MIN_SAFE_DISTANCE",
      "DEFAULT_TIE_EPSILON",
      "pickSpawn"
    ]);
  });

  it("resolves the lockfile only from the npm registry", () => {
    const lock = JSON.parse(read("../package-lock.json"));
    assert.equal(lock.lockfileVersion, 3);
    assert.equal(lock.packages[""].dependencies, undefined);
    const resolved = [];
    for (const pkg of Object.values(lock.packages)) {
      if (typeof pkg.resolved === "string") {
        resolved.push(pkg.resolved);
      }
    }
    assert.equal(resolved.length > 0, true);
    for (const url of resolved) {
      assert.equal(url.startsWith("https://registry.npmjs.org/"), true);
    }
    assert.equal(JSON.stringify(lock).includes("registry.yarnpkg.com"), false);
    assert.equal(JSON.stringify(lock).includes("registry.npmmirror.com"), false);
  });

  it("runs lint and tests on Node 20 and 22", () => {
    const workflow = read("../.github/workflows/ci.yml");
    assert.equal(workflow.includes("node-version: [20, 22]"), true);
    assert.equal(workflow.includes("npm ci"), true);
    assert.equal(workflow.includes("npm test"), true);
    assert.equal(workflow.includes("npm run lint"), true);
  });

  it("keeps clocks, randomness, and comments out of the implementation", () => {
    const files = readdirSync(fileURLToPath(new URL("../src/", import.meta.url)));
    assert.deepEqual(files, ["index.js"]);
    const source = read("../src/index.js");
    assert.equal(source.includes("//"), false);
    assert.equal(source.includes("/*"), false);
    assert.equal(/\bimport\b/.test(source), false);
    assert.equal(
      /\b(Date|performance|fetch|setTimeout|setInterval|process|require|fs|http|https|net|child_process|Math\.random)\b/.test(
        source
      ),
      false
    );
  });
});
