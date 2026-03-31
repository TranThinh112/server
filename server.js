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

// lay toan bo order
app.get("/orders", (req, res) => {
  db.query("SELECT * FROM orders", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});
////////////////////////////////// lấy order theo id ///////////////////////////////
app.get('/orders', (req, res) => {
  const { id, trangThai } = req.query;

  let sql = "SELECT * FROM orders";
  let values = [];

  if (id) {
    sql += " WHERE id = ?";
    values.push(id);
  } else if (trangThai) {
    sql += " WHERE trangThai = ?";
    values.push(trangThai);
  }

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    // nếu tìm theo id → trả 1 object
    if (id) {
      return res.json(result[0] || null);
    }

    // còn lại → trả list
    res.json(result);
  });
});


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

//upload 3 loai: trangThai. timepacke. maTO
app.put('/orders/:id', (req, res) => {
  const { id } = req.params;

  const allowed = ['trangThai', 'thoiGianDongBao', 'maTO'];

  const data = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: "No valid fields" });
  }

  const fields = Object.keys(data).map(k => `${k}=?`).join(', ');
  const values = [...Object.values(data), id];

  db.query(
    `UPDATE orders SET ${fields} WHERE id=?`,
    values,
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!result.affectedRows)
        return res.status(404).json({ message: "Order not found" });

      db.query(
        "SELECT * FROM orders WHERE id=?",
        [id],
        (err2, rows) => {
          if (err2) return res.status(500).json({ message: err2.message });
          res.json(rows[0]);
        }
      );
    }
  );
});

////////////////////////////////////////////////// update trang thai order ///////////////////////////////////////
// app.put("/orders/:id/status/:trangthai", (req, res) => {
//   const id = req.params.id;
//   const { trangthai } = req.params;

//   db.query(
//     "UPDATE orders SET trangthai = ? WHERE id = ?",
//     [trangthai, id],
//     (err, result) => {
//       if (err) {
//         console.log(err);
//         return res.status(500).json(err);
//       }

//       if (result.affectedRows === 0) {
//         return res.status(404).json({ error: "Order not found" });
//       }

//       res.json({ success: true });
//     }
//   );
// });

////////////////////////////////////////////////// update thoi gian quet cua don hang ///////////////////////////////////////
// app.put("/orders/:id/timedong/:thoiGianDongBao", (req, res) => {
//   const id = req.params.id;
//   const { thoiGianDongBao } = req.params;

//   db.query(
//     "UPDATE orders SET thoiGianDongBao = ? WHERE id = ?",
//     [thoiGianDongBao, id],
//     (err, result) => { 
//       if (err) {
//         console.log(err);
//         return res.status(500).json(err);
//       }
//       if (result.affectedRows === 0) {
//         return res.status(404).json({ error: "Order not found" });
//       }
//        res.json({ success: true });
//     } 
//   )
// });
//tao order moi tu form
app.post("/orders",(req,res)=> {
  const {nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, sanPham, soKi, giaTien}=req.body;
  db.query(
    'Iinsert into orders(nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, soKi, giaTien, sanPham) values(?,?,?,?,?,?,?)',
    [nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, soKi, giaTien, sanPham],
    (err, result) =>{
     if (err){
      console.log("DB error:", err);
      return res.status(500).json({ error: err.message});
     }
      return res.json({ success: true });
    }
  )
})


                        ///////////////////////////////// USERS ////////////////////////////////////////////////////////////
//
//api tạo user mới?//
//lay all user
app.get("/login/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});


// tìm user
app.get("/login/users/:username", handleUser);

// 🔐 login
app.get("/login/users/:username/:password", handleUser);

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

// cập nhật mật khẩu user theo username
app.put("/login/users/:username", (req, res) => {
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


//////////////////////////////////////////////////////////////////////////////////// TO_orders ///////////////////////////////////////////////////////////////////////
//gửi dữ liệu lên server để tạo TO mới
app.post("/TO_orders", (req, res) => {
  const {
    maTO,
    danhSachGoiHang,
    diaDiemGiaoHang,
    trangThai,
    packer,
    totalWeight,
    ngayTao,
    completeTime
  } = req.body;

  db.query(
    `INSERT INTO TO_orders 
    (maTO, danhSachGoiHang, diaDiemGiaoHang, trangThai, packer, totalWeight, ngayTao, completeTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      maTO,
      JSON.stringify(danhSachGoiHang), // 🔥 convert list → string
      diaDiemGiaoHang,
      trangThai,
      packer,
      totalWeight,
      ngayTao,
      completeTime
    ],
    (err, result) => {
      if (err) {
        console.log("DB ERROR:", err);
        return res.status(500).json(err);
      }
      res.json({ success: true});
    }
  );
});

//api upload TO mới
app.put("/TO_orders/:maTO", (req, res) => {
  const maTO = req.params.maTO;
  const {
    danhSachGoiHang,
    diaDiemGiaoHang,
    trangThai,
    totalWeight,
    completeTime
  } = req.body;

  db.query(
    `UPDATE TO_orders SET 
      danhSachGoiHang=?,
      diaDiemGiaoHang=?,
      trangThai=?,
      totalWeight=?,
      completeTime=?
     WHERE maTO=?`,
    [
      JSON.stringify(danhSachGoiHang),
      diaDiemGiaoHang,
      trangThai,
      totalWeight,
      completeTime,
      maTO

    ],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
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

/////// lay cac to da packed //////////////
app.get("/TO_orders/status/:trangThai", (req, res) => {
  const trangthai = req.params.trangThai;

  db.query(
    "SELECT * FROM TO_orders WHERE trangThai = ?", [trangthai], (err, result) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});


////////////////////////////////////////////////////////// PORT Railway //////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});