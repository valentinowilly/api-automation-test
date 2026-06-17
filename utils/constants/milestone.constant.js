export const STATUS_MILESTONE = {
  RFQ_SENT_TO_VENDOR: 2,
  WAITING_DIC_APPROVAL: 3,
  BID_VENDOR_DECLINED: 4,
  CS_INTERVENTION: 5,
  BID_MANUAL_SOURCING: 6,
  DIC_REVIEWED: 8,
  DIC_REQUEST_REVISE: 9,
  DIC_ACCEPTED: 10,
  MANUAL_SOURCING: 12,
  WAITING_OE_REVISION: 14,
  QCF_PENDING_CL: 17,
  QCF_CL_APPROVED: 18,
  QCF_MANAGEMENT_APPROVED: 20,
  RFQ_NOT_SUBMITTED: 22,
};

export const STATUS_VENDOR = {
  NO_ACTION: 0,
  APPROVE: 1,
  REJECT: 2,
  NEED_CONFIRMATION: 3,
};

// vendor_type column in rfq_library
export const VENDOR_TYPE = {
  DIRECT: "direct",
  AGGREGATOR: "agregator",
};

// vendor_sequence column in rfq_library
export const VENDOR_SEQUENCE = {
  DIRECT_ONLY: 1,
  AGGREGATOR_ONLY: 2,
  PARALLEL: 3,
};

export const STATUS_DIC = {
  APPROVE: 1,
  DECLINE: 2,
  NEED_REVIEW: 3,
};

export const RFQ_TYPES = {
  STANDARD: "standard",
  ISOURCING: "isourcing",
};
