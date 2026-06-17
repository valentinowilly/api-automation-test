import { beforeAll, afterAll } from 'vitest';
import { testAllConnections, closeAllPools } from '../config/database.js';
import env from '../config/env.js';

beforeAll(async () => {
  // console.log('\n🚀 Starting API Automation Tests...\n');
  // console.log('Environment Configuration:');
  // console.log(`  API Base URL: ${env.api.baseURL}`);
  // console.log(`  Database Host: ${env.database.host}:${env.database.port}`);
  // console.log(`  Mailpit API: ${env.mailpit.apiURL}\n`);

  // console.log('Testing database connections...');
  const connectionResults = await testAllConnections();

  const allConnected = connectionResults.every((result) => result.success);

  if (!allConnected) {
    const failedConnections = connectionResults
      .filter((result) => !result.success)
      .map((result) => `  ❌ ${result.database}: ${result.error}`)
      .join('\n');

    console.error('❌ Database connection failed:\n' + failedConnections);
    throw new Error('Failed to connect to one or more databases');
  }

  // connectionResults.forEach((result) => {
  //   console.log(`  ✅ ${result.database} connection successful`);
  // });

  // console.log('\n✅ All database connections established\n');
  // console.log('─'.repeat(80));
});

afterAll(async () => {
  // console.log('\n' + '─'.repeat(80));
  // console.log('\n🏁 Closing database connections...');
  await closeAllPools();
  // console.log('✅ All database connections closed\n');
});
