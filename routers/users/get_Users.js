const express = require('express');
const router = express.Router();
const db = require("../../db");

///////////////////////////////// USERS ////////////////////////////////////////////////////////////

                        //
//api tạo user mới?//
//lay all user
router.get("/login/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});


// tìm user
// 🔐 login
router.get("/login/users/:username/:password", handleUser);
//tim user theo username
router.get("/login/users/:username", handleUser);


//  dùng chung logic
function handleUser(req, res) {
  const username = req.params.username;
  const password = req.params.password;

  let sql = "SELECT * FROM users WHERE username = ?";
  let params = [username];

  if (password) {
    sql += " AND password = ?";
    params.push(password);
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0] || null);
  });
}

module.exports = router;