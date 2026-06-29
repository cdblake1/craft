'use strict';

// registry.js -- THE explicit ordered hook registry. This is the single footgun
// fix that motivated the Node dispatcher (D1): copilot-tools derived handler
// order from a `@dispatcher-order: N` header comment and silently dropped a
// handler when two shared a number. Here, order is the array order, full stop.
// To add a handler: require it and place it where it should run. To reorder:
// move the line. There is no implicit ordering and no discovery.

const findingsInjector = require('./handlers/findings-injector');
const workTreeInjector = require('./handlers/work-tree-injector');
const skillCatalogInjector = require('./handlers/skill-catalog-injector');
const skillRouter = require('./handlers/skill-router');
const draftSeeder = require('./handlers/draft-seeder');
const recapWriter = require('./handlers/recap-writer');
const findingsConsult = require('./handlers/findings-consult');
const failureRecord = require('./handlers/failure-record');
const failureCapture = require('./handlers/failure-capture');
const syncPull = require('./handlers/sync-pull');
const syncPush = require('./handlers/sync-push');

// event -> handlers, in the exact order they run for that event. Ordering is
// load-bearing here: sync-pull runs FIRST at sessionStart so the injectors read
// cross-machine-current data, and sync-push runs LAST at sessionEnd so it ships
// every writer's output. The dispatcher merges the injectors' additionalContext.
// skill-catalog-injector runs last at sessionStart so its always-on skill catalog
// trails the data-driven resume/work-tree blocks. skill-router is the sole
// userPromptSubmitted handler: it steers each prompt into the matching skill.
module.exports = {
    sessionStart: [syncPull, findingsInjector, workTreeInjector, skillCatalogInjector],
    userPromptSubmitted: [skillRouter],
    postToolUse: [findingsConsult],
    postToolUseFailure: [failureRecord],
    sessionEnd: [draftSeeder, recapWriter, failureCapture, syncPush],
};
