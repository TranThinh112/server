const express = require('express');
const router = express.Router();
const db = require("../../../db");


/////////////////////////////////lay all TO va lay TO theo trang thai /////////////////////////
router.get("/TO_orders", (req, res) => {
  const {maTO, trangThai} = req.query;

  let sql = "SELECT * FROM TO_orders";
  let values = [];
  if (maTO){
    sql += " WHERE maTO = ?";
    values.push(maTO);
  }
  else if (trangThai) {
    sql += " WHERE LOWER(trangThai) = LOWER(?)";
    values.push(trangThai);
  }
  console.log(maTO);
 db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
});
});
module.exports = router;
