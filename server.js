const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ kết nối database
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

// 🔥 QUAN TRỌNG: connect + không crash
db.connect((err) => {
  if (err) {
    console.log("❌ DB connection error:", err);
  } else {
    console.log("✅ Connected to MySQL");
  }
});

// test API
app.get("/", (req, res) => {
  res.send("API running 🚀");
});
// lấy tất cả orders test
app.get("/orders", (req, res) => {
  db.query("SELECT id, station FROM orders", (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
});


// // lấy tất cả orders
// app.get("/orders", (req, res) => {
//   db.query("SELECT * FROM orders", (err, result) => {
//     if (err) {
//       console.log(err);
//       return res.status(500).json(err);
//     }
//     res.json(result);
//   });
// });

// // lấy order theo id
// app.get("/orders/:id", (req, res) => {
//   const id = req.params.id;

//   db.query(
//     "SELECT * FROM orders WHERE id = ?",
//     [id],
//     (err, result) => {
//       if (err) {
//         console.log(err);
//         return res.status(500).json(err);
//       }

//       if (result.length === 0) {
//         return res.json(null);
//       }

//       res.json(result[0]);
//     }
//   );
// });

// // lấy tất cả user
// app.get("/users", (req, res) => {
//   db.query("SELECT * FROM users", (err, result) => {
//     if (err) {
//       console.log(err);
//       return res.status(500).json(err);
//     }
//     res.json(result);
//   });
// });

// // login user
// app.get("/users/:username/:password", (req, res) => {
//   const { username, password } = req.params;

//   db.query(
//     "SELECT * FROM users WHERE username = ? AND password = ?",
//     [username, password],
//     (err, result) => {
//       if (err) {
//         console.log(err);
//         return res.status(500).json(err);
//       }

//       if (result.length === 0) {
//         return res.json(null);
//       }

//       res.json(result[0]);
//     }
//   );
// });

// PORT Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});