const axios = require("axios");

async function getClickPesaToken() {
  const response = await axios.post(
    `${process.env.CLICKPESA_API_URL}/third-parties/generate-token`,
    null,
    {
      headers: {
        "client-id": process.env.CLICKPESA_CLIENT_ID,
        "api-key": process.env.CLICKPESA_API_KEY
      }
    }
  );

  const token = response.data?.token || response.data?.accessToken;

  if (!token) {
    throw new Error("ClickPesa token haikupatikana.");
  }

  return token;
}

function getAuthHeader(token) {
  return token.startsWith("Bearer ")
    ? token
    : `Bearer ${token}`;
}

async function previewMobileMoneyPayout({
  amount,
  phoneNumber,
  currency,
  orderReference,
  checksum
}) {
  const token = await getClickPesaToken();

  const payload = {
    amount,
    phoneNumber,
    currency,
    orderReference
  };

  if (checksum) {
    payload.checksum = checksum;
  }

  const response = await axios.post(
    `${process.env.CLICKPESA_API_URL}/third-parties/payouts/preview-mobile-money-payout`,
    payload,
    {
      headers: {
        Authorization: getAuthHeader(token),
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function createMobileMoneyPayout({
  amount,
  phoneNumber,
  currency,
  orderReference,
  checksum
}) {
  const token = await getClickPesaToken();

  const payload = {
    amount,
    phoneNumber,
    currency,
    orderReference
  };

  if (checksum) {
    payload.checksum = checksum;
  }

  const response = await axios.post(
    `${process.env.CLICKPESA_API_URL}/third-parties/payouts/create-mobile-money-payout`,
    payload,
    {
      headers: {
        Authorization: getAuthHeader(token),
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function getMobileMoneyPayoutStatus(orderReference) {
  const token = await getClickPesaToken();

  const response = await axios.get(
    `${process.env.CLICKPESA_API_URL}/third-parties/payouts/${encodeURIComponent(orderReference)}`,
    {
      headers: {
        Authorization: getAuthHeader(token)
      }
    }
  );

  return response.data;
}

module.exports = {
  previewMobileMoneyPayout,
  createMobileMoneyPayout,
  getMobileMoneyPayoutStatus
};
