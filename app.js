"use strict";
// App Store 上架合规自查 - 界面逻辑。checker.js 负责规则,本文件只负责读写界面。

var SAMPLES = {
  good: {
    name: "晨读英语",
    subtitle: "每天十分钟,读完一篇英语短文",
    description: "晨读英语每天精选一篇英语短文,配有中文翻译与生词讲解,支持离线阅读。高级功能(无限生词本、发音评测)需订阅解锁,订阅价格 ¥18/月。遇到问题请联系 support@example.com。",
    subscription: "高级会员 ¥18/月,自动续订,到期前 24 小时扣费,可随时在设置里取消订阅。首月免费试用 7 天,试用结束后按 ¥18/月收费,试用期内取消不收费。",
    permissions: "通知权限用于每天早上 8 点推送晨读提醒;相册权限用于保存生词卡片图片。App 不收集通讯录,不与第三方共享数据。隐私政策见下方链接,支持在 App 内注销并删除账号。",
    privacyUrl: "https://example.com/privacy"
  },
  bad: {
    name: "免费清理大师-手机加速省电,第一清理工具",
    subtitle: "免费清理,限免中,病毒扫描只要 ¥0",
    description: "免费清理大师,最好用的清理工具,永久免费!一键清理内存、病毒扫描、测血压只要打开摄像头。高级会员只要 ¥9/月,官网购买更便宜,去网站订阅享 5 折。Beta 测试版,功能陆续上线,敬请期待。",
    subscription: "会员 ¥30/月,还有 ¥98/年的年费会员,免费试用,开通即扣费。",
    permissions: "需要权限,为了更好的体验请允许通讯录、短信、位置权限。",
    privacyUrl: ""
  }
};

var $ = function (id) { return document.getElementById(id); };
var lastResult = null;

function readInput() {
  return {
    name: $("appName").value,
    subtitle: $("subtitle").value,
    description: $("description").value,
    subscription: $("subscription").value,
    permissions: $("permissions").value,
    privacyUrl: $("privacyUrl").value
  };
}

function filledCount() {
  var inp = readInput();
  var n = 0;
  ["name", "subtitle", "description", "subscription", "permissions", "privacyUrl"].forEach(function (k) {
    if (inp[k] && inp[k].trim()) n++;
  });
  return n;
}

function updateMeta() {
  $("inputMeta").textContent = filledCount() + " 项已填";
}

function toast(msg) {
  var t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(function () { t.hidden = true; }, 3000);
}

function statusLabel(s) {
  return s === "pass" ? "通过" : s === "warn" ? "警告" : "不通过";
}

function renderHumanList() {
  var ul = $("humanList");
  ul.innerHTML = "";
  HUMAN_CHECKS.forEach(function (h) {
    var li = document.createElement("li");
    li.className = "human-item";
    var label = document.createElement("label");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.hid = h.id;
    cb.addEventListener("change", updateHumanMeta);
    var span = document.createElement("span");
    var b = document.createElement("b");
    b.textContent = h.title;
    var small = document.createElement("small");
    small.textContent = " 条款 " + h.guideline + " - " + h.note;
    span.appendChild(b);
    span.appendChild(document.createElement("br"));
    span.appendChild(small);
    label.appendChild(cb);
    label.appendChild(span);
    li.appendChild(label);
    ul.appendChild(li);
  });
  updateHumanMeta();
}

function updateHumanMeta() {
  var total = HUMAN_CHECKS.length;
  var checked = document.querySelectorAll("#humanList input:checked").length;
  $("humanMeta").textContent = checked + " / " + total + " 项已确认";
}

function humanState() {
  var state = {};
  document.querySelectorAll("#humanList input").forEach(function (cb) {
    state[cb.dataset.hid] = cb.checked;
  });
  return state;
}

function renderReport(result, human) {
  lastResult = { result: result, human: human };
  $("reportPanel").hidden = false;
  $("scoreNum").textContent = result.score;
  var badge = $("gradeBadge");
  badge.textContent = result.grade + " 级";
  badge.className = "grade g-" + result.grade;
  var sub = "";
  if (result.grade === "A") sub = "文字层面未发现明显违规点,人工清单确认完即可提交。";
  else if (result.grade === "B") sub = "有少量警告项,修掉再提交更稳妥。";
  else if (result.grade === "C") sub = "存在较多风险点,建议按修复清单逐项改完再提交。";
  else sub = "存在多项不通过,现在提交很可能被打回,先按修复清单改。";
  $("scoreSub").textContent = sub;
  $("countsRow").innerHTML = "共 " + result.counts.total + " 项 · <b class='pass'>通过 " + result.counts.pass + "</b> · <b class='warn'>警告 " + result.counts.warn + "</b> · <b class='fail'>不通过 " + result.counts.fail + "</b>";
  $("reportMeta").textContent = "规则依据:Apple《App Store Review Guidelines》,核对于 2026-11-27";

  var m = result.metrics;
  var metrics = [
    { label: "名称长度", value: m.nameLength + " 字符", sub: "上限 30 字符" },
    { label: "描述长度", value: m.descLength + " 字符", sub: "已粘贴的描述" },
    { label: "描述里的价格", value: m.pricesInDesc.length ? m.pricesInDesc.join("、") : "无", sub: "须与订阅价格一致" },
    { label: "订阅里的价格", value: m.pricesInSub.length ? m.pricesInSub.join("、") : "无", sub: "须与描述价格一致" },
    { label: "提到的权限", value: m.permissionsFound.length ? m.permissionsFound.length + " 项" : "未列出", sub: m.permissionsFound.join("、") || "权限说明里未列出" }
  ];
  $("metricsGrid").innerHTML = metrics.map(function (x) {
    return "<div class='metric'><div class='m-label'>" + x.label + "</div><div class='m-value'>" + escapeHtml(x.value) + "</div><div class='m-sub'>" + escapeHtml(x.sub) + "</div></div>";
  }).join("");

  var groups = {};
  result.checks.forEach(function (c) {
    (groups[c.cat] = groups[c.cat] || []).push(c);
  });
  var wrap = $("checkGroups");
  wrap.innerHTML = "";
  Object.keys(groups).forEach(function (cat) {
    var list = groups[cat];
    var f = list.filter(function (c) { return c.status === "fail"; }).length;
    var w = list.filter(function (c) { return c.status === "warn"; }).length;
    var det = document.createElement("details");
    det.className = "cat-group";
    det.open = f > 0 || w > 0;
    var sum = document.createElement("summary");
    sum.innerHTML = "<b>" + escapeHtml(cat) + "</b> <span class='meta'>" + list.length + " 项 · 通过 " + (list.length - f - w) + " · 警告 " + w + " · 不通过 " + f + "</span>";
    det.appendChild(sum);
    var ul = document.createElement("ul");
    ul.className = "check-list";
    list.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "check-item";
      var head = "<div class='check-head'><span class='status " + c.status + "'>" + statusLabel(c.status) + "</span><span class='check-title'>" + escapeHtml(c.id + " " + c.title) + "</span><span class='meta'>条款 " + escapeHtml(c.guideline) + "</span></div>";
      var detail = "<p class='check-detail'>修复: " + escapeHtml(c.fix) + "</p>";
      var ev = "";
      if (c.evidence && c.evidence.length) {
        ev = "<ul class='evidence'>" + c.evidence.map(function (e) { return "<li>" + escapeHtml(e) + "</li>"; }).join("") + "</ul>";
      }
      li.innerHTML = head + detail + ev;
      ul.appendChild(li);
    });
    det.appendChild(ul);
    wrap.appendChild(det);
  });

  var hUl = $("humanResultList");
  hUl.innerHTML = "";
  HUMAN_CHECKS.forEach(function (h) {
    var ok = !!human[h.id];
    var li = document.createElement("li");
    li.className = "check-item";
    li.innerHTML = "<div class='check-head'><span class='status " + (ok ? "pass" : "pending") + "'>" + (ok ? "已确认" : "待确认") + "</span><span class='check-title'>" + escapeHtml(h.id + " " + h.title) + "</span><span class='meta'>条款 " + escapeHtml(h.guideline) + "</span></div><p class='check-detail'>" + escapeHtml(h.note) + "</p>";
    hUl.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function run() {
  var inp = readInput();
  if (!inp.name.trim() && !inp.description.trim()) {
    toast("请至少填写 App 名称与描述。");
    return;
  }
  var result = runChecks(inp);
  renderReport(result, humanState());
  $("reportPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildMarkdown() {
  if (!lastResult) return "";
  var r = lastResult.result;
  var human = lastResult.human;
  var lines = [];
  lines.push("# App Store 上架合规自查报告");
  lines.push("");
  lines.push("App 名称:" + (r.input.name || "(未填)"));
  lines.push("评分:" + r.score + " 分(" + r.grade + " 级),共 " + r.counts.total + " 项,通过 " + r.counts.pass + "、警告 " + r.counts.warn + "、不通过 " + r.counts.fail + "。");
  lines.push("");
  lines.push("## 确定性检查");
  lines.push("");
  var cats = {};
  r.checks.forEach(function (c) { (cats[c.cat] = cats[c.cat] || []).push(c); });
  Object.keys(cats).forEach(function (cat) {
    lines.push("### " + cat);
    lines.push("");
    cats[cat].forEach(function (c) {
      var mark = c.status === "pass" ? "通过" : c.status === "warn" ? "警告" : "不通过";
      lines.push("- [" + mark + "] " + c.id + " " + c.title + "(条款 " + c.guideline + ")");
      if (c.status !== "pass") {
        lines.push("  - 修复:" + c.fix);
        (c.evidence || []).forEach(function (e) { lines.push("  - 证据:" + e); });
      }
    });
    lines.push("");
  });
  lines.push("## 人工核对");
  lines.push("");
  HUMAN_CHECKS.forEach(function (h) {
    lines.push("- [" + (human[h.id] ? "已确认" : "待确认") + "] " + h.id + " " + h.title + "(条款 " + h.guideline + ")");
  });
  lines.push("");
  lines.push("规则依据:Apple《App Store Review Guidelines》(developer.apple.com/app-store/review/guidelines/),核对于 2026-11-27。");
  lines.push("通过自查不等于过审,最终以苹果审核结果为准。");
  return lines.join("\n");
}

function copyText(text, okMsg) {
  function done() { toast(okMsg); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}

function downloadMd() {
  var md = buildMarkdown();
  if (!md) return;
  var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  var name = (lastResult.result.input.name || "app") .replace(/[\\/:*?"<>|]/g, "");
  a.download = "app-store-check-" + name + ".md";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
  toast("报告已下载。");
}

document.addEventListener("DOMContentLoaded", function () {
  renderHumanList();
  ["appName", "subtitle", "description", "subscription", "permissions", "privacyUrl"].forEach(function (id) {
    $(id).addEventListener("input", updateMeta);
  });
  updateMeta();
  $("runBtn").addEventListener("click", run);
  $("clearBtn").addEventListener("click", function () {
    ["appName", "subtitle", "description", "subscription", "permissions", "privacyUrl"].forEach(function (id) { $(id).value = ""; });
    $("reportPanel").hidden = true;
    lastResult = null;
    updateMeta();
    toast("已清空。");
  });
  document.querySelectorAll("[data-sample]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var s = SAMPLES[btn.dataset.sample];
      $("appName").value = s.name;
      $("subtitle").value = s.subtitle;
      $("description").value = s.description;
      $("subscription").value = s.subscription;
      $("permissions").value = s.permissions;
      $("privacyUrl").value = s.privacyUrl;
      updateMeta();
      run();
    });
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
  });
  $("copyMdBtn").addEventListener("click", function () {
    var md = buildMarkdown();
    if (md) copyText(md, "报告已复制。");
  });
  $("downloadBtn").addEventListener("click", downloadMd);
});
