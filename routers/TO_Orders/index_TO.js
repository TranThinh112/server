const express = require("express");
const router = express.Router();


const geTOtOrders = require("./getTO_orders");
const postTOrders = require("./postTO_orders");

router.use('/',geTOtOrders);
router.use('/',postTOrders);

module.exports = router;