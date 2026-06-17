import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  validateFormats: true,
});
addFormats(ajv);

let openApiSpec = null;

const loadOpenAPISpec = () => {
  if (openApiSpec) return openApiSpec;

  const specPath = path.resolve(__dirname, '../../docs/openapi/openapi.bundle.yaml');
  const specContent = fs.readFileSync(specPath, 'utf8');
  openApiSpec = yaml.load(specContent);

  // Load all component schemas into AJV so it can resolve $ref pointers
  if (openApiSpec.components?.schemas) {
    Object.entries(openApiSpec.components.schemas).forEach(([name, schema]) => {
      try {
        ajv.addSchema(schema, `#/components/schemas/${name}`);
      } catch (error) {
        // Schema might already be added, ignore
      }
    });
  }

  // Load all component responses into AJV
  if (openApiSpec.components?.responses) {
    Object.entries(openApiSpec.components.responses).forEach(([name, response]) => {
      try {
        if (response.content?.['application/json']?.schema) {
          ajv.addSchema(response.content['application/json'].schema, `#/components/responses/${name}`);
        }
      } catch (error) {
        // Schema might already be added, ignore
      }
    });
  }

  return openApiSpec;
};

/**
 * Resolve a $ref pointer in the OpenAPI spec
 *
 * @param {string} ref - Reference string (e.g., '#/components/responses/Unauthorized')
 * @param {object} spec - OpenAPI specification object
 * @param {Set} visited - Set of visited refs to prevent infinite loops
 * @returns {object|null} - Resolved object or null if not found
 */
const resolveRef = (ref, spec, visited = new Set()) => {
  if (!ref || typeof ref !== 'string') return null;

  // Prevent infinite loops
  if (visited.has(ref)) {
    console.warn(`Circular reference detected: ${ref}`);
    return null;
  }
  visited.add(ref);

  // Only handle internal refs (starting with #/)
  if (!ref.startsWith('#/')) {
    console.warn(`External references not supported: ${ref}`);
    return null;
  }

  // Parse the reference path (e.g., '#/components/responses/Unauthorized')
  const refPath = ref.substring(2); // Remove '#/'
  const parts = refPath.split('/');

  // Navigate the spec object
  let resolved = spec;
  for (const part of parts) {
    if (!resolved || typeof resolved !== 'object') {
      console.warn(`Failed to resolve ref path: ${ref} at part: ${part}`);
      return null;
    }
    resolved = resolved[part];
  }

  // If the resolved object itself contains a $ref, recursively resolve it
  if (resolved && typeof resolved === 'object' && resolved.$ref) {
    return resolveRef(resolved.$ref, spec, visited);
  }

  return resolved;
};

/**
 * Get response schema from OpenAPI spec for a specific endpoint and status code
 *
 * @param {string} path - API path (e.g., '/auth/me')
 * @param {string} method - HTTP method (e.g., 'get', 'post')
 * @param {number|string} statusCode - HTTP status code (e.g., 200, '200')
 * @returns {object|null} - JSON schema or null if not found
 */
export const getResponseSchema = (path, method, statusCode = 200) => {
  const spec = loadOpenAPISpec();
  const pathItem = spec.paths[path];

  if (!pathItem) {
    console.warn(`Path not found in OpenAPI spec: ${path}`);
    return null;
  }

  const operation = pathItem[method.toLowerCase()];
  if (!operation) {
    console.warn(`Method ${method} not found for path: ${path}`);
    return null;
  }

  let response = operation.responses[String(statusCode)];
  if (!response) {
    console.warn(`Status code ${statusCode} not found for ${method.toUpperCase()} ${path}`);
    return null;
  }

  // Resolve $ref if the response itself is a reference
  if (response.$ref) {
    response = resolveRef(response.$ref, spec);
    if (!response) {
      console.warn(`Failed to resolve response $ref for ${method.toUpperCase()} ${path} ${statusCode}`);
      return null;
    }
  }

  const content = response.content?.['application/json'];
  if (!content || !content.schema) {
    console.warn(`No JSON schema found for ${method.toUpperCase()} ${path} ${statusCode}`);
    return null;
  }

  let schema = content.schema;

  // Resolve $ref if the schema itself is a reference
  if (schema.$ref) {
    schema = resolveRef(schema.$ref, spec);
    if (!schema) {
      console.warn(`Failed to resolve schema $ref for ${method.toUpperCase()} ${path} ${statusCode}`);
      return null;
    }
  }

  return schema;
};

/**
 * Validate response data against OpenAPI schema
 *
 * @param {object} responseData - Response data to validate
 * @param {string} path - API path (e.g., '/auth/me')
 * @param {string} method - HTTP method (e.g., 'get', 'post')
 * @param {number|string} statusCode - HTTP status code (e.g., 200)
 * @returns {object} - { valid: boolean, errors: array }
 */
export const validateResponseSchema = (responseData, path, method, statusCode = 200) => {
  const schema = getResponseSchema(path, method, statusCode);

  if (!schema) {
    return {
      valid: false,
      errors: [`No schema found for ${method.toUpperCase()} ${path} ${statusCode}`],
    };
  }

  const validate = ajv.compile(schema);
  const valid = validate(responseData);

  return {
    valid,
    errors: valid ? [] : validate.errors,
  };
};

/**
 * Assert that response matches OpenAPI schema (for use in tests)
 *
 * @param {object} response - Axios response object
 * @param {string} path - API path (e.g., '/auth/me')
 * @param {string} method - HTTP method (e.g., 'get', 'post')
 * @param {number|string} expectedStatusCode - Expected HTTP status code
 */
export const expectResponseToMatchSchema = (response, path, method, expectedStatusCode = 200) => {
  // Check status code
  expect(response.status).toBe(Number(expectedStatusCode));

  // Check Content-Type header
  expect(response.headers['content-type']).toMatch(/application\/json/);

  // Validate response schema
  const validation = validateResponseSchema(response.data, path, method, expectedStatusCode);

  if (!validation.valid) {
    const errorMessages = validation.errors.map(err => {
      const dataPath = err.instancePath || err.dataPath || 'root';
      return `${dataPath}: ${err.message}`;
    }).join('\n  ');

    console.log(`Schema validation errors for ${method.toUpperCase()} ${path} (${expectedStatusCode}):\n  ${errorMessages}`);

    throw new Error(
      `Response schema validation failed for ${method.toUpperCase()} ${path} (${expectedStatusCode}):\n  ${errorMessages}`
    );
  }

  expect(validation.valid).toBe(true);
};

/**
 * Get all required fields from a schema
 *
 * @param {object} schema - JSON schema object
 * @param {string} prefix - Prefix for nested fields (for recursion)
 * @returns {array} - Array of required field paths
 */
export const getRequiredFields = (schema, prefix = '') => {
  const fields = [];

  if (schema.required && Array.isArray(schema.required)) {
    fields.push(...schema.required.map(field => prefix ? `${prefix}.${field}` : field));
  }

  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, value]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      if (value.type === 'object' && value.properties) {
        fields.push(...getRequiredFields(value, fieldPath));
      }
    });
  }

  return fields;
};

/**
 * Validate common response structure (message + data)
 *
 * @param {object} responseData - Response data
 */
export const expectStandardResponseStructure = (responseData) => {
  expect(responseData).toHaveProperty('message');
  expect(typeof responseData.message).toBe('string');
  expect(responseData).toHaveProperty('data');
};

/**
 * Validate pagination structure
 *
 * @param {object} pagination - Pagination object
 */
export const expectValidPagination = (pagination) => {
  expect(pagination).toHaveProperty('totalItems');
  expect(typeof pagination.totalItems).toBe('number');

  expect(pagination).toHaveProperty('totalPages');
  expect(typeof pagination.totalPages).toBe('number');

  expect(pagination).toHaveProperty('currentPage');
  expect(typeof pagination.currentPage).toBe('number');

  expect(pagination).toHaveProperty('itemsPerPage');
  expect(typeof pagination.itemsPerPage).toBe('number');
};

/**
 * Validate error response structure
 * Handles both string messages (simple errors) and array messages (validation errors)
 *
 * @param {object} responseData - Error response data
 */
export const expectErrorResponse = (responseData) => {
  expect(responseData).toHaveProperty('message');

  // Message can be either string (simple errors) or array (validation errors)
  const messageType = typeof responseData.message;
  expect(['string', 'object']).toContain(messageType);

  if (Array.isArray(responseData.message)) {
    // Validation errors - array of error messages
    expect(responseData.message.length).toBeGreaterThan(0);
    responseData.message.forEach((msg) => {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  } else {
    // Simple errors - single string message
    expect(typeof responseData.message).toBe('string');
    expect(responseData.message.length).toBeGreaterThan(0);
  }
};

/**
 * Validate validation error response (400 Bad Request with array of error messages)
 *
 * @param {object} responseData - Error response data
 */
export const expectValidationError = (responseData) => {
  expect(responseData).toHaveProperty('message');
  expect(Array.isArray(responseData.message)).toBe(true);
  expect(responseData.message.length).toBeGreaterThan(0);

  // Ensure each message is a non-empty string
  responseData.message.forEach((msg) => {
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
};

/**
 * Validate simple error response (single string message)
 *
 * @param {object} responseData - Error response data
 */
export const expectSimpleError = (responseData) => {
  expect(responseData).toHaveProperty('message');
  expect(typeof responseData.message).toBe('string');
  expect(responseData.message.length).toBeGreaterThan(0);
};

export default {
  getResponseSchema,
  validateResponseSchema,
  expectResponseToMatchSchema,
  getRequiredFields,
  expectStandardResponseStructure,
  expectValidPagination,
  expectErrorResponse,
  expectValidationError,
  expectSimpleError,
};
