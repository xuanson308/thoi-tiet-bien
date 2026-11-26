/* Bộ gửi thông báo thời tiết biển, chạy trên GitHub Actions vài lần mỗi ngày.
   - Lần chạy đầu tiên từ 5h sáng (giờ VN): gửi bản tóm tắt 3 ngày của tuyến.
   - Các lần sau: chỉ gửi khi xuất hiện điểm biển động mới (chưa báo).
   Chạy thử không gửi: DRY=1 node canh-bao.js · ép gửi tóm tắt: SANG=1 node canh-bao.js */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./chung.js');

const TRANG = 'https://xuanson308.github.io/thoi-tiet-bien/';
const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const tepCh = path.join(__dirname, 'cau-hinh.json');
const tepDb = path.join(__dirname, 'da-bao.json');

function hai(n) { return (n < 10 ? '0' : '') + n; }
function gioVN() { const d = new Date(Date.now() + 7 * 3600000); return {ngay: d.toISOString().slice(0, 10), gio: d.getUTCHours(), khoa: d.toISOString().slice(0, 13) + ':00'}; }
function tenNgay(n, j) { if (j === 0) return 'Hôm nay'; if (j === 1) return 'Ngày mai'; const p = n.split('-'); return THU[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()] + ' ' + p[2] + '/' + p[1]; }

async function layJson(u) {
  for (let lan = 1; lan <= 3; lan++) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {}
    await new Promise((x) => setTimeout(x, 5000 * lan));
  }
  throw new Error('Không tải được ' + u);
}
async function gui(kenh, tieuDe, noiDung, uuTien) {
  if (process.env.DRY) { console.log('--- [không gửi] ' + tieuDe + '\n' + noiDung); return; }
  const r = await fetch('https://ntfy.sh/', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({topic: kenh, title: tieuDe, message: noiDung, priority: uuTien, tags: ['ocean'], click: TRANG})
  });
  if (!r.ok) throw new Error('ntfy trả về ' + r.status);
  console.log('Đã gửi: ' + tieuDe);
}

(async function () {
  const ch = JSON.parse(fs.readFileSync(tepCh, 'utf8'));
  let db = {sang: '', da: []};
  try { db = JSON.parse(fs.readFileSync(tepDb, 'utf8')); } catch (e) {}
  const nay = gioVN();
  const u = C.duongDan();
  const dl = C.gop(await layJson(u.gio), await layJson(u.song));
  const diem = C.tuyen(ch.tu, ch.den);
  const ngay = [];
  dl.gio.forEach((t) => { const n = t.slice(0, 10); if (n >= nay.ngay && ngay.indexOf(n) < 0) ngay.push(n); });
  const ba = ngay.slice(0, 3);

  /* Tóm tắt từng ngày + danh sách khoá cảnh báo hiện có */
  const khoa = [], ngayTT = ba.map((n, j) => {
    let muc = 0, song = 0, gio = 0; const dong = [];
    diem.forEach((p) => {
      const t = C.tomTat(dl, p.id, n, j === 0 ? nay.khoa : null);
      muc = Math.max(muc, t.muc); song = Math.max(song, t.song || 0); gio = Math.max(gio, t.gio || 0);
      if (t.muc > 0) { dong.push({p, t}); khoa.push(n + '|' + p.id + '|' + t.muc); }
    });
    return {n, j, muc, song, gio, dong};
  });
  const ten = C.DIEM.find((p) => p.id === ch.tu).ten + ' → ' + C.DIEM.find((p) => p.id === ch.den).ten;
  function dongNgay(d) {
    if (!d.muc) return tenNgay(d.n, d.j) + ': êm, sóng tới ' + C.so(d.song, 1) + ' m';
    return tenNgay(d.n, d.j) + ': ' + C.MUC_TEN[d.muc].toLowerCase() + ' ở ' + d.dong.map((x) => x.p.ten).join(', ') +
      ' (sóng tới ' + C.so(d.song, 1) + ' m, gió cấp ' + C.capGio(d.gio) + ')';
  }
  const mucMax = Math.max(0, ...ngayTT.map((d) => d.muc));

  if ((db.sang !== nay.ngay && nay.gio >= 5) || process.env.SANG) {
    const hn = ngayTT[0];
    await gui(ch.kenh, (hn.muc ? C.MUC_TEN[hn.muc] : 'Biển êm') + ' hôm nay · ' + ten, ngayTT.map(dongNgay).join('\n'), mucMax === 2 ? 4 : 3);
    db.sang = nay.ngay; db.da = khoa;
  } else {
    const moi = khoa.filter((k) => db.da.indexOf(k) < 0);
    if (moi.length) {
      const ngayMoi = ngayTT.filter((d) => moi.some((k) => k.startsWith(d.n + '|')));
      const m = Math.max(...ngayMoi.map((d) => d.muc));
      await gui(ch.kenh, 'Cảnh báo ' + C.MUC_TEN[m].toLowerCase() + ' · ' + ten, ngayMoi.map(dongNgay).join('\n'), m === 2 ? 5 : 4);
    } else console.log('Không có cảnh báo mới.');
    db.da = khoa.concat(db.da.filter((k) => k.slice(0, 10) >= nay.ngay && khoa.indexOf(k) < 0));
  }
  fs.writeFileSync(tepDb, JSON.stringify(db, null, 1) + '\n');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
