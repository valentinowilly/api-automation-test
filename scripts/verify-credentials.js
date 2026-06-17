#!/usr/bin/env node

/**
 * Credential Helper Verification Script
 *
 * Verifies that all credential helper functions work correctly
 * with the refactored array-based credential structure.
 *
 * Usage: node scripts/verify-credentials.js
 */

import {
  getAdminCredential,
  getDicCredential,
  getVendorCredential,
  getCLCredential,
  getCSCredential,
  getUserManagementCredential,
  getCategoryCredentials,
  getAllUserManagementCredentials
} from '../helpers/credentials.helper.js';

function testFunction(name, fn, expectedEmail) {
  try {
    const result = fn();
    if (result && result.email === expectedEmail) {
      console.log(`✓ ${name}`);
      console.log(`  Email: ${result.email}`);
      return true;
    } else {
      console.log(`✗ ${name}`);
      console.log(`  Expected: ${expectedEmail}`);
      console.log(`  Got: ${result ? result.email : 'null'}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

function testCategoryFunction(name, fn, expectedCLEmail, expectedCSEmail) {
  try {
    const result = fn();
    const clMatch = result.cl && result.cl.email === expectedCLEmail;
    const csMatch = result.cs && result.cs.email === expectedCSEmail;

    if (clMatch && csMatch) {
      console.log(`✓ ${name}`);
      console.log(`  CL Email: ${result.cl.email}`);
      console.log(`  CS Email: ${result.cs.email}`);
      return true;
    } else {
      console.log(`✗ ${name}`);
      console.log(`  Expected CL: ${expectedCLEmail}, Got: ${result.cl ? result.cl.email : 'null'}`);
      console.log(`  Expected CS: ${expectedCSEmail}, Got: ${result.cs ? result.cs.email : 'null'}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('Verifying credential helper functions...\n');

  let passed = 0;
  let failed = 0;

  // Test basic credential functions
  console.log('Basic Credentials:');
  if (testFunction('getAdminCredential()', getAdminCredential, 'procurement@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getDicCredential()', getDicCredential, 'agus.setiabudi@mtl.co.id')) passed++; else failed++;
  if (testFunction('getVendorCredential()', getVendorCredential, 'kaliwijaya@gmail.com')) passed++; else failed++;
  console.log('');

  // Test category-based credential functions
  console.log('Category Leader (CL) Credentials:');
  if (testFunction('getCLCredential("mrr")', () => getCLCredential('mrr'), 'nicky.laksmana@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getCLCredential("it")', () => getCLCredential('it'), 'yusdi.kurniawan@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getCLCredential("gsl")', () => getCLCredential('gsl'), 'aryo.heruprastowo@sinarmasmining.com')) passed++; else failed++;
  console.log('');

  console.log('Category Staff (CS) Credentials:');
  if (testFunction('getCSCredential("mrr")', () => getCSCredential('mrr'), 'cellina.trishana@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getCSCredential("it")', () => getCSCredential('it'), 'joseph.rianto@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getCSCredential("gsl")', () => getCSCredential('gsl'), 'katharinaes.ea@techconnect.co.id')) passed++; else failed++;
  console.log('');

  // Test user management credentials
  console.log('User Management Credentials:');
  if (testFunction('getUserManagementCredential(0)', () => getUserManagementCredential(0), 'pan.barlian@sinarmasmining.com')) passed++; else failed++;
  if (testFunction('getUserManagementCredential(1)', () => getUserManagementCredential(1), 'ardi.margusano@sinarmasmining.com')) passed++; else failed++;
  console.log('');

  // Test category credentials (returns object with cl and cs)
  console.log('Category Credentials (CL + CS):');
  if (testCategoryFunction(
    'getCategoryCredentials("mrr")',
    () => getCategoryCredentials('mrr'),
    'nicky.laksmana@sinarmasmining.com',
    'cellina.trishana@sinarmasmining.com'
  )) passed++; else failed++;

  if (testCategoryFunction(
    'getCategoryCredentials("it")',
    () => getCategoryCredentials('it'),
    'yusdi.kurniawan@sinarmasmining.com',
    'joseph.rianto@sinarmasmining.com'
  )) passed++; else failed++;

  if (testCategoryFunction(
    'getCategoryCredentials("gsl")',
    () => getCategoryCredentials('gsl'),
    'aryo.heruprastowo@sinarmasmining.com',
    'katharinaes.ea@techconnect.co.id'
  )) passed++; else failed++;
  console.log('');

  // Test getAllUserManagementCredentials
  console.log('All User Management Credentials:');
  try {
    const allUserMgmt = getAllUserManagementCredentials();
    if (Array.isArray(allUserMgmt) && allUserMgmt.length === 2) {
      console.log(`✓ getAllUserManagementCredentials()`);
      console.log(`  Count: ${allUserMgmt.length}`);
      allUserMgmt.forEach((cred, index) => {
        console.log(`  [${index}] ${cred.email}`);
      });
      passed++;
    } else {
      console.log(`✗ getAllUserManagementCredentials()`);
      console.log(`  Expected 2 credentials, got ${allUserMgmt ? allUserMgmt.length : 0}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ getAllUserManagementCredentials()`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
  console.log('');

  // Summary
  console.log('═'.repeat(50));
  console.log('Summary:');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${passed + failed}`);
  console.log('═'.repeat(50));

  if (failed === 0) {
    console.log('\n✓ All credential helper functions are working correctly!\n');
    process.exit(0);
  } else {
    console.log(`\n✗ ${failed} test(s) failed. Please check the errors above.\n`);
    process.exit(1);
  }
}

// Run verification
main();
