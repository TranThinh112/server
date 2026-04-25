const mysql = require("mysql2");

//serfer onl
// const db = mysql.createPool({
//   host: process.env.MYSQLHOST,
//   user: process.env.MYSQLUSER,
//   password: process.env.MYSQLPASSWORD,
//   database: process.env.MYSQLDATABASE,
//   port: process.env.MYSQLPORT,  
//   waitForConnections: true,
//   connectionLimit: 10,
// });

//local
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "appqm",
  port: 3306
});
module.exports = db;