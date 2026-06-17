import { describe, it, expect, beforeAll } from 'vitest';
import { apiClient } from '../../utils/api-client';
import { getLoggedInUser } from '../../utils/auth';
import { createRfqForCs, updateRfqStatusByDic } from '../../utils/create-scenario';

describe('E2E - RFQ Workflow - CS Scenarios', () => {
  let csUserToken;
  let dicUserToken;
  let approvedRfqNumber;
  let declinedRfqNumber;

  beforeAll(async () => {
    // Log in as both a CS and DIC user to get their auth tokens
    csUserToken = await getLoggedInUser('CS_USER'); // Using a generic role name
    dicUserToken = await getLoggedInUser('DIC_USER'); // Using a generic role name

    // SCENARIO SETUP:
    // 1. Create two separate RFQs that are waiting for DIC approval.
    const rfqForApproval = await createRfqForCs('DIC_APPROVAL');
    const rfqForRejection = await createRfqForCs('DIC_APPROVAL');

    approvedRfqNumber = rfqForApproval.rfq_number;
    declinedRfqNumber = rfqForRejection.rfq_number;

    // 2. As the DIC user, approve one RFQ and decline the other.
    await updateRfqStatusByDic(dicUserToken, approvedRfqNumber, 'APPROVE');
    await updateRfqStatusByDic(dicUserToken, declinedRfqNumber, 'DECLINE');
  });

  /**
   * @scenario Based on UAT.md: "## CS - Item yang decline DIC seharusnya di hide"
   * (Items declined by DIC should be hidden from the CS user's view)
   */
  it('CS-Test-1: Should not show RFQs that were declined by DIC', async () => {
    // ACTION: As the CS user, fetch the list of all RFQs.
    const response = await apiClient
      .get('/purchase/rfq?page=1&limit=100') // Fetch a large list to ensure we see all items
      .set('Authorization', `Bearer ${csUserToken}`);

    expect(response.status).toBe(200);

    const rfqList = response.body.data.rows;

    // ASSERTION:
    // Find the RFQs in the list returned by the API.
    const foundApprovedRfq = rfqList.find(rfq => rfq.rfq_number === approvedRfqNumber);
    const foundDeclinedRfq = rfqList.find(rfq => rfq.rfq_number === declinedRfqNumber);

    // The approved RFQ should be in the list.
    expect(foundApprovedRfq, `Approved RFQ ${approvedRfqNumber} should be visible to CS`).not.toBeUndefined();

    // The declined RFQ should NOT be in the list.
    expect(foundDeclinedRfq, `Declined RFQ ${declinedRfqNumber} should be hidden from CS`).toBeUndefined();
  });
});
