/**
 * One-off index reconciliation.
 *
 *   node syncIndexes.js                  # report only, changes nothing
 *   node syncIndexes.js --apply          # build missing indexes
 *   node syncIndexes.js --apply --prune  # also DROP undeclared ones
 *
 * Normally you do not need this. Mongoose has autoIndex on by default and the
 * backend is a long-lived Render service, so declared indexes get built on
 * boot. This exists for two cases: you want the indexes to exist *before* the
 * next deploy, or you want to clear out indexes that no schema declares
 * anymore.
 *
 * NOTE: --apply alone only BUILDS. Dropping is behind --prune, because
 * Model.syncIndexes() removes any index not declared in a schema — including
 * one somebody created by hand in the Atlas UI. Run with no flags first and
 * read the report.
 *
 * The report compares index KEYS only. Drift in options (unique, sparse, TTL,
 * partial filters) is not detected and not fixed by --apply.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const PRUNE = process.argv.includes('--prune');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (will build and drop)' : 'REPORT ONLY'}\n`);

  // One unloadable model must not take the whole run down — that is exactly the
  // situation you are most likely to be running this script in.
  const modelsDir = path.join(__dirname, 'models');
  const failed = [];
  for (const file of fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'))) {
    try {
      require(path.join(modelsDir, file));
    } catch (err) {
      failed.push(`${file}: ${err.message}`);
    }
  }
  if (failed.length) {
    console.warn('Could not load these models (their indexes are NOT covered by this run):');
    failed.forEach((f) => console.warn('   ! ' + f));
    console.warn('');
  }

  let created = 0;
  let dropped = 0;

  for (const name of mongoose.modelNames().sort()) {
    const Model = mongoose.model(name);
    const declared = Model.schema.indexes().map(([spec]) => JSON.stringify(spec));

    let existing = [];
    let collectionMissing = false;
    try {
      existing = await Model.collection.indexes();
    } catch {
      // The collection has not been created yet (nothing has ever been written
      // to it). Its declared indexes still need building, so report them rather
      // than skipping — this is the normal state for a brand-new model.
      collectionMissing = true;
    }

    const existingSpecs = existing.filter((i) => i.name !== '_id_').map((i) => JSON.stringify(i.key));
    const missing = declared.filter((d) => !existingSpecs.includes(d));
    const extra = existing
      .filter((i) => i.name !== '_id_' && !declared.includes(JSON.stringify(i.key)))
      .map((i) => i.name);

    if (!missing.length && !extra.length) continue;

    console.log(`${name}:${collectionMissing ? '   (collection does not exist yet)' : ''}`);
    missing.forEach((m) => console.log(`   + will build  ${m}`));
    extra.forEach((e) => console.log(`   - will DROP   ${e}   <-- not declared in any schema`));

    if (APPLY) {
      // createIndexes() only builds what is missing. syncIndexes() would also
      // DROP anything undeclared, which is destructive enough that it stays
      // opt-in behind --prune.
      if (PRUNE) {
        const removed = await Model.syncIndexes();
        console.log(`   synced. dropped: ${JSON.stringify(removed)}`);
      } else {
        await Model.createIndexes();
        console.log('   built missing indexes (nothing dropped — pass --prune to also drop)');
      }
    }
    created += missing.length;
    dropped += extra.length;
    console.log('');
  }

  if (!created && !dropped) console.log('Everything already matches the schemas. Nothing to do.');
  else if (!APPLY) console.log(`\n${created} to build, ${dropped} to drop. Re-run with --apply to execute.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
