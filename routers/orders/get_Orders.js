const express = require("express");
const router = express.Router();
const db = require("../../db");


////////////////////////////////// lấy order theo id, lay order theo trạng thái ///////////////////////////////
router.get('/getIn4', (req, res) => {
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

module.exports = router;