// Force test environment variables before anything else can read them
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-32-characters-minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-32-characters-minimum';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { env } from '../src/config/env.js';

let replSet;
let testUri;

beforeAll(async () => {
  // Use MONGODB_TEST_URI if explicitly provided in environment, otherwise spin up dedicated in-memory replica set
  if (process.env.MONGODB_TEST_URI) {
    testUri = process.env.MONGODB_TEST_URI;
  } else {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    testUri = replSet.getUri('medstock_test');
  }

  // Safety check: Never allow tests to run against the development 'medstock' database
  if (testUri.includes('/medstock?') || testUri.endsWith('/medstock')) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Tests attempted to connect to development database '${testUri}'. ` +
      `Tests must only run against an isolated test database (e.g. 'medstock_test' or MongoMemoryReplSet).`
    );
  }

  // Override environment MONGODB_URI so any code reading env.MONGODB_URI uses the test database
  process.env.MONGODB_URI = testUri;
  env.MONGODB_URI = testUri;

  await mongoose.connect(testUri);
  console.log(`[TEST SETUP] Connected to isolated test database: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
      }
    } catch {
      // ignore drop errors on teardown
    }
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
});

beforeEach(async () => {
  // Clear all collections between test cases for clean isolation
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
