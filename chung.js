/* Dùng chung cho trang xem (index.html) và bộ gửi thông báo (canh-bao.js) */
(function (g) {
  'use strict';
  /* Các điểm dọc bờ biển, xếp từ Bắc vào Nam rồi vòng sang vịnh Thái Lan. Tọa độ ngoài khơi gần cảng để có số liệu sóng. */
  var DIEM = [
    {id:'qn',  ten:'Quảng Ninh',           lat:20.85, lon:107.35},
    {id:'hp',  ten:'Hải Phòng',            lat:20.70, lon:106.95},
    {id:'vbb', ten:'Giữa vịnh Bắc Bộ',     lat:19.80, lon:107.20},
    {id:'ns',  ten:'Nghi Sơn',             lat:19.30, lon:106.00},
    {id:'va',  ten:'Vũng Áng',             lat:18.10, lon:106.55},
    {id:'cc',  ten:'Vùng biển Cồn Cỏ',     lat:17.10, lon:107.50},
    {id:'dn',  ten:'Đà Nẵng',              lat:16.15, lon:108.35},
    {id:'dq',  ten:'Dung Quất',            lat:15.45, lon:109.00},
    {id:'qnh', ten:'Quy Nhơn',             lat:13.75, lon:109.35},
    {id:'nt',  ten:'Nha Trang',            lat:12.20, lon:109.35},
    {id:'pt',  ten:'Vùng biển Phan Thiết', lat:10.85, lon:108.45},
    {id:'vt',  ten:'Vũng Tàu',             lat:10.25, lon:107.10},
    {id:'cd',  ten:'Côn Đảo',              lat:8.70,  lon:106.60},
    {id:'cm',  ten:'Mũi Cà Mau',           lat:8.40,  lon:104.75},
    {id:'pq',  ten:'Phú Quốc',             lat:9.90,  lon:103.90}
  ];
  var CAP = [1,6,12,20,29,39,50,62,75,89,103,118];
  var HUONG = ['Bắc','Đông Bắc','Đông','Đông Nam','Nam','Tây Nam','Tây','Tây Bắc'];
  var MUC_TEN = ['Êm','Biển động','Biển động mạnh'];

  function capGio(k) { if (k == null) return null; var c = 0; while (c < CAP.length && k >= CAP[c]) c++; return c; }
  function tenHuong(d) { return d == null ? '' : HUONG[Math.round(d / 45) % 8]; }
  /* 0 êm · 1 biển động (gió cấp 6, giật cấp 8, sóng 2 m) · 2 động mạnh (gió cấp 8, giật cấp 10, sóng 3,5 m) */
  function mucGio(gio, giat, song) {
    var c = capGio(gio) || 0, g2 = capGio(giat) || 0, s = song || 0;
    if (c >= 8 || g2 >= 10 || s >= 3.5) return 2;
    if (c >= 6 || g2 >= 8 || s >= 2) return 1;
    return 0;
  }
  function so(x, n) { return x == null ? '–' : x.toFixed(n).replace('.', ','); }
  function tuyen(tu, den) {
    var a = -1, b = -1;
    DIEM.forEach(function (p, i) { if (p.id === tu) a = i; if (p.id === den) b = i; });
    if (a < 0 || b < 0) { a = 0; b = DIEM.length - 1; }
    var ds = DIEM.slice(Math.min(a, b), Math.max(a, b) + 1);
    return a > b ? ds.reverse() : ds;
  }
  function duongDan() {
    var la = DIEM.map(function (p) { return p.lat; }).join(',');
    var lo = DIEM.map(function (p) { return p.lon; }).join(',');
    var chung = 'latitude=' + la + '&longitude=' + lo + '&timezone=Asia%2FBangkok&forecast_days=7';
    return {
      gio: 'https://api.open-meteo.com/v1/forecast?' + chung + '&models=ecmwf_ifs&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation',
      song: 'https://marine-api.open-meteo.com/v1/marine?' + chung + '&hourly=wave_height,wave_direction,wave_period'
    };
  }
  /* Gộp 2 kết quả Open-Meteo thành {gio:[giờ], diem:{id:{gio,huong,giat,mua,song}}} */
  function gop(kqGio, kqSong) {
    var a = [].concat(kqGio), b = [].concat(kqSong);
    var dl = {gio: a[0].hourly.time, diem: {}};
    DIEM.forEach(function (p, i) {
      var f = a[i].hourly, m = b[i] ? b[i].hourly : null, viTri = {};
      if (m) m.time.forEach(function (t, j) { viTri[t] = j; });
      dl.diem[p.id] = {
        gio: f.wind_speed_10m, huong: f.wind_direction_10m, giat: f.wind_gusts_10m, mua: f.precipitation,
        song: f.time.map(function (t) { var j = viTri[t]; return (m && j != null) ? m.wave_height[j] : null; })
      };
    });
    return dl;
  }
  /* Tóm tắt một điểm trong một ngày (yyyy-mm-dd), bỏ các giờ trước "tuGio" */
  function tomTat(dl, id, ngay, tuGio) {
    var d = dl.diem[id], kq = {song:null, gio:null, giat:null, mua:0, muc:0, huong:null};
    dl.gio.forEach(function (t, i) {
      if (t.slice(0, 10) !== ngay || (tuGio && t < tuGio)) return;
      if (d.song[i] != null && (kq.song == null || d.song[i] > kq.song)) kq.song = d.song[i];
      if (d.gio[i] != null && (kq.gio == null || d.gio[i] > kq.gio)) { kq.gio = d.gio[i]; kq.huong = d.huong[i]; }
      if (d.giat[i] != null && (kq.giat == null || d.giat[i] > kq.giat)) kq.giat = d.giat[i];
      kq.mua += d.mua[i] || 0;
      kq.muc = Math.max(kq.muc, mucGio(d.gio[i], d.giat[i], d.song[i]));
    });
    return kq;
  }

  var C = {DIEM:DIEM, MUC_TEN:MUC_TEN, capGio:capGio, tenHuong:tenHuong, mucGio:mucGio, so:so, tuyen:tuyen, duongDan:duongDan, gop:gop, tomTat:tomTat};
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else g.CHUNG = C;
})(this);
