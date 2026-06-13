const express = require("express");
const router = express.Router();
const { getConfig } = require("../simulator");

router.get("/", (req, res) => {
  const config = getConfig();
  res.json({
    status: "ok",
    service: "xeno-channel-service",
    uptime: Math.floor(process.uptime()),
    config: {
      crmReceiptUrl: config.crmReceiptUrl,
      deliveryDelayRange: `${config.delayMin}ms – ${config.delayMax}ms`,
      probabilities: {
        delivered: config.probDelivered,
        failed: config.probFailed,
        opened: config.probOpened,
        clicked: config.probClicked,
      },
      retries: config.maxRetries,
    },
  });
});

module.exports = router;
