#!/usr/bin/env node

/**
 * Setup script för Stora Lundby engagemang-system
 * Konfigurerar Google Apps Script och lokal utveckling
 */

const fs = require('fs');
const path = require('path');

console.log('\n🚀 Stora Lundby - Setup');
console.log('=' .repeat(50));

const checkFile = (filePath, name) => {
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${name}`);
    return true;
  }
  console.log(`✗ ${name} - NOT FOUND`);
  return false;
};

const requiredFiles = [
  ['package.json', 'package.json'],
  ['src/main-public.jsx', 'Public entry'],
  ['src/components/PublicWizard.jsx', 'Public Wizard component'],
  ['src/components/AdminDashboard.jsx', 'Admin Dashboard component'],
  ['src/utils/googleAppsScriptApi.js', 'API wrapper']
];

console.log('\n📋 Kontrollerar filer...');
let allFilesOK = true;
requiredFiles.forEach(([filePath, name]) => {
  if (!checkFile(filePath, name)) {
    allFilesOK = false;
  }
});

if (!allFilesOK) {
  console.log('\n❌ Några filer saknas. Avbryter.');
  process.exit(1);
}

console.log('\n✅ Alla filer kontrolleras.');
console.log('\n📖 Nästa steg:');
console.log('1. npm install');
console.log('2. npm run dev');
console.log('3. Se README.md för Google Apps Script-setup\n');
