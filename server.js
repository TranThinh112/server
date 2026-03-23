const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ kết nối database
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
});
//api de nguyen
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// test API
app.get("/orders", (req, res) => {
  db.query("SELECT * FROM orders", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});
// lấy order theo id
app.get("/orders/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "SELECT * FROM orders WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }

      if (result.length === 0) {
        return res.json(null);
      }

      res.json(result[0]);
    }
  );
});

//lay all user
 // 🔐 Nếu có password → LOGIN
app.get("/users", (req, res) => {
  const { username, password } = req.query;

  let sql = "SELECT * FROM users WHERE 1=1";
  let params = [];

  // 🔍 Tìm theo username
  if (username) {
    sql += " AND username = ?";
    params.push(username);
  }

  // 🔐 Nếu có password → LOGIN
  if (password) {
    sql += " AND password = ?";
    params.push(password);
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.length === 0) {
      return res.json(null); // ❌ không tìm thấy / sai login
    }

    res.json(result[0]); // ✅ trả về user
  });
});


// cập nhật mật khẩu user theo username
app.put("/users/:username", (req, res) => {
  const username = req.params.username;
  const { password } = req.body;

  if (!password || password.trim().length === 0) {
    return res.status(400).json({ error: "Password is required" });
  }
  db.query(
    "UPDATE users SET password = ? WHERE username = ?",
    [password, username],
    (err, result) => {
      if (err) {
        console.log("DB ERROR:", err);
        return res.status(500).json({ error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // trả về user mới (có thể tránh trả password nếu cần)
      db.query(
        "SELECT id, username, password, created_at FROM users WHERE username = ?",
        [username],
        (err2, rows) => {
          if (err2) {
            console.log("DB ERROR:", err2);
            return res.status(500).json({ error: err2.message });
          }

          res.json(rows[0]);
        }
      );
    }
  );
});
//lay all TO
app.get("/TO_orders", (req, res) => {
  db.query("SELECT * FROM TO_orders", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});
// PORT Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});