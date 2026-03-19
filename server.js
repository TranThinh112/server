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
// 🔥 QUAN TRỌNG: connect + không crash
// db.connect((err) => {
//   if (err) {
//     console.log("❌ DB connection error:", err);
//   } else {
//     console.log("✅ Connected to MySQL");
//   }
// });
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
app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});

//lay tung users
app.get("/users/:username", (req, res) => {
  const username = req.params.username;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, result) => {
      if (err) {
        console.log("DB ERROR:", err);
        return res.status(500).json({ error: err.message });
      }

      if (result.length === 0) {
        return res.json(null);
      }

      res.json(result[0]);
    }
  );
});
// PORT Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});