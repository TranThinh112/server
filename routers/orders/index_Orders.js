const express = require("express");
const router = express.Router();

const getOrders = require("./get_Orders");
const postOrders = require("./post_Orders");

router.use('/',getOrders);
router.use('/',postOrders);

module.exports = router;