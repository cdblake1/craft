'use strict';

// storage.js -- craft's storage adapter (document operations).
//
// The adapter is the single data layer beneath both MCPs (journal + compose)
// and every hook: callers address data by a logical, '/'-separated key and
// never touch the filesystem directly. This file is the git-backed file
// adapter; a future multi-user adapter (e.g. GitHub Issues/Projects for the
// node shape) implements the same surface (design 0001, D2).
//
// Slice 1 is document operations only. Cross-machine sync (git pull/push,
// merge=union, the singleton lock) is a later slice that wraps this adapter.
//
// Root resolution:
//   1. opts.root (tests pass a temp dir)
//   2. $CRAFT_DATA_ROOT
//   3. ~/.copilot/craft-data  (provisional; the unified per-host data repo)

const fs = require('fs');
const os = require('os');
const path = require('path');

function defaultDataRoot() {
    if (process.env.CRAFT_DATA_ROOT) { return process.env.CRAFT_DATA_ROOT; }
    return path.join(os.homedir(), '.copilot', 'craft-data');
}

// Map a logical key ('a/b/c.md') to a native path under the root. Leading
// slashes are stripped so a key can never escape the root.
function _toNative(root, key) {
    const rel = String(key).replace(/^[/\\]+/, '').replace(/\//g, path.sep);
    return path.join(root, rel);
}

function createFileStore(opts) {
    opts = opts || {};
    const root = opts.root || defaultDataRoot();

    function read(key) {
        try { return fs.readFileSync(_toNative(root, key), 'utf8'); }
        catch (_) { return null; }
    }

    // Atomic write: temp file in the target dir, then rename over the target.
    function write(key, content) {
        const target = _toNative(root, key);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const tmp = target + '.tmp.' + process.pid + '.' + Date.now();
        fs.writeFileSync(tmp, content, 'utf8');
        fs.renameSync(tmp, target);
    }

    function append(key, text) {
        const target = _toNative(root, key);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, text, 'utf8');
    }

    function exists(key) {
        try { fs.accessSync(_toNative(root, key)); return true; }
        catch (_) { return false; }
    }

    function remove(key) {
        try { fs.rmSync(_toNative(root, key), { force: true }); } catch (_) { /* idempotent */ }
    }

    // Logical keys of every file under a prefix, recursively. Forward-slashed,
    // relative to the root. Temp files (mid-write) are excluded.
    function list(prefix) {
        const base = _toNative(root, prefix || '');
        const out = [];
        function walk(dir) {
            let entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
            catch (_) { return; }
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) { walk(full); }
                else if (e.isFile() && !/\.tmp\.\d+\.\d+$/.test(e.name)) {
                    out.push(path.relative(root, full).replace(/\\/g, '/'));
                }
            }
        }
        walk(base);
        return out;
    }

    return { read, write, append, exists, remove, list, root };
}

module.exports = { createFileStore, defaultDataRoot };
