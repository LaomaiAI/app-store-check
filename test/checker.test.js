"use strict";
// node test/checker.test.js - 不依赖任何第三方包
var assert = require("assert");
var checker = require("../checker.js");
var runChecks = checker.runChecks;

var GOOD = {
  name: "晨读英语",
  subtitle: "每天十分钟,读完一篇英语短文",
  description: "晨读英语每天精选一篇英语短文,配有中文翻译与生词讲解,支持离线阅读。高级功能(无限生词本、发音评测)需订阅解锁,订阅价格 ¥18/月。遇到问题请联系 support@example.com。",
  subscription: "高级会员 ¥18/月,自动续订,到期前 24 小时扣费,可随时在设置里取消订阅。首月免费试用 7 天,试用结束后按 ¥18/月收费,试用期内取消不收费。",
  permissions: "通知权限用于每天早上 8 点推送晨读提醒;相册权限用于保存生词卡片图片。App 不收集通讯录,不与第三方共享数据。隐私政策见下方链接,支持在 App 内注销并删除账号。",
  privacyUrl: "https://example.com/privacy"
};

var BAD = {
  name: "免费清理大师-手机加速省电,第一清理工具",
  subtitle: "免费清理,限免中,病毒扫描只要 ¥0",
  description: "免费清理大师,最好用的清理工具,永久免费!一键清理内存、病毒扫描、测血压只要打开摄像头。高级会员只要 ¥9/月,官网购买更便宜,去网站订阅享 5 折。Beta 测试版,功能陆续上线,敬请期待。",
  subscription: "会员 ¥30/月,还有 ¥98/年的年费会员,免费试用,开通即扣费。",
  permissions: "需要权限,为了更好的体验请允许通讯录、短信、位置权限。",
  privacyUrl: ""
};

function countBy(result, status) {
  return result.checks.filter(function (c) { return c.status === status; }).length;
}

function get(result, id) {
  return result.checks.filter(function (c) { return c.id === id; })[0];
}

// 1. 合格示例应为 A,35 项里至多 1 个警告
var good = runChecks(GOOD);
assert.strictEqual(good.counts.total, 35, "规则总数应为 35");
assert.strictEqual(good.counts.fail, 0, "合格示例不应有不通过,实际:" + JSON.stringify(good.checks.filter(function (c) { return c.status === "fail"; })));
assert.ok(good.counts.warn <= 1, "合格示例警告应不超过 1 个,实际:" + good.counts.warn);
assert.strictEqual(good.grade, "A", "合格示例应为 A,实际:" + good.grade + " 分:" + good.score);
assert.strictEqual(good.metrics.nameLength, 4);
assert.deepStrictEqual(good.metrics.pricesInDesc, [18]);
assert.deepStrictEqual(good.metrics.pricesInSub, [18, 18]);
console.log("GOOD ok: score=" + good.score + " grade=" + good.grade + " warns=" + good.counts.warn);

// 2. 问题示例应为 D,且命中关键规则
var bad = runChecks(BAD);
assert.ok(bad.counts.fail >= 8, "问题示例不通过应不少于 8 个,实际:" + bad.counts.fail);
assert.strictEqual(bad.grade, "D", "问题示例应为 D,实际:" + bad.grade);
assert.strictEqual(get(bad, "A2").status, "fail", "A2 名称含免费应不通过");
assert.strictEqual(get(bad, "A4").status, "fail", "A4 含 Beta 与敬请期待应不通过");
assert.strictEqual(get(bad, "A5").status, "fail", "A5 病毒扫描应不通过");
assert.strictEqual(get(bad, "A9").status, "fail", "A9 副标题含免费与价格应不通过");
assert.strictEqual(get(bad, "A10").status, "fail", "A10 官网购买应不通过");
assert.strictEqual(get(bad, "A12").status, "fail", "A12 描述说免费但订阅标价应不通过");
assert.strictEqual(get(bad, "B1").status, "fail", "B1 订阅缺自动续订应不通过");
assert.strictEqual(get(bad, "B2").status, "fail", "B2 描述与订阅价格不一致应不通过");
assert.strictEqual(get(bad, "C1").status, "fail", "C1 缺隐私政策应不通过");
assert.strictEqual(get(bad, "C3").status, "warn", "C3 权限用途含糊应警告");
assert.strictEqual(get(bad, "C4").status, "warn", "C4 申请通讯录与短信应警告");
console.log("BAD ok: score=" + bad.score + " grade=" + bad.grade + " fails=" + bad.counts.fail + " warns=" + bad.counts.warn);

// 3. 空输入不崩溃
var empty = runChecks({ name: "", subtitle: "", description: "", subscription: "", permissions: "", privacyUrl: "" });
assert.strictEqual(empty.counts.total, 35);
assert.strictEqual(get(empty, "C1").status, "fail", "空输入时 C1 缺隐私政策应不通过");
console.log("EMPTY ok: score=" + empty.score);

// 4. 边界:名称正好 30 字符通过,31 字符不通过
var n30 = runChecks({ name: "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十", description: "x" });
assert.strictEqual(get(n30, "A1").status, "pass", "30 字符名称应通过");
var n31 = runChecks({ name: "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一", description: "x" });
assert.strictEqual(get(n31, "A1").status, "fail", "31 字符名称应不通过");
console.log("NAME-LENGTH ok");

// 5. 订阅周期 3 天不通过,7 天通过
var s3 = runChecks({ subscription: "会员 3 天订阅 ¥6,自动续订,可随时取消。" });
assert.strictEqual(get(s3, "B4").status, "fail", "3 天订阅应不通过");
var s7 = runChecks({ subscription: "会员 7 天订阅 ¥6,自动续订,可随时取消。" });
assert.strictEqual(get(s7, "B4").status, "pass", "7 天订阅应通过");
console.log("SUB-PERIOD ok");

// 6. 人工核对清单 11 项
assert.strictEqual(checker.HUMAN_CHECKS.length, 11, "人工核对清单应为 11 项");
assert.strictEqual(checker.RULES.length, 35, "规则库应为 35 条");
console.log("ALL TESTS PASSED");
