# Test Suite

This directory contains tests for the vite-mcp adapters and functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run a specific test file
npm test -- test/console.test.ts
```

## Test Structure

### `console.test.ts`

Tests for the console adapter (`src/adapter/console.ts`):

- **Input Schema Validation**: Tests for validating input parameters (limit, type)
- **Output Schema Validation**: Tests for validating output structure (messages array)
- **Adapter Definition**: Tests for adapter metadata (name, description, schemas)
- **Integration Tests**: Tests for complete input/output flow and real-world scenarios

## Test Coverage

The tests cover:

1. ✅ Valid input validation (with and without optional parameters)
2. ✅ Invalid input rejection (negative numbers, invalid types, etc.)
3. ✅ Default value handling
4. ✅ Output schema validation
5. ✅ Real-world message structure validation
6. ✅ Adapter definition correctness

## Adding New Tests

When adding tests for a new adapter:

1. Create a new test file: `test/[adapter-name].test.ts`
2. Follow the same structure as `console.test.ts`
3. Test input schema, output schema, and adapter definition
4. Include integration tests for real-world scenarios

