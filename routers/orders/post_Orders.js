const db = require("../../db");
const express = require('express');
const router = express.Router();
const INSTANCE_ID = Math.random().toString(36).substring(2, 8);

//update trang thai = 'Inbound' + maTO = maTO + thoiGianDongBao = now
router.post('/scan/:id', (req, res) => {
  const { id } = req.params;
  const { maTO } = req.body;

  console.log("SCAN ID:", id);

  // CHECK FORMAT
  const validIdPattern = /^SPXVN\d{11}$/;
  if (!validIdPattern.test(id)) {
    return res.status(400).json({ message: "Sai định dạng" });
  }

  if (!maTO) {
    return res.status(400).json({ message: "Thiếu maTO" });
  }

  const now = new Date();

  // 🔥 1. UPDATE TRƯỚC (giảm 1 query)
  db.query(
    `UPDATE orders 
     SET trangThai = 'Inbound', maTO = ?, thoiGianDongBao = ?
     WHERE id = ? AND trangThai = 'Outbound'`,
    [maTO, now, id],
    (err0, result0) => {
      if (err0) return res.status(500).json(err0);

      if (result0.affectedRows === 0) {
        return res.status(400).json({
          message: "Đơn không hợp lệ hoặc đã scan"
        });
      }

      // 🔥 2. LẤY order (nhẹ hơn vì đã chắc chắn tồn tại)
      db.query(
        "SELECT soKi, noiNhan FROM orders WHERE id = ?",
        [id],
        (err, rows) => {
          if (err) return res.status(500).json(err);

          const soKi = Number(rows[0].soKi) || 0;
          const noiNhan = rows[0].noiNhan?.trim().toLowerCase();

          // 🔥 3. LẤY TO (bỏ TRIM → dùng index)
          db.query(
            "SELECT danhSachGoiHang FROM TO_orders WHERE maTO = ?",
            [maTO],
            (err2, rows2) => {
              if (err2) return res.status(500).json(err2);
              if (!rows2.length)
                return res.status(404).json({ message: "TO không tồn tại" });

              let list = [];
              let raw = rows2[0].danhSachGoiHang;

              // 🔥 parse nhanh + an toàn
              if (raw && raw.length > 5) {
                try {
                  if (Buffer.isBuffer(raw)) raw = raw.toString();
                  list = JSON.parse(raw);
                  if (!Array.isArray(list)) list = [];
                } catch {
                  list = [];
                }
              }

              // 🔥 CHECK TRÙNG nhanh hơn
              const set = new Set(list.map(i => i.orderId));
              if (set.has(id)) {
                return res.json({
                  success: false,
                  message: "Đơn đã có trong TO"
                });
              }

              const isFirstOrder = list.length === 0;

              // 🔥 KHÔNG QUERY LẠI DB nếu có thể
              if (!isFirstOrder) {
                const firstNoiNhan = list[0]?.noiNhan?.toLowerCase?.();

                if (firstNoiNhan && firstNoiNhan !== noiNhan) {
                  return res.status(400).json({
                    message: "Khác nơi nhận"
                  });
                }
              }

              // push (thêm luôn noiNhan để tránh query lần sau)
              list.push({
                orderId: id,
                soKi: soKi,
                noiNhan: noiNhan,
                thoiGianScan: now
              });

              // 🔥 UPDATE TO
              db.query(
                `UPDATE TO_orders 
                 SET danhSachGoiHang = ?, 
                     totalWeight = totalWeight + ?,
                     SL = SL + 1,
                     diaDiemGiaoHang = CASE 
                       WHEN ? THEN ? 
                       ELSE diaDiemGiaoHang 
                     END
                 WHERE maTO = ?`,
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
                    instance: INSTANCE_ID,
                    addedWeight: soKi
                    // 🔥 bỏ list → nhẹ hơn
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
router.post('/remove/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT maTO FROM orders WHERE id = ?",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json(err);

       //  CHECK FORMAT ID
      const validIdPattern = /^SPXVN\d{11}$/;

      if (!validIdPattern.test(id)) {
        return res.status(400).json({
          message: "Sai định dạng"
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
            // lọc lại list sau khi xóa
            list = list.filter(item => item.orderId !== id);

            // tính lại
            const totalWeight = list.reduce(
              (sum, item) => sum + (item.soKi || 0),
              0
            );
            const SL = list.length;

            let sql = `
              UPDATE TO_orders 
              SET danhSachGoiHang = ?, 
                  totalWeight =  ?,
                  SL = ?`;

            let params = [JSON.stringify(list), totalWeight, SL];

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
router.post("/",(req,res)=> {
  const {id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien } = req.body;

const thoiGianTao = new Date();
  db.query(
    'INSERT INTO orders(id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien, thoiGianTao) VALUES(?,?,?,?,?,?,?,?,?,?,?)',

    [id, nguoiGui, nguoiNhan, diaChiGui, diaChiNhan, noiGui, noiNhan, sanPham, soKi, giaTien, thoiGianTao],
    (err, result) =>{
     if (err){
      console.log("DB error:", err);
      return res.status(500).json({ error: err.message});
     }
     console.log("DB error:", err);
     //tra về toàn bọ data sau khi tạo
      return res.json({
        id,
        nguoiGui,
        nguoiNhan,
        diaChiGui,
        diaChiNhan,
        noiGui,
        noiNhan,
        sanPham,
        soKi,
        giaTien,
        thoiGianTao
      });
    }
  )
})

module.exports = router;