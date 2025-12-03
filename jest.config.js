module.exports = {
  // Use ts-jest for handling TypeScript files
  preset: 'ts-jest',

  // Set the test environment to 'node' since it's a backend application
  testEnvironment: 'node',

  // Pattern to find test files (e.g., 'src/**/*.test.ts')
  testMatch: ['**/tests/**/*.test.ts', '**/?(*.)+(spec|test).ts'],

  // Files to run before each test suite (essential for MongoDB setup/teardown)
  setupFilesAfterEnv: ['./tests/test-setup/mongo.setup.ts'],
  
  // Exclude node_modules from processing
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Set a longer timeout for tests that hit the database
  testTimeout: 20000, 
};