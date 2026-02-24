#!/usr/bin/env node
/**
 * Temporary script to merge docs i18n sections from agent output files
 * into en.json and es.json. Run once and delete.
 */
const fs = require('fs');

const outputFiles = [
  '/private/tmp/claude-501/-Users-sme-NEL-deal-room-todo/tasks/a572618.output',
  '/private/tmp/claude-501/-Users-sme-NEL-deal-room-todo/tasks/a9bdeb6.output',
  '/private/tmp/claude-501/-Users-sme-NEL-deal-room-todo/tasks/a5517da.output',
  '/private/tmp/claude-501/-Users-sme-NEL-deal-room-todo/tasks/a7c8dfd.output',
];

const enSections = {};
const esSections = {};

for (const file of outputFiles) {
  console.log(`\nProcessing: ${file}`);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry.message?.content) continue;

    for (const block of entry.message.content) {
      if (block.type !== 'text') continue;
      const text = block.text;

      // Match: ## EN JSON ... \n\n```json\n...\n```
      // Also match: ## ES JSON ... \n\n```json\n...\n```
      const regex = /## (EN|ES) JSON[^\n]*\n\n```json\n([\s\S]*?)```/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const lang = match[1];
        const jsonStr = match[2].trim();

        try {
          const parsed = JSON.parse(`{${jsonStr}}`);
          const key = Object.keys(parsed)[0];
          const numKeys = Object.keys(parsed[key]).length;

          if (lang === 'EN') {
            enSections[key] = parsed[key];
            console.log(`  EN: ${key} (${numKeys} keys)`);
          } else {
            esSections[key] = parsed[key];
            console.log(`  ES: ${key} (${numKeys} keys)`);
          }
        } catch (e) {
          console.error(`  Failed to parse ${lang} JSON: ${e.message}`);
          console.error('  First 200 chars:', jsonStr.substring(0, 200));
        }
      }
    }
  }
}

console.log('\n--- Summary ---');
console.log('EN sections:', Object.keys(enSections).sort().join(', '));
console.log('ES sections:', Object.keys(esSections).sort().join(', '));

const expectedSections = ['agentApi', 'compromise', 'docsHome', 'howItWorks', 'skills', 'supervision', 'vetting'];
const missingEn = expectedSections.filter(s => !enSections[s]);
const missingEs = expectedSections.filter(s => !esSections[s]);

if (missingEn.length || missingEs.length) {
  if (missingEn.length) console.error('Missing EN:', missingEn.join(', '));
  if (missingEs.length) console.error('Missing ES:', missingEs.join(', '));
  console.error('Aborting — not all 7 sections found.');
  process.exit(1);
}

// Read current message files
const enPath = __dirname + '/../src/messages/en.json';
const esPath = __dirname + '/../src/messages/es.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const es = JSON.parse(fs.readFileSync(esPath, 'utf-8'));

// Check for collisions
for (const key of Object.keys(enSections)) {
  if (en[key]) console.warn(`WARNING: EN already has key "${key}" — will overwrite`);
}
for (const key of Object.keys(esSections)) {
  if (es[key]) console.warn(`WARNING: ES already has key "${key}" — will overwrite`);
}

// Add new sections
Object.assign(en, enSections);
Object.assign(es, esSections);

// Reorder: put footer last
function reorder(obj) {
  const { footer, ...rest } = obj;
  return { ...rest, footer };
}

fs.writeFileSync(enPath, JSON.stringify(reorder(en), null, 2) + '\n');
fs.writeFileSync(esPath, JSON.stringify(reorder(es), null, 2) + '\n');

console.log('\nDone! Files updated:');
console.log(`  ${enPath}`);
console.log(`  ${esPath}`);
