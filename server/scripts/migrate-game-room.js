#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const cmd = path.basename(__filename, '.js').replace(/^migrate-/, 'db:migrate:');
const script = path.resolve(__dirname, 'deprecated-migration.js');
spawnSync(process.execPath, [script, cmd], { stdio: 'inherit' });
