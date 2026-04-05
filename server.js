const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

//api de nguyen
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});


const ordersRouter = require("./routers/orders/index_Orders");
app.use('/orders', ordersRouter);

const TO_ordersRouter = require("../routers/TO_orders/index_TO");
app.use('/TO', TO_ordersRouter);

const usersRouter = require("./routers/users/index_Users");
app.use('/users', usersRouter);
//// tets sql 
// ❌ API login dễ dính SQLi
// app.get("/test", (req, res) => {
//   const username = req.query.username;
//   const password = req.query.password;

//   // ❌ NỐI CHUỖI (NGUY HIỂM)
//   const sql = `SELECT * FROM users 
//                WHERE username = '${username}' 
//                AND password = '${password}'`;

//   db.query(sql, (err, result) => {
//     if (err) return res.status(500).json(err);
//     res.json(result);
//   });
// });



app.use((req, res, next) => {
  console.log("👉", req.method, req.url);
  next();
});

////////////////////////////////////////////////////////// PORT Railway //////////////////////////////////////////////////////////////

app.listen(process.env.PORT || 8080, () => {
  console.log("Server running");
});