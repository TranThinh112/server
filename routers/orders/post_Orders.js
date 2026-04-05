const db = require("../../db");
const express = require('express');
const router = express.Router();

//update trang thai = 'Inbound' + maTO = maTO + thoiGianDongBao = now
router.post('/scan/:id', (req, res) => {
  const { id } = req.params;
  const { maTO } = req.body;

   // ✅ CHECK FORMAT ID
  const validIdPattern = /^SPXVN\d{11}$/;

  if (!validIdPattern.test(id)) {
    return res.status(400).json({
      message: "Mã đơn không hợp lệ (phải dạng SPXVN + 11 số)"
    });
  }


  if (!maTO) {
    return res.status(400).json({ message: "Thiếu maTO" });
  }

  const now = new Date();

  // 1. Lấy thông tin đơn
  db.query(
    "SELECT soKi, noiNhan FROM orders WHERE TRIM(id) = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length)
        return res.status(404).json({ message: "Không tìm thấy đơn" });

      const soKi = Number(rows[0].soKi) || 0;
      const noiNhan = rows[0].noiNhan?.trim().toLowerCase();

      // 2. Lấy TO
      db.query(
        "SELECT danhSachGoiHang FROM TO_orders WHERE TRIM(maTO) = ?",
        [maTO],
        (err2, rows2) => {
          if (err2) return res.status(500).json(err2);
          if (!rows2 || rows2.length === 0)
            return res.status(404).json({ message: "TO không tồn tại" });

          let list = [];

          // parse JSON
          try {
            let raw = rows2[0].danhSachGoiHang;

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

          // ❗ tránh trùng
          if (list.some(item => item.orderId == id)) {
            return res.json({
              success: true,
              message: "Đơn đã có trong TO"
            });
          }

          const isFirstOrder = list.length === 0;

          // 🔥 CHẶN KHÁC noiNhan
          if (!isFirstOrder) {
            const firstOrderId = list[0].orderId;

            db.query(
              "SELECT noiNhan FROM orders WHERE TRIM(id) = ?",
              [firstOrderId],
              (errCheck, resultCheck) => {
                if (errCheck) return res.status(500).json(errCheck);

                const firstNoiNhan = resultCheck[0]?.noiNhan?.trim().toLowerCase();

                if (firstNoiNhan !== noiNhan) {
                  return res.status(400).json({
                    message: "Khác nơi nhận với đơn đầu tiên"
                  });
                }

                proceedUpdate();
              }
            );
          } else {
            proceedUpdate();
          }

          // ===== function update =====
          function proceedUpdate() {
            // update order
            db.query(
              `UPDATE orders 
               SET trangThai = 'Inbound', maTO = ?, thoiGianDongBao = ?
               WHERE TRIM(id) = ? AND TRIM(LOWER(trangThai)) = 'outbound'`,
              [maTO, now, id],
              (err3, result) => {
                if (err3) return res.status(500).json(err3);

                if (result.affectedRows === 0) {
                  return res.status(400).json({
                    message: "Đơn không hợp lệ hoặc đã scan"
                  });
                }

                // push
                list.push({
                  orderId: id,
                  soKi: soKi,
                  thoiGianScan: now
                });

                // update TO
                db.query(
                  `UPDATE TO_orders 
                   SET danhSachGoiHang = ?, 
                       totalWeight = totalWeight + ?,
                       SL = SL + 1,
                       diaDiemGiaoHang = CASE 
                         WHEN ? THEN ?
                         ELSE diaDiemGiaoHang
                       END
                   WHERE TRIM(maTO) = ?`,
                  [
                    JSON.stringify(list),
                    soKi,
                    isFirstOrder,
                    rows[0].noiNhan,
                    maTO
                  ],
                  (err4) => {
                    if (err4) return res.status(500).json(err4);

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
        }
      );
    }
  );
});

//xoa don khoi TO (trangThai = 'Outbound' + maTO = null + thoiGianDongBao = null)
router.post('/remove/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT maTO FROM orders WHERE id = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);

       // ✅ CHECK FORMAT ID
      const validIdPattern = /^SPXVN\d{11}$/;

      if (!validIdPattern.test(id)) {
        return res.status(400).json({
          message: "Mã đơn không hợp lệ (phải dạng SPXVN + 11 số)"
        });
      }
//check ton tai
      if (!rows.length)
        return res.status(404).json({ message: "Không tìm thấy đơn" });

      const { maTO } = rows[0];
      

      if (!maTO) {
        return res.status(400).json({
          message: "Đơn chưa thuộc TO"
        });
      }

      db.query(
        "SELECT danhSachGoiHang FROM TO_orders WHERE maTO = ?",
        [maTO],
        (err2, rows2) => {
          if (err2) return res.status(500).json(err2);
          if (!rows2.length)
            return res.status(404).json({ message: "TO không tồn tại" });

          let list = [];

          try {
            let raw = rows2[0].danhSachGoiHang;

            if (Buffer.isBuffer(raw)) raw = raw.toString();

            list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
          } catch (e) {
            console.log("JSON ERROR:", e);
            list = [];
          }

          const index = list.findIndex(item => item.orderId == id);

          if (index === -1) {
            return res.status(400).json({
              message: "Đơn không nằm trong TO"
            });
          }

          const isFirstOrder = index === 0;
          const removed = list[index];
          const removedWeight = removed?.soKi || 0;

          // xoá
          list.splice(index, 1);

          // ===== xử lý =====
          if (isFirstOrder) {
            if (list.length === 0) {
              return updateTO(null);
            } else {
              const newFirstOrderId = list[0].orderId;

              return db.query(
                "SELECT noiNhan FROM orders WHERE id = ?",
                [newFirstOrderId],
                (err3, result3) => {
                  if (err3) return res.status(500).json(err3);

                  const newDiaDiem = result3[0]?.noiNhan || null;
                  updateTO(newDiaDiem);
                }
              );
            }
          } else {
            return updateTO(undefined);
          }

          // ===== update =====
          function updateTO(newDiaDiem) {
            let sql = `
              UPDATE TO_orders 
              SET danhSachGoiHang = ?, 
                  totalWeight = totalWeight - ?,
                  SL = SL - 1`;

            let params = [JSON.stringify(list), removedWeight];

            if (newDiaDiem !== undefined) {
              sql += ", diaDiemGiaoHang = ?";
              params.push(newDiaDiem);
            }

            sql += " WHERE maTO = ?";
            params.push(maTO);

            db.query(sql, params, (err4) => {
              if (err4) return res.status(500).json(err4);

              db.query(
                `UPDATE orders 
                 SET trangThai = 'Outbound', maTO = NULL, thoiGianDongBao = NULL
                 WHERE id = ?`,
                [id],
                (err5) => {
                  if (err5) return res.status(500).json(err5);

                  res.json({
                    success: true,
                    removedWeight,
                    list
                  });
                }
              );
            });
          }
        }
      );
    }
  );
});

//tao order moi tu form
router.post("/orders",(req,res)=> {
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

module.exports = router;