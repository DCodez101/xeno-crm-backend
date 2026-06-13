const express = require("express");
const router = express.Router();
const { processBatch } = require("../simulator");

/**
 * POST /send
 *
 * Called by the CRM backend when launching a campaign.
 * Accepts a batch of messages, returns 202 immediately,
 * then fires receipt callbacks asynchronously.
 *
 * Body:
 * {
 *   campaignId: string,
 *   channel: "whatsapp" | "sms" | "email" | "rcs",
 *   messages: [
 *     {
 *       messageId: string,      // unique per message (CRM generated)
 *       recipientId: string,    // customerId from CRM
 *       recipientPhone: string, // for logging / future use
 *       body: string,           // the message content
 *       metadata: {}            // any extra info CRM wants to pass
 *     }
 *   ]
 * }
 */
router.post("/", (req, res) => {
  const { campaignId, channel, messages } = req.body;

  // Validate required fields
  if (!campaignId || !channel || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Missing required fields: campaignId, channel, messages[]",
    });
  }

  const validChannels = ["whatsapp", "sms", "email", "rcs"];
  if (!validChannels.includes(channel)) {
    return res.status(400).json({
      error: `Invalid channel. Must be one of: ${validChannels.join(", ")}`,
    });
  }

  // Validate each message has a messageId and recipientId
  const invalid = messages.filter((m) => !m.messageId || !m.recipientId);
  if (invalid.length > 0) {
    return res.status(400).json({
      error: "Each message must have messageId and recipientId",
      invalidCount: invalid.length,
    });
  }

  // Accept immediately — this is the key design decision
  // The CRM doesn't wait for delivery, it gets callbacks later
  res.status(202).json({
    accepted: messages.length,
    campaignId,
    channel,
    messageIds: messages.map((m) => m.messageId),
    note: "Messages accepted. Receipt callbacks will fire asynchronously to CRM_RECEIPT_URL.",
  });

  // Kick off simulation after response is sent
  console.log(
    `[send] Campaign ${campaignId} accepted — ${messages.length} messages on ${channel}`
  );
  processBatch(campaignId, channel, messages);
});

module.exports = router;
