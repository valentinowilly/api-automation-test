import axios from 'axios';
import env from '../../config/env.js';

const mailpitConfig = {
  baseURL: env.mailpit.apiURL,
  timeout: 10000,
};

// Add Basic Auth if credentials are provided
if (env.mailpit.smtpUser && env.mailpit.smtpPassword) {
  mailpitConfig.auth = {
    username: env.mailpit.smtpUser,
    password: env.mailpit.smtpPassword,
  };
}

const mailpitAPI = axios.create(mailpitConfig);

export const getAllMessages = async () => {
  const response = await mailpitAPI.get('/messages');
  return response.data;
};

export const getMessagesByRecipient = async (email) => {
  const response = await mailpitAPI.get('/messages', {
    params: { query: `to:${email}` },
  });
  return response.data;
};

export const getMessagesBySubject = async (subject) => {
  const response = await mailpitAPI.get('/messages', {
    params: { query: `subject:${subject}` },
  });
  return response.data;
};

export const getLatestMessage = async () => {
  const response = await mailpitAPI.get('/messages', {
    params: { limit: 1 },
  });
  return response.data.messages?.[0] || null;
};

export const getLatestMessageByRecipient = async (email) => {
  const response = await mailpitAPI.get('/messages', {
    params: {
      query: `to:${email}`,
      limit: 1,
    },
  });
  return response.data.messages?.[0] || null;
};

export const getMessageById = async (messageId) => {
  const response = await mailpitAPI.get(`/message/${messageId}`);
  return response.data;
};

export const getMessageHtml = async (messageId) => {
  const response = await mailpitAPI.get(`/message/${messageId}/html`);
  return response.data;
};

export const getMessageText = async (messageId) => {
  const response = await mailpitAPI.get(`/message/${messageId}/text`);
  return response.data;
};

export const deleteAllMessages = async () => {
  await mailpitAPI.delete('/messages');
};

export const deleteMessage = async (messageId) => {
  await mailpitAPI.delete(`/message/${messageId}`);
};

export const waitForEmail = async (options = {}) => {
  const {
    recipient = null,
    subject = null,
    timeout = 30000,
    pollInterval = 1000,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    let response;

    if (recipient) {
      response = await getMessagesByRecipient(recipient);
    } else if (subject) {
      response = await getMessagesBySubject(subject);
    } else {
      response = await getAllMessages();
    }

    if (response.messages && response.messages.length > 0) {
      return response.messages[0];
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Timeout waiting for email (recipient: ${recipient}, subject: ${subject})`
  );
};

export const extractTokenFromEmail = async (messageId) => {
  const html = await getMessageHtml(messageId);

  const tokenRegex = /token=([a-zA-Z0-9._-]+)/;
  const match = html.match(tokenRegex);

  if (!match) {
    throw new Error('Token not found in email HTML');
  }

  return match[1];
};

export const extractLinkFromEmail = async (messageId, linkPattern = 'http') => {
  const html = await getMessageHtml(messageId);

  const linkRegex = new RegExp(`(${linkPattern}[^"'\\s<>]+)`, 'i');
  const match = html.match(linkRegex);

  if (!match) {
    throw new Error(`Link matching pattern "${linkPattern}" not found in email`);
  }

  return match[1];
};

export const verifyEmailSent = async (options = {}) => {
  const {
    recipient,
    subject,
    timeout = 10000,
  } = options;

  try {
    const message = await waitForEmail({
      recipient,
      subject,
      timeout,
    });

    return {
      success: true,
      message,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export const getEmailCount = async () => {
  const response = await getAllMessages();
  return response.total || 0;
};

export const cleanupEmails = async () => {
  await deleteAllMessages();
};

export default {
  getAllMessages,
  getMessagesByRecipient,
  getMessagesBySubject,
  getLatestMessage,
  getLatestMessageByRecipient,
  getMessageById,
  getMessageHtml,
  getMessageText,
  deleteAllMessages,
  deleteMessage,
  waitForEmail,
  extractTokenFromEmail,
  extractLinkFromEmail,
  verifyEmailSent,
  getEmailCount,
  cleanupEmails,
};
