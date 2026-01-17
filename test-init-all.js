#!/usr/bin/env node
import { initProject } from './index.js';

const templates = ['js', 'ts', 'rust-js', 'rust-ts'];

for (const template of templates) {
    const name = `test-apps/test-${template}`;
    console.log(`\nCreating ${name} with template ${template}...`);
    await initProject(name, template);
}

console.log('\n✅ All test apps created!');

