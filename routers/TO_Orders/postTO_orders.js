const express = require('express');
const router = express.Router();
const db = require("../../db");


//////////////////////////////////////////////////////////////////////////////////// TO_orders ///////////////////////////////////////////////////////////////////////
//gửi dữ liệu TO moi khi vua tao len server 
router.post("/", (req, res) => {
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

//api upload TO sau khi bam compete
router.put("/:maTO", (req, res) => {
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

//cap nhat trang tahi khi reopen TO
router.put("/:maTO/reopen", (req, res) => {
  const maTO = req.params.maTO;

  db.query(
    `UPDATE TO_orders 
     SET trangThai = 'Packing',
         completeTime = NULL
     WHERE maTO = ?`,
    [maTO],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});
module.exports = router;