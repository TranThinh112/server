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

////////////////////////////////// lấy order theo id, lay order theo trạng thái ///////////////////////////////
app.get('/orders', (req, res) => {
  let { id, trangThai, keyword, page = 1, limit = 10 } = req.query;

  page = Number(page);
  limit = Number(limit);
  const offset = (page - 1) * limit;

  let baseSql = "FROM orders";
  let values = [];
  let conditions = [];

  /// 🔹 lọc theo id
  if (id) {
    conditions.push("id = ?");
    values.push(id);
  }

  /// 🔹 lọc theo trạng thái
  if (trangThai) {
    conditions.push("LOWER(trangThai) = LOWER(?)");
    values.push(trangThai);
  }

  /// 🔹 search
  if (keyword) {
    conditions.push("(LOWER(id) LIKE LOWER(?) OR LOWER(noinhan) LIKE LOWER(?) OR LOWER(trangThai) LIKE LOWER(?))");
    values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  /// 🔹 WHERE
  if (conditions.length > 0) {
    baseSql += " WHERE " + conditions.join(" AND ");
  }

  ///  tổng đơn
  const countSql = "SELECT COUNT(*) as total " + baseSql;

  /// tổng inbound (KHÔNG phụ thuộc filter)
  const inboundSql = `
    SELECT COUNT(*) as inbound 
    FROM orders 
    WHERE LOWER(trangThai) = 'inbound'`;

  /// data
  const dataSql = `
    SELECT * ${baseSql}
    ORDER BY 
      CASE 
        WHEN LOWER(trangThai) = 'inbound' THEN 0
        WHEN LOWER(trangThai) = 'outbound' THEN 1
        ELSE 2
      END,
      thoiGianDongBao DESC
    LIMIT ? OFFSET ?`;

  const dataValues = [...values, limit, offset];
  console.log(id, trangThai, keyword, page, limit);
  db.query(countSql, values, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(inboundSql, (err, inboundResult) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query(dataSql, dataValues, (err, dataResult) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          data: dataResult,
          total: countResult[0].total,
          inbound: inboundResult[0].inbound // 🔥 thêm dòng này
        });
      });
    });
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

//update trangThai = 'Inbound' + maTO + thoiGianDongBao khi scan
app.post('/orders/scan/:id', (req, res) => {
  const { id } = req.params;
  const { maTO } = req.body;

  const now = new Date();

  // 1. Lấy thông tin đơn
  db.query(
    "SELECT soKi FROM orders WHERE TRIM(id) = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length)
        return res.status(404).json({ message: "Không tìm thấy đơn" });
      console.log("buoc1 ok");
      const soKi = Number(rows[0].soKi) || 0;
      console.log("scan: ",id)
      // 2. Update order
      db.query(
        `UPDATE orders 
         SET trangThai = 'Inbound', maTO = ?, thoiGianDongBao = ?
         WHERE TRIM(id) = ? AND TRIM(LOWER(trangThai)) = 'outbound'`,
        [maTO, now, id],
        (err2, result) => {
          if (err2) return res.status(500).json(err2);

          if (result.affectedRows === 0) {

            return res.status(400).json({
              message: "Đơn đã scan hoặc không hợp lệ"
            });
          }
          console.log("buoc2 ok");
          // 3. Lấy danh sách hiện tại của TO
          db.query(
            "SELECT danhSachGoiHang FROM TO_orders WHERE maTO = ?",
            [maTO],
            (err3, rows2) => {
              if (err3) return res.status(500).json(err3);
              if (!rows2 || rows2.length === 0)
                return res.status(404).json({ message: "TO không tồn tại" });

              let list = [];
                try {
                const raw = rows2[0].danhSachGoiHang;

                if (!raw || raw.trim() === "") {
                  list = [];
                } else {
                  list = JSON.parse(raw);
                }
              } catch (e) {
                return res.status(500).json({
                  message: "Lỗi parse JSON danhSachGoiHang",
                  error: e.message
                });
              }
              console.log("buoc3 ok");

              // ❗ tránh trùng đơn
              if (list.some(item => item.orderId == id)) {
                return res.status(400).json({
                  message: "Đơn đã tồn tại trong TO"
                });
              }

              // 4. Thêm object mới
              list.push({
                orderId: id,
                soKi: soKi,
                thoiGianScan: now
              });
              console.log("Updated list:", list);

              console.log("buoc4 ok");

              // 5. Update TO: vừa update list vừa cộng weight
              db.query(
                `UPDATE TO_orders 
                 SET danhSachGoiHang = ?, 
                     totalWeight = totalWeight + ?
                 WHERE maTO = ?`,
                [JSON.stringify(list), soKi, maTO],
                (err4) => {
                  if (err4) return res.status(500).json(err4);
                  console.log(`Đã thêm đơn ${id} vào TO ${maTO}, cộng thêm ${soKi} kg`);

                  res.json({
                    success: true,
                    addedWeight: soKi
                  });
                }
              );
              console.log("buoc5 ok");
            }
          );
        }
      );
    }
  );
});
//test
app.post('/orders/scanlan2/:id', (req, res) => {
  const { id } = req.params;
  const { maTO } = req.body;

  if (!maTO) {
    return res.status(400).json({ message: "Thiếu maTO" });
  }

  const now = new Date();

  // 1. Lấy thông tin đơn
  db.query(
    "SELECT soKi FROM orders WHERE TRIM(id) = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length)
        return res.status(404).json({ message: "Không tìm thấy đơn" });

      const soKi = Number(rows[0].soKi) || 0;

      // 2. Lấy TO trước (🔥 quan trọng)
      db.query(
        "SELECT danhSachGoiHang FROM TO_orders WHERE TRIM(maTO) = ?",
        [maTO],
        (err3, rows2) => {
          if (err3) return res.status(500).json(err3);
          if (!rows2 || rows2.length === 0)
            return res.status(404).json({ message: "TO không tồn tại" });

          let list = [];

          try {
            let raw = rows2[0].danhSachGoiHang;

            // 🔥 FIX BLOB → STRING
            if (Buffer.isBuffer(raw)) {
              raw = raw.toString();
            }

            if (!raw || raw.trim() === "" || raw === '""') {
              list = [];
            } else {
              list = JSON.parse(raw);
              if (!Array.isArray(list)) list = [];
            }

          } catch (e) {
            console.log("JSON ERROR:", e);
            list = [];
          }

          // ❗ tránh trùng TRƯỚC khi update
          if (list.some(item => item.orderId == id)) {
            return res.json({
              success: true,
              message: "Đơn đã có trong TO"
            });
          }

          // 3. Update order
          db.query(
            `UPDATE orders 
             SET trangThai = 'Inbound', maTO = ?, thoiGianDongBao = ?
             WHERE TRIM(id) = ? AND TRIM(LOWER(trangThai)) = 'outbound'`,
            [maTO, now, id],
            (err2, result) => {
              if (err2) return res.status(500).json(err2);

              if (result.affectedRows === 0) {
                return res.status(400).json({
                  message: "Đơn không hợp lệ hoặc đã scan"
                });
              }

              // 4. Push vào list
              list.push({
                orderId: id,
                soKi: soKi,
                thoiGianScan: now
              });

              console.log("LIST:", list);

              // 5. Update TO
              db.query(
                `UPDATE TO_orders 
                 SET danhSachGoiHang = ?, 
                     totalWeight = totalWeight + ?
                 WHERE TRIM(maTO) = ?`,
                [JSON.stringify(list), soKi, maTO],
                (err4, result4) => {
                  if (err4) return res.status(500).json(err4);

                  if (result4.affectedRows === 0) {
                    return res.status(400).json({
                      message: "Không update được TO"
                    });
                  }

                  res.json({
                    success: true,
                    addedWeight: soKi,
                    list: list
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});
//xoa don khoi TO (trangThai = 'Outbound' + maTO = null + thoiGianDongBao = null)
app.post('/orders/remove/:id', (req, res) => {
  const { id } = req.params;

  // 1. Lấy thông tin đơn
  db.query(
    "SELECT maTO, soKi FROM orders WHERE id = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length)
        return res.status(404).json({ message: "Không tìm thấy đơn" });

      const { maTO, soKi } = rows[0];

      if (!maTO) {
        return res.status(400).json({
          message: "Đơn chưa thuộc TO"
        });
      }

      // 2. Lấy danh sách hiện tại của TO
      db.query(
        "SELECT danhSachGoiHang FROM TO_orders WHERE maTO = ?",
        [maTO],
        (err2, rows2) => {
          if (err2) return res.status(500).json(err2);
          if (!rows2 || rows2.length === 0)
            return res.status(404).json({ message: "TO không tồn tại" });

          let list = [];
          try {
          const raw = rows2[0].danhSachGoiHang;

          if (!raw || raw.trim() === "") {
            list = [];
          } else {
            list = JSON.parse(raw);
          }
        } catch (e) {
          console.log("JSON PARSE ERROR:", e);
          list = [];
        }

          // ❗ check đơn có trong list không
          const exists = list.some(item => item.orderId == id);
          if (!exists) {
            return res.status(400).json({
              message: "Đơn không nằm trong TO"
            });
          }
          // 3. Xóa khỏi list
          list = list.filter(item => item.orderId != id);

          // 4. Update TO (trừ weight + update list)
          db.query(
            `UPDATE TO_orders 
             SET danhSachGoiHang = ?, 
                 totalWeight = totalWeight - ?
             WHERE maTO = ?`,
            [JSON.stringify(list), soKi, maTO],
            (err3) => {
              if (err3) return res.status(500).json(err3);

              // 5. Update order
              db.query(
                `UPDATE orders 
                 SET trangThai = 'Outbound', maTO = NULL, thoiGianDongBao = NULL
                 WHERE id = ?`,
                [id],
                (err4) => {
                  if (err4) return res.status(500).json(err4);

                  res.json({
                    success: true,
                    removedWeight: soKi
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});
//upload 3 loai: trangThai. timepacke. maTO
// app.put('/orders/:id', (req, res) => {
//   const { id } = req.params;

//   const allowed = ['trangThai', 'thoiGianDongBao', 'maTO'];

//   const data = Object.fromEntries(
//     Object.entries(req.body).filter(([k]) => allowed.includes(k))
//   );

//   if (!Object.keys(data).length) {
//     return res.status(400).json({ message: "No valid fields" });
//   }

//   const fields = Object.keys(data).map(k => `${k}=?`).join(', ');
//   const values = [...Object.values(data), id];

//   db.query(
//     `UPDATE orders SET ${fields} WHERE id=?`,
//     values,
//     (err, result) => {
//       if (err) return res.status(500).json({ message: err.message });
//       if (!result.affectedRows)
//         return res.status(404).json({ message: "Order not found" });

//       db.query(
//         "SELECT * FROM orders WHERE id=?",
//         [id],
//         (err2, rows) => {
//           if (err2) return res.status(500).json({ message: err2.message });
//           res.json(rows[0]);
//         }
//       );
//     }
//   );
// });


//tao order moi tu form
app.post("/orders",(req,res)=> {
  const {id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien } = req.body;

  db.query(
    'INSERT INTO orders(id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien) VALUES(?,?,?,?,?,?,?,?,?,?)',

    [id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien],
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
// 🔐 login
app.get("/login/users/:username/:password", handleUser);
//tim user theo username
app.get("/login/users/:username", handleUser);


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
app.put("/repass/users/:username", (req, res) => {
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
app.use((req, res, next) => {
  console.log("👉", req.method, req.url);
  next();
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
  const safeList = Array.isArray(danhSachGoiHang)
    ? danhSachGoiHang
    : [];
  db.query(
    `INSERT INTO TO_orders 
    (maTO, danhSachGoiHang, diaDiemGiaoHang, trangThai, packer, totalWeight, ngayTao, completeTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      maTO,
      JSON.stringify(safeList), // 🔥 convert list → string
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
  const safeList = Array.isArray(danhSachGoiHang)
  ? danhSachGoiHang
  : [];

  db.query(
    `UPDATE TO_orders SET 
      danhSachGoiHang=?,
      diaDiemGiaoHang=?,
      trangThai=?,
      totalWeight=?,
      completeTime=?
     WHERE maTO=?`,
    [
      JSON.stringify(safeList),
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

/////////////////////////////////lay all TO va lay TO theo trang thai /////////////////////////
app.get("/TO_orders", (req, res) => {
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


////////////////////////////////////////////////////////// PORT Railway //////////////////////////////////////////////////////////////

app.listen(process.env.PORT || 8080, () => {
  console.log("Server running");
});