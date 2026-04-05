const express = require("express");
const router = express.Router();


const getUsers = require("./get_Users");
const postUsers = require("./post_Users");

router.use('/',getUsers);
router.use('/',postUsers);

module.exports = router;