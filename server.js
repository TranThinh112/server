const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// kết nối database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// lấy tất cả orders
  app.get("/orders", (req,res)=>{

  db.query(
    "SELECT * FROM orders",
    (err,result)=>{

      if(err){
        console.log(err);
        return res.status(500).json(err);
      }

      res.json(result);
    }
  );
}); 
// API lấy danh sách orders
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
},),

// lấy tất cả user
  app.get("/users", (req,res)=>{

  db.query(
    "SELECT * FROM users",
    (err,result)=>{

      if(err){
        console.log(err);
        return res.status(500).json(err);
      }

      res.json(result);
    }
  );
});
// API lấy danh sách orders
  app.get("/users/:username/:password", (req, res) => {

  const username = req.params.username;
  const password = req.params.password;

  db.query(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
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
},);

  const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});