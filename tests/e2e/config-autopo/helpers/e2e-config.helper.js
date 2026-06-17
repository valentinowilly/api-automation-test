import { executeQuery } from '../../../../utils/helpers/db.helper.js';
import { authenticatedGet, authenticatedPost } from '../../../../utils/helpers/api.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../../utils/constants/api-endpoint.constant.js';
import { CONFIG_AUTOPO_TYPES, CONFIG_CONDITIONS } from '../../../../utils/constants/config-autopo.constant.js';

const CONFIG_TABLE = 'config_autopo';

export async function cleanupDeactivatedConfigs(serverGroup, configCondition) {
  await executeQuery(
    `DELETE FROM ${CONFIG_TABLE} WHERE server_group = ? AND config_condition = ? AND is_active = 0`,
    [serverGroup, configCondition]
  );
}

export async function getSkipLevel1Config(serverGroup, adminToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${CONFIG_AUTOPO_TYPES.SETTING_PARAMETER}/${serverGroup}/${CONFIG_CONDITIONS.SKIP_LEVEL_1_RFQ}`;
  const response = await authenticatedGet(endpoint, adminToken);

  if (response.status !== 200) {
    console.error(`Failed to fetch skip_level_1_RFQ config via API:`, response.data);
    throw new Error(`Failed to fetch skip_level_1_RFQ config: ${JSON.stringify(response.data)}`);
  }

  const rows = await executeQuery(
    `SELECT * FROM ${CONFIG_TABLE} WHERE config_condition = ? AND server_group = ? AND is_active = 1 ORDER BY active_when DESC LIMIT 1`,
    [
      response.data?.data?.config_condition || CONFIG_CONDITIONS.SKIP_LEVEL_1_RFQ,
      response.data?.data?.server_group || serverGroup,
    ]
  );

  return rows[0] || null;
}

export async function getQcfApprovalLevelConfig(serverGroup, adminToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${CONFIG_AUTOPO_TYPES.SETTING_PARAMETER}/${serverGroup}/${CONFIG_CONDITIONS.QCF_APPROVAL_LEVEL}`;
  const response = await authenticatedGet(endpoint, adminToken);

  if (response.status !== 200) {
    console.error(`Failed to fetch qcf_approval_level config via API:`, response.data);
    throw new Error(`Failed to fetch qcf_approval_level config: ${JSON.stringify(response.data)}`);
  }

  const rows = await executeQuery(
    `SELECT * FROM ${CONFIG_TABLE} WHERE config_condition = ? AND server_group = ? AND is_active = 1 ORDER BY active_when DESC LIMIT 1`,
    [
      response.data?.data?.config_condition || CONFIG_CONDITIONS.QCF_APPROVAL_LEVEL,
      response.data?.data?.server_group || serverGroup
    ]
  );

  return rows[0] || null;
}

export async function getSlaConfig(serverGroup, configCondition, adminToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${CONFIG_AUTOPO_TYPES.SETTING_PARAMETER}/${serverGroup}/${configCondition}`;
  const response = await authenticatedGet(endpoint, adminToken);

  if (response.status !== 200) {
    console.error(`Failed to fetch sla config via API:`, response.data);
    throw new Error(`Failed to fetch sla config: ${JSON.stringify(response.data)}`);
  }

  const rows = await executeQuery(
    `SELECT * FROM ${CONFIG_TABLE} WHERE config_condition = ? AND server_group = ? AND is_active = 1 ORDER BY active_when DESC LIMIT 1`,
    [
      response.data?.data?.config_condition || configCondition,
      response.data?.data?.server_group || serverGroup
    ]
  );

  return rows[0] || null;
}

export async function updateSkipLevel1Config(serverGroup, newValue, adminToken) {
  const currentConfig = await getSkipLevel1Config(serverGroup, adminToken);

  if (!currentConfig) {
    throw new Error(`skip_level_1_RFQ config not found for server group: ${serverGroup}`);
  }

  const configId = currentConfig.id;
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${configId}`;
  const response = await authenticatedPost(endpoint, { config_value: newValue }, adminToken);

  if (response.status !== 200) {
    throw new Error(`Failed to update skip_level_1_RFQ config: ${JSON.stringify(response.data)}`);
  }

  await cleanupDeactivatedConfigs(serverGroup, CONFIG_CONDITIONS.SKIP_LEVEL_1_RFQ);

  return response.data;
}

export async function saveCurrentConfigState(serverGroup, adminToken) {
  const skipLevel1Config = await getSkipLevel1Config(serverGroup, adminToken);
  const qcfApprovalConfig = await getQcfApprovalLevelConfig(serverGroup, adminToken);

  return {
    skipLevel1: skipLevel1Config ? { ...skipLevel1Config } : null,
    qcfApproval: qcfApprovalConfig ? { ...qcfApprovalConfig } : null,
  };
}

export async function restoreConfigState(savedState, adminToken) {
  if (savedState.skipLevel1 && savedState.skipLevel1.id) {
    const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${savedState.skipLevel1.id}`;
    await authenticatedPost(endpoint, { config_value: savedState.skipLevel1.config_value }, adminToken);
    await cleanupDeactivatedConfigs(savedState.skipLevel1.server_group, savedState.skipLevel1.config_condition);
  }

  if (savedState.qcfApproval && savedState.qcfApproval.id) {
    const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${savedState.qcfApproval.id}`;
    await authenticatedPost(endpoint, { config_value: savedState.qcfApproval.config_value }, adminToken);
    await cleanupDeactivatedConfigs(savedState.qcfApproval.server_group, savedState.qcfApproval.config_condition);
  }
}

export async function getVendorDirectExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_VENDOR_DIRECT_EXPIRY, adminToken);
}

export async function getVendorExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_VENDOR_EXPIRY, adminToken);
}

export async function getDicReviewExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_DIC_REVIEW_EXPIRY, adminToken);
}

export async function getCsExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_CS_EXPIRY, adminToken);
}

export async function getClReviewExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_CL_REVIEW_EXPIRY, adminToken);
}

export async function getManagementReviewExpiryConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.WAITING_MANAGEMENT_REVIEW_EXPIRY, adminToken);
}

export async function getHideOeInVendorRfqConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.HIDE_OE_IN_VENDOR_RFQ, adminToken);
}

export async function updateHideOeInVendorRfqConfig(serverGroup, newValue, adminToken) {
  const currentConfig = await getHideOeInVendorRfqConfig(serverGroup, adminToken);

  if (!currentConfig) {
    throw new Error(`hide_oe_in_vendor_rfq config not found for server group: ${serverGroup}`);
  }

  const configId = currentConfig.id;
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${configId}`;
  const response = await authenticatedPost(endpoint, { config_value: newValue }, adminToken);

  if (response.status !== 200) {
    throw new Error(`Failed to update hide_oe_in_vendor_rfq config: ${JSON.stringify(response.data)}`);
  }

  await cleanupDeactivatedConfigs(serverGroup, CONFIG_CONDITIONS.HIDE_OE_IN_VENDOR_RFQ);

  return response.data;
}

export async function getHidePriceNegotiationConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.HIDE_PRICE_NEGOTIATION, adminToken);
}

export async function updateHidePriceNegotiationConfig(serverGroup, newValue, adminToken) {
  const currentConfig = await getHidePriceNegotiationConfig(serverGroup, adminToken);

  if (!currentConfig) {
    throw new Error(`hide_price_negotiation config not found for server group: ${serverGroup}`);
  }

  const configId = currentConfig.id;
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${configId}`;
  const response = await authenticatedPost(endpoint, { config_value: newValue }, adminToken);

  if (response.status !== 200) {
    throw new Error(`Failed to update hide_price_negotiation config: ${JSON.stringify(response.data)}`);
  }

  await cleanupDeactivatedConfigs(serverGroup, CONFIG_CONDITIONS.HIDE_PRICE_NEGOTIATION);

  return response.data;
}

export async function getMinPriceConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.MIN_PRICE, adminToken);
}

export async function getMaxPriceConfig(serverGroup, adminToken) {
  return getSlaConfig(serverGroup, CONFIG_CONDITIONS.MAX_PRICE, adminToken);
}

export async function updateQcfApprovalLevelConfig(serverGroup, newValue, adminToken) {
  const currentConfig = await getQcfApprovalLevelConfig(serverGroup, adminToken);

  if (!currentConfig) {
    throw new Error(`qcf_approval_level config not found for server group: ${serverGroup}`);
  }

  const configId = currentConfig.id;
  const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${configId}`;
  const response = await authenticatedPost(endpoint, { config_value: newValue }, adminToken);

  if (response.status !== 200) {
    throw new Error(`Failed to update qcf_approval_level config: ${JSON.stringify(response.data)}`);
  }

  await cleanupDeactivatedConfigs(serverGroup, CONFIG_CONDITIONS.QCF_APPROVAL_LEVEL);

  return response.data;
}