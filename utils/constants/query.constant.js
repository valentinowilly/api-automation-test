/**
 * This file contains SQL query constants for the AIGEN, ISOURCING, and ISEARCH databases.
 * These queries are used in the database helper functions for setup, verification, and teardown in tests.
 * Each query is defined as a constant string with placeholders for parameters.
 * The queries are organized by database for clarity and maintainability.
 */
export const AIGEN_QUERIES = {
    GET_USER_BY_EMAIL: 'SELECT * FROM users WHERE email = ?',
    GET_USER_BY_ID: 'SELECT * FROM users WHERE id = ?',
}

export const ISOURCING_QUERIES = {
    GET_PR_BY_ID: 'SELECT * FROM pr WHERE id = ?',
    GET_PR_ITEMS_BY_PR_ID: 'SELECT * FROM pr_items WHERE pr_id = ?',
    GET_PR_APPROVALS_BY_PR_ID: 'SELECT * FROM pr_approvals WHERE pr_id = ?',
}

export const ISEARCH_QUERIES = {
    GET_CONFIG_BY_KEY: 'SELECT * FROM config WHERE `key` = ?',
}