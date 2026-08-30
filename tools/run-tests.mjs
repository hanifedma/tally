// Run the browser test suite in a terminal. Everything under test is pure,
// so Node needs nothing but the module itself.
//
//     node tools/run-tests.mjs
import { runTests } from "../tests.js";

const { results, passed, failed } = await runTests();
for (const r of results) {
  if (!r.ok) console.log("  FAIL  " + r.name + "\n        " + r.error);
}
console.log("\n" + passed + " passed, " + failed + " failed, " + results.length + " total");
process.exit(failed ? 1 : 0);
