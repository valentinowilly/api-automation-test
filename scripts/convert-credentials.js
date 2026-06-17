#!/usr/bin/env node

/**
 * CSV to JSON Credential Converter
 *
 * Converts the CSV credential file into a structured JSON format
 * for use in API automation tests.
 *
 * Usage: npm run convert:credentials
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../docs/credential-test-data.csv');
const OUTPUT_PATH = path.join(__dirname, '../fixtures/credentials.json');

function parseCSV(csvContent) {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

  // Extract development credentials (lines with actual data)
  // Skip line 0 (empty), line 1 (URL), line 2 (headers)
  const dataLines = lines.slice(3, 14); // Lines 4-14 in the CSV (index 3-13)

  const credentials = [];

  let lastRole = ''; // Track the last non-empty role for rows with empty role column

  dataLines.forEach((line, index) => {
    const columns = line.split(',');

    // Extract data from columns
    let role = columns[0] || '';
    const subRole = columns[1] || '';
    const email = columns[2] || '';
    const password = columns[3] || '';
    const note = columns[4] || '';

    // Skip empty lines or lines without email
    if (!email) return;

    // If role is empty but we have an email, use the last role (for CS rows)
    if (!role || role.trim() === '') {
      role = lastRole;
    } else {
      lastRole = role; // Update last role
    }

    const credentialData = {
      email: email.trim(),
      password: password.trim()
    };

    // Map to appropriate credential structure
    const roleKey = role.trim().toLowerCase();
    const subRoleKey = subRole.trim().toLowerCase();

    if (roleKey === 'admin') {
      credentialData.role = 'admin';
    } else if (roleKey === 'user (dic)') {
      credentialData.role = 'dic';
    } else if (roleKey === 'vendor') {
      credentialData.role = 'vendor';
    } else if (roleKey === 'user management') {
      credentialData.role = 'manajemen';
      if (note && note.trim()) {
        credentialData.note = note.trim().toLowerCase();
      }
    } else if (roleKey === 'mrr') {
      if (subRoleKey.includes('category leader') || subRoleKey.includes('cl')) {
        credentialData.role = 'cl';
        credentialData.category = 'mrr';
      } else if (subRoleKey.includes('category staff') || subRoleKey.includes('cs')) {
        credentialData.role = 'cs';
        credentialData.category = 'mrr';
      }
    } else if (roleKey === 'it') {
      if (subRoleKey.includes('category leader') || subRoleKey.includes('cl')) {
        credentialData.role = 'cl';
        credentialData.subRole = 'it';
      } else if (subRoleKey.includes('category staff') || subRoleKey.includes('cs')) {
        credentialData.role = 'cs';
        credentialData.subRole = 'it';
      }
    } else if (roleKey === 'gsl') {
      if (subRoleKey.includes('category leader') || subRoleKey.includes('cl')) {
        credentialData.role = 'cl';
        credentialData.subRole = 'gsl';
      } else if (subRoleKey.includes('category staff') || subRoleKey.includes('cs')) {
        credentialData.role = 'cs';
        credentialData.subRole = 'gsl';
      }
    }

    // Only add if role was successfully mapped
    if (credentialData.role) {
      credentials.push(credentialData);
    }
  });

  return credentials;
}

function main() {
  console.log('Converting credentials from CSV to JSON...\n');

  // Check if CSV file exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  // Read CSV file
  console.log(`Reading CSV file: ${CSV_PATH}`);
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

  // Parse CSV
  console.log('Parsing CSV content...');
  const credentials = parseCSV(csvContent);

  // Create fixtures directory if it doesn't exist
  const fixturesDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // Write JSON file
  console.log(`Writing JSON file: ${OUTPUT_PATH}`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(credentials, null, 2), 'utf-8');

  // Display summary
  console.log('\n✓ Conversion completed successfully!\n');
  console.log('Summary:');

  const adminCred = credentials.find(c => c.role === 'admin');
  const dicCred = credentials.find(c => c.role === 'dic');
  const vendorCred = credentials.find(c => c.role === 'vendor');
  const userMgmtCreds = credentials.filter(c => c.role === 'manajemen');
  const mrrCL = credentials.find(c => c.role === 'cl' && c.category === 'mrr');
  const mrrCS = credentials.find(c => c.role === 'cs' && c.category === 'mrr');
  const itCL = credentials.find(c => c.role === 'cl' && c.subRole === 'it');
  const itCS = credentials.find(c => c.role === 'cs' && c.subRole === 'it');
  const gslCL = credentials.find(c => c.role === 'cl' && c.subRole === 'gsl');
  const gslCS = credentials.find(c => c.role === 'cs' && c.subRole === 'gsl');

  console.log(`  - Admin: ${adminCred ? '✓' : '✗'}`);
  console.log(`  - DIC User: ${dicCred ? '✓' : '✗'}`);
  console.log(`  - Vendor: ${vendorCred ? '✓' : '✗'}`);
  console.log(`  - User Management: ${userMgmtCreds.length} users`);
  console.log(`  - MRR (CL): ${mrrCL ? '✓' : '✗'}`);
  console.log(`  - MRR (CS): ${mrrCS ? '✓' : '✗'}`);
  console.log(`  - IT (CL): ${itCL ? '✓' : '✗'}`);
  console.log(`  - IT (CS): ${itCS ? '✓' : '✗'}`);
  console.log(`  - GSL (CL): ${gslCL ? '✓' : '✗'}`);
  console.log(`  - GSL (CS): ${gslCS ? '✓' : '✗'}`);
  console.log(`\nTotal credentials: ${credentials.length}`);
  console.log(`Output file: ${OUTPUT_PATH}\n`);
}

// Run the script
main();
