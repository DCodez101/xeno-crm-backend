const axios = require("axios");

// Channel-specific engagement modifiers
// These adjust base probabilities per channel to mimic real-world behaviour
const CHANNEL_MODIFIERS = {
  whatsapp: { open: +0.30, click: +0.20, fail: -0.20 },
  sms:      { open: +0.10, click: -0.40, fail:  0.00 },
  email:    { open: -0.15, click: +0.10, fail: +0.10 },
  rcs:      { open: +0.20, click: +0.30, fail: -0.10 },
};

function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getConfig() {
  return {
    crmReceiptUrl: process.env.CRM_RECEIPT_URL || "http://localhost:5000/api/receipts",
    delayMin: parseInt(process.env.DELIVERY_DELAY_MIN_MS) || 1000,
    delayMax: parseInt(process.env.DELIVERY_DELAY_MAX_MS) || 8000,
    probDelivered: parseFloat(process.env.PROB_DELIVERED) || 0.80,
    probFailed: parseFloat(process.env.PROB_FAILED) || 0.10,
    probOpened: parseFloat(process.env.PROB_OPENED) || 0.45,
    probClicked: parseFloat(process.env.PROB_CLICKED) || 0.20,
    maxRetries: parseInt(process.env.RECEIPT_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.RECEIPT_RETRY_DELAY_MS) || 2000,
  };
}

// Fire a receipt callback to the CRM with retry logic
async function fireReceipt(payload, retries = 0) {
  const config = getConfig();
  try {
    await axios.post(config.crmReceiptUrl, payload, { timeout: 5000 });
    console.log(`[receipt] ✓ ${payload.messageId} → ${payload.status}`);
  } catch (err) {
    if (retries < config.maxRetries) {
      console.warn(
        `[receipt] ✗ ${payload.messageId} → ${payload.status} failed (attempt ${retries + 1}), retrying...`
      );
      await new Promise((r) => setTimeout(r, config.retryDelay * (retries + 1))); // exponential backoff
      return fireReceipt(payload, retries + 1);
    } else {
      console.error(
        `[receipt] ✗ ${payload.messageId} → ${payload.status} exhausted retries. CRM unreachable.`
      );
    }
  }
}

// Sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Simulate the full lifecycle of a single message
async function simulateMessage(campaignId, messageId, recipientId, channel) {
  const config = getConfig();
  const mod = CHANNEL_MODIFIERS[channel] || { open: 0, click: 0, fail: 0 };

  const probDelivered = clamp(config.probDelivered - mod.fail);
  const probFailed = clamp(1 - probDelivered);
  const probOpened = clamp(config.probOpened + mod.open);
  const probClicked = clamp(config.probClicked + mod.click);

  const basePayload = { campaignId, messageId, recipientId, channel };

  // Step 1: "sent" — immediate, we accepted it
  await sleep(200);
  await fireReceipt({ ...basePayload, status: "sent", timestamp: new Date().toISOString() });

  // Step 2: delivery outcome — delivered / failed / bounced
  const deliveryDelay = randomDelay(config.delayMin, config.delayMax);
  await sleep(deliveryDelay);

  const roll = Math.random();
  if (roll > probDelivered) {
    // Failed or bounced
    const failStatus = Math.random() > 0.5 ? "failed" : "bounced";
    await fireReceipt({ ...basePayload, status: failStatus, timestamp: new Date().toISOString() });
    return; // No further events for failed messages
  }

  await fireReceipt({ ...basePayload, status: "delivered", timestamp: new Date().toISOString() });

  // Step 3: opened? (only for delivered)
  if (Math.random() < probOpened) {
    await sleep(randomDelay(2000, 15000));
    await fireReceipt({ ...basePayload, status: "opened", timestamp: new Date().toISOString() });

    // Step 4: clicked? (only for opened)
    if (Math.random() < probClicked) {
      await sleep(randomDelay(1000, 5000));
      await fireReceipt({ ...basePayload, status: "clicked", timestamp: new Date().toISOString() });
    }
  }
}

// Process a full batch — each message simulated independently (non-blocking)
function processBatch(campaignId, channel, messages) {
  for (const msg of messages) {
    // Fire and forget — each message runs its own async lifecycle
    simulateMessage(campaignId, msg.messageId, msg.recipientId, channel).catch((err) =>
      console.error(`[simulator] unhandled error for ${msg.messageId}:`, err.message)
    );
  }
}

module.exports = { processBatch, getConfig };
