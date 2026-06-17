export const CONFIG_AUTOPO_TYPES = {
  VALIDATION: 'pr_validation',
  SETTING_PARAMETER: 'setting_parameter',
};

export const SERVER_GROUPS = {
  BCG: 'BCG',
  GEMS: 'GEMS',
};

export const CONFIG_OPERATORS = {
  EQUALS: '=',
  NOT_EQUALS: '!=',
  GREATER_THAN: '>',
  LESS_THAN: '<',
  GREATER_THAN_OR_EQUAL: '>=',
  LESS_THAN_OR_EQUAL: '<=',
  IN: 'in',
  NOT_IN: 'not_in',
  IS_NULL: 'is_null',
  NOT_NULL: 'not_null',
};

export const SKIP_LEVEL_1_RFQ = {
  YES: 'yes',
  NO: 'no',
};

export const CONFIG_CONDITIONS = {
  SKIP_LEVEL_1_RFQ: 'skip_level_1_RFQ',
  QCF_APPROVAL_LEVEL: 'qcf_approval_level',
  WAITING_VENDOR_DIRECT_EXPIRY: 'Waiting_vendor_direct_expiry',
  WAITING_VENDOR_EXPIRY: 'Waiting_vendor_expiry',
  WAITING_DIC_REVIEW_EXPIRY: 'Waiting_DIC_review_expiry',
  WAITING_CS_EXPIRY: 'Waiting_CS_expiry',
  WAITING_CL_REVIEW_EXPIRY: 'Waiting_CL_review_expiry',
  WAITING_MANAGEMENT_REVIEW_EXPIRY: 'Waiting_Management_review_expiry',
  WAITING_OE_REVISION_EXPIRY: 'Waiting_OE_revision_expiry',
  DIC_EMAIL_REMINDER_INTERVAL: 'DIC_Email_Reminder_interval',
  HIDE_OE_IN_VENDOR_RFQ: 'hide_oe_in_vendor_rfq',
  HIDE_PRICE_NEGOTIATION: 'hide_price_negotiation',
  MIN_PRICE: 'Min_price',
  MAX_PRICE: 'Max_price',
  VALUE: 'value',
  SRC_VALUE: 'src_value',
  IM_NUMBER: 'im_number',
  IS_DA: 'is_da',
  IS_DELETE: 'is_delete',
  IS_OA: 'is_oa',
  OEM: 'oem',
  PLANT_CODE: 'plant_code',
  PR_TYPE: 'pr_type',
};

export const VENDOR_TYPES = {
  DIRECT: 'direct',
  AGGREGATOR: 'agregator',
};

export const VENDOR_SEQUENCE = {
  DIRECT_FIRST: 1,
  AGGREGATOR_SECOND: 2,
  PARALLEL: 3,
};

export const QCF_APPROVAL_LEVELS = {
  BCG: 'category leader, management',
  GEMS: 'category leader',
};

export const HIDE_OE_IN_VENDOR_RFQ = {
  YES: 'yes',
  NO: 'no',
};

export const HIDE_PRICE_NEGOTIATION = {
  YES: 'yes',
  NO: 'no',
};