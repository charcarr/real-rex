// Metro needs to be told about the monorepo: by default it only looks inside
// apps/mobile, so it cannot see packages/shared or the hoisted node_modules
// at the repository root.
//
// This is the one real cost of the monorepo layout. It is ~10 lines and it
// buys us a single shared copy of the generated Supabase types.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Rebuild when anything in the workspace changes, not just this app.
config.watchFolders = [workspaceRoot];

// Look in the app's own node_modules first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
