/**
 * Godzilla Wins run sheet comments backend.
 * Paste into Extensions > Apps Script in the comments Google Sheet,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * To hide a comment: type TRUE in its "hidden" column.
 */
var SHEET_NAME = "comments";
var HEADERS = ["timestamp", "show", "segment", "kind", "name", "text", "link", "hidden"];
var MAX_POSTS_PER_10_MIN = 40;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, max) {
  return String(s == null ? "" : s).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

function doGet(e) {
  var show = clean_(e && e.parameter && e.parameter.show, 20);
  if (!show) return json_({ ok: false, error: "missing show" });
  var rows = sheet_().getDataRange().getValues().slice(1);
  var out = [];
  rows.forEach(function (r) {
    if (String(r[1]) !== show) return;
    if (String(r[7]).toUpperCase() === "TRUE") return;
    out.push({
      ts: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      segment: String(r[2]), kind: String(r[3]), name: String(r[4]),
      text: String(r[5]), link: String(r[6])
    });
  });
  return json_({ ok: true, comments: out });
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad request" }); }
  if (data.website) return json_({ ok: true }); // honeypot: bots fill hidden field

  var show = clean_(data.show, 20);
  var segment = clean_(data.segment, 60);
  var kind = data.kind === "addition" ? "addition" : "comment";
  var name = clean_(data.name, 40);
  var text = clean_(data.text, 1000);
  var link = clean_(data.link, 500);
  if (link && !/^https?:\/\//i.test(link)) link = "";
  if (!show || !segment || !name || !text) return json_({ ok: false, error: "name and text are required" });

  var cache = CacheService.getScriptCache();
  var count = Number(cache.get("posts") || 0);
  if (count >= MAX_POSTS_PER_10_MIN) return json_({ ok: false, error: "too many posts, slow down" });
  cache.put("posts", String(count + 1), 600);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    // Prefix values that a spreadsheet would treat as formulas.
    var safe = function (v) { return /^[=+\-@]/.test(v) ? "'" + v : v; };
    sheet_().appendRow([now, show, segment, kind, safe(name), safe(text), link, false]);
    return json_({ ok: true, entry: { ts: now.toISOString(), segment: segment, kind: kind, name: name, text: text, link: link } });
  } finally {
    lock.releaseLock();
  }
}
