"use strict";
// App Store 上架合规自查 - 确定性规则库
// 规则依据: Apple《App Store Review Guidelines》
// https://developer.apple.com/app-store/review/guidelines/
// 核对日期: 2026-11-27(逐条对照官网原文,条款编号以官网为准)
// 另参考开源仓库 mjmirza/app-store-compliance(英文 playbook,125 条被拒模式)
// 本文件为独立实现的中文网页版规则库,与上述仓库无代码关系。
// 用法: runChecks({name, subtitle, description, subscription, permissions, privacyUrl})
// 返回 {checks, score, grade, counts, metrics}。全部本地计算,不上传任何内容。

function norm(v) {
  return (v === undefined || v === null) ? "" : String(v);
}

function snippets(text, re, max) {
  var out = [];
  var m;
  var rx = new RegExp(re.source, re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags);
  while ((m = rx.exec(text)) !== null && out.length < (max || 3)) {
    var s = String(m[0]).replace(/\s+/g, " ").trim();
    if (s.length > 60) s = s.slice(0, 60) + "…";
    if (out.indexOf(s) === -1) out.push(s);
    if (m[0].length === 0) rx.lastIndex++;
  }
  return out;
}

function has(text, re) {
  return re.test(text);
}

// 从文本里抽价格数字,须带货币符号或元/美元单位,避免把 24 小时、7 天这类数字当成价格。
function extractPrices(text) {
  var out = [];
  var re = /(?:[¥￥$]\s*(\d+(?:\.\d{1,2})?))|(?:(\d+(?:\.\d{1,2})?)\s*(?:元|美元))/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var n = parseFloat(m[1] !== undefined ? m[1] : m[2]);
    if (!isNaN(n) && n >= 0 && n < 100000) out.push(n);
  }
  return out;
}

var PRICE_RE = /[¥￥$]\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:元|美元)/;

var RULES = [
  // ---- A. 元数据(2.3) ----
  {
    id: "A1", cat: "元数据", title: "App 名称不超过 30 个字符",
    guideline: "2.3.7", fix: "把名称缩短到 30 个字符以内,多余的描述词移到副标题或描述里。",
    test: function (inp) {
      if (!inp.name) return { status: "pass", evidence: [] };
      var n = inp.name.length;
      return n > 30
        ? { status: "fail", evidence: ["名称共 " + n + " 个字符:“" + inp.name.slice(0, 40) + "”"] }
        : { status: "pass", evidence: ["名称共 " + n + " 个字符"] };
    }
  },
  {
    id: "A2", cat: "元数据", title: "名称不含价格、免费等字样",
    guideline: "2.3.7", fix: "从名称里去掉免费、价格、限免等字样,名称只写 App 本身的名字。",
    test: function (inp) {
      var ev = snippets(inp.name, /免费|Free|free|￥|¥|\$|0元|限免|价格/g);
      if (ev.length) return { status: "fail", evidence: ev };
      var ev2 = snippets(inp.name, /最|第一|#1|No\.1|最好|最强/g);
      if (ev2.length) return { status: "warn", evidence: ev2 };
      return { status: "pass", evidence: [] };
    }
  },
  {
    id: "A3", cat: "元数据", title: "名称不含其他平台的名字",
    guideline: "2.3.10", fix: "去掉 Android、Google Play、安卓、APK、鸿蒙等其他平台的名字和图标。",
    test: function (inp) {
      var ev = snippets(inp.name + " " + inp.subtitle, /Android|Google Play|安卓|APK|鸿蒙|HarmonyOS|小米应用|华为应用|应用宝/gi);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A4", cat: "元数据", title: "描述与名称无占位、测试、未完成字样",
    guideline: "2.1(a)、2.2", fix: "删掉 lorem、TODO、测试版、Beta、试用版、即将上线、敬请期待等字样,提交的必须是完成版。",
    test: function (inp) {
      var all = inp.name + " " + inp.subtitle + " " + inp.description;
      var ev = snippets(all, /lorem|TODO|FIXME|XXX|占位|测试版|Beta|beta|试用版|演示版|Demo|coming soon|即将上线|敬请期待|功能建设中|内测版/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A5", cat: "元数据", title: "不宣传病毒扫描、杀毒等虚假功能",
    guideline: "2.3.1(a)", fix: "删掉病毒扫描、杀毒、查杀病毒等宣传,iOS 不允许这类功能描述,写了会被直接打回。",
    test: function (inp) {
      var all = inp.description + " " + inp.subtitle;
      var ev = snippets(all, /病毒扫描|杀毒|查杀病毒|病毒查杀|恶意软件扫描/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A6", cat: "元数据", title: "不用手机传感器冒充医疗测量",
    guideline: "1.4.1", fix: "删掉仅用手机传感器测血压、血糖、血氧、体温的说法,医疗数据须有可验证的准确性依据,否则直接被拒。",
    test: function (inp) {
      var all = inp.description + " " + inp.subtitle;
      if (!/测血压|测血糖|测血氧|测体温|测心率/.test(all)) return { status: "pass", evidence: [] };
      var ev = snippets(all, /仅用手机|无需设备|用手机传感器|摄像头测|手机测血压|手机测血糖|手机测血氧/g);
      if (ev.length) return { status: "fail", evidence: ev };
      return { status: "warn", evidence: ["描述提到医疗测量,请确认准确性有可验证的依据"] };
    }
  },
  {
    id: "A7", cat: "元数据", title: "有内购或订阅时,描述里要写明需额外付费",
    guideline: "2.3.2", fix: "在描述里加一句哪些功能、关卡、订阅需要额外付费,别让用户以为全免费。",
    test: function (inp) {
      var hasIap = /订阅|会员|内购|解锁|Pro|高级版|专业版/.test(inp.subscription + " " + inp.description);
      if (!hasIap) return { status: "pass", evidence: [] };
      var disclosed = /付费|内购|订阅|解锁|高级功能|会员/.test(inp.description);
      return disclosed ? { status: "pass", evidence: [] } : { status: "warn", evidence: ["订阅或内购信息已填,但描述里没提需额外付费"] };
    }
  },
  {
    id: "A8", cat: "元数据", title: "描述不用无法验证的断言",
    guideline: "2.3.7、2.3.14", fix: "删掉最好、第一、100%、保证通过、永久免费这类没法验证的话,改写成可核实的事实。",
    test: function (inp) {
      var ev = snippets(inp.description + " " + inp.subtitle, /最(好|快|强|专业|全)|第一|100%|保证通过|稳过|永久免费|永不收费/g);
      return ev.length ? { status: "warn", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A9", cat: "元数据", title: "副标题不含价格或免费字样",
    guideline: "2.3.7", fix: "把副标题里的免费、价格符号、金额删掉,副标题只写一句话介绍 App 是干什么的。",
    test: function (inp) {
      var ev = snippets(inp.subtitle, /免费|￥|¥|\$|元\/|价格|限免/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A10", cat: "元数据", title: "描述不引导去 App 外购买",
    guideline: "3.1.1(a)", fix: "删掉官网购买、去网站订阅、微信支付、支付宝、扫码支付等站外购买引导,数字内容与服务须走内购(美国区商店例外,须另行申请 entitlement)。",
    test: function (inp) {
      var all = inp.description + " " + inp.subscription;
      var ev = snippets(all, /官网购买|去网站购买|到官网订阅|微信支付|支付宝支付|扫码支付|公众号购买|站外购买|点击链接购买|去官网开通/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A11", cat: "元数据", title: "名称不堆关键词",
    guideline: "2.3.7", fix: "名称只写一个名字,别用逗号、顿号、竖线堆关键词,堆词会被改名甚至被拒。",
    test: function (inp) {
      var ev = snippets(inp.name, /[，、,｜|]/g);
      return ev.length ? { status: "warn", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "A12", cat: "元数据", title: "描述说免费,订阅价格要对得上",
    guideline: "2.3.1(a)", fix: "描述里写免费,就别在订阅里标价;有收费项目就别写完全免费,虚假价格会被直接打回。",
    test: function (inp) {
      if (!/免费|完全免费|全免费/.test(inp.description)) return { status: "pass", evidence: [] };
      var ev = snippets(inp.subscription, PRICE_RE);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  // ---- B. 订阅与内购(3.1) ----
  {
    id: "B1", cat: "订阅与内购", title: "订阅写明自动续订",
    guideline: "3.1.2(c)", fix: "在订阅说明里写清自动续订、扣费周期、价格,以及到期前可取消,这是订阅上架的硬性要求。",
    test: function (inp) {
      if (!/订阅|会员/.test(inp.subscription)) return { status: "pass", evidence: [] };
      return /自动续|自动续订|自动续费|到期后自动|自动扣费/.test(inp.subscription)
        ? { status: "pass", evidence: [] }
        : { status: "fail", evidence: ["订阅说明里没找到自动续订相关表述"] };
    }
  },
  {
    id: "B2", cat: "订阅与内购", title: "描述里的价格与订阅价格一致",
    guideline: "2.3.1(a)", fix: "把描述和订阅说明里的价格改成一致,虚假价格或两处价格打架会被打回。",
    test: function (inp) {
      var d = extractPrices(inp.description);
      var s = extractPrices(inp.subscription);
      if (!d.length || !s.length) return { status: "pass", evidence: [] };
      var same = d.some(function (x) { return s.indexOf(x) !== -1; });
      return same
        ? { status: "pass", evidence: [] }
        : { status: "fail", evidence: ["描述里价格:" + d.join("、") + ";订阅说明里价格:" + s.join("、")] };
    }
  },
  {
    id: "B3", cat: "订阅与内购", title: "免费试用写清天数与到期后收费",
    guideline: "3.1.2", fix: "写清试用几天、到期后按什么价格收费、到期前如何取消,别只写免费试用四个字。",
    test: function (inp) {
      if (!/免费试用|试用期|免费体验/.test(inp.subscription + " " + inp.description)) return { status: "pass", evidence: [] };
      var all = inp.subscription + " " + inp.description;
      if (!/\d+\s*天/.test(all)) return { status: "warn", evidence: ["提到免费试用,但没写试用天数"] };
      if (!/到期后|到期将|试用结束/.test(all)) return { status: "warn", evidence: ["写了试用天数,但没说明到期后怎么收费"] };
      return { status: "pass", evidence: [] };
    }
  },
  {
    id: "B4", cat: "订阅与内购", title: "订阅周期不少于 7 天",
    guideline: "3.1.2(a)", fix: "自动续订的周期至少 7 天,3 天、5 天这类短周期订阅不合规,改成按周或按月。",
    test: function (inp) {
      var ev = snippets(inp.subscription, /[1-6]\s*天(订阅|会员|套餐)|按天订阅/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "B5", cat: "订阅与内购", title: "不拿发帖、邀请等额外任务换权益",
    guideline: "3.1.2(a)", fix: "删掉发帖解锁、分享得会员、邀请好友得会员这类写法,用户付了钱就该直接拿到权益,不用再做额外任务。",
    test: function (inp) {
      var all = inp.description + " " + inp.subscription;
      var ev = snippets(all, /发帖.*(解锁|领取|开通)|分享.*(解锁|领取|得会员)|邀请.*好友.*(解锁|得会员|领会员)|上传通讯录.*(解锁|得)/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "B6", cat: "订阅与内购", title: "不含挖矿、做任务换币",
    guideline: "3.1.5(ii)(v)", fix: "删掉挖矿、做任务得币、下载 App 换币这类玩法,App 内挖矿和任务换币都不允许。",
    test: function (inp) {
      var all = inp.description + " " + inp.subscription;
      var ev = snippets(all, /挖矿|挖币|做任务.*(得币|赚币|领币|得.*币)/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "B7", cat: "订阅与内购", title: "抽奖、开箱、盲盒写明概率",
    guideline: "3.1.1", fix: "有随机奖励(抽奖、开箱、盲盒)就要在购买前公示每种奖励的概率,没公示会被打回。",
    test: function (inp) {
      var all = inp.description + " " + inp.subscription;
      if (!/抽奖|开箱|盲盒|随机.*(奖励|礼包|道具)/.test(all)) return { status: "pass", evidence: [] };
      return /概率|几率|odds|公示概率/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["提到随机奖励,但没找到概率公示"] };
    }
  },
  {
    id: "B8", cat: "订阅与内购", title: "订阅写明如何取消",
    guideline: "3.1.2(c)", fix: "在订阅说明里写清随时可以取消、去哪里取消,用户必须能在到期前取消自动续订。",
    test: function (inp) {
      if (!/订阅|会员/.test(inp.subscription)) return { status: "pass", evidence: [] };
      return /随时取消|可以取消|取消订阅|退订|管理订阅/.test(inp.subscription)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["订阅说明里没写如何取消"] };
    }
  },
  // ---- C. 隐私与权限(5.1) ----
  {
    id: "C1", cat: "隐私与权限", title: "隐私政策链接已提供",
    guideline: "5.1.1(i)", fix: "在 App Store Connect 元数据和 App 内都放隐私政策链接,缺链接会被直接打回。",
    test: function (inp) {
      var url = norm(inp.privacyUrl).trim();
      if (url) return { status: "pass", evidence: [] };
      var found = /https?:\/\/\S+/.test(inp.permissions + " " + inp.description);
      return found ? { status: "pass", evidence: [] } : { status: "fail", evidence: ["没找到隐私政策链接"] };
    }
  },
  {
    id: "C2", cat: "隐私与权限", title: "隐私政策链接格式有效",
    guideline: "5.1.1(i)", fix: "隐私政策链接须是完整可访问的 https 网址,别只写域名或文字。",
    test: function (inp) {
      var url = norm(inp.privacyUrl).trim();
      if (!url) return { status: "pass", evidence: [] };
      return /^https?:\/\/\S+$/.test(url)
        ? { status: "pass", evidence: [] }
        : { status: "fail", evidence: ["链接格式不对:“" + url.slice(0, 60) + "”"] };
    }
  },
  {
    id: "C3", cat: "隐私与权限", title: "权限用途写具体,不含糊",
    guideline: "5.1.1(ii)", fix: "每个权限都要写清用来干什么,例如相册用于保存作品,别写为了更好的体验、需要权限这类空话。",
    test: function (inp) {
      var perm = /相册|相机|麦克风|位置|通讯录|通知|照片|语音|健康|运动|日历|提醒事项|蓝牙|本地网络/.test(inp.permissions);
      if (!perm) return { status: "pass", evidence: [] };
      var vague = /为了更好的体验|需要权限|为了给您提供更好的服务|我们需要您的权限|需要获取您的权限/.test(inp.permissions);
      if (vague) return { status: "warn", evidence: snippets(inp.permissions, /为了更好的体验|需要权限|为了给您提供更好的服务|我们需要您的权限|需要获取您的权限/g) };
      if (!/用于|用来|以便|用途|目的是/.test(inp.permissions)) return { status: "warn", evidence: ["列了权限,但没写每个权限的具体用途"] };
      return { status: "pass", evidence: [] };
    }
  },
  {
    id: "C4", cat: "隐私与权限", title: "不申请通讯录、短信、通话记录等敏感权限",
    guideline: "5.1.1(iii)(iv)", fix: "只申请核心功能必需的权限,通讯录、短信、通话记录这类敏感权限没有充分理由会被打回,能不用就不用。",
    test: function (inp) {
      // 先去掉“不收集通讯录”这类否定表述,避免把明确不收集写成警告。
      var cleaned = inp.permissions.replace(/不(收集|读取|申请|使用|获取|访问).{0,6}(通讯录|短信|通话记录)/g, "");
      var ev = snippets(cleaned, /通讯录|短信|通话记录|读取.*短信|读取.*通话/g);
      return ev.length ? { status: "warn", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "C5", cat: "隐私与权限", title: "用到广告标识先征得用户同意",
    guideline: "5.1.2(i)", fix: "用到 IDFA、广告标识、跨应用追踪,须先走 AppTrackingTransparency 弹窗征得用户同意,并在隐私说明里写清。",
    test: function (inp) {
      var all = inp.permissions + " " + inp.description;
      if (!/IDFA|广告标识|广告追踪|追踪用户|跨应用追踪/.test(all)) return { status: "pass", evidence: [] };
      return /征得同意|ATT|Tracking Transparency|授权后|用户同意后/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["提到广告标识或追踪,但没写征得用户同意"] };
    }
  },
  {
    id: "C6", cat: "隐私与权限", title: "第三方共享数据要披露",
    guideline: "5.1.2(i)", fix: "用到第三方 SDK、广告、数据分析,就要在隐私政策里写清共享给谁、共享什么、用来干什么,并取得用户明确同意。",
    test: function (inp) {
      var all = inp.permissions + " " + inp.description;
      if (!/第三方|SDK|广告商|数据分析|统计分析/.test(all)) return { status: "pass", evidence: [] };
      return /共享|披露|说明|隐私政策/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["提到第三方或数据分析,但没写数据共享的披露"] };
    }
  },
  {
    id: "C7", cat: "隐私与权限", title: "不强制登录才能用",
    guideline: "5.1.1(v)", fix: "核心功能与账号无关就别强制登录,至少提供游客模式;强制登录会被打回。",
    test: function (inp) {
      var all = inp.description + " " + inp.permissions;
      if (!/必须登录|注册后才能使用|登录后才能使用|不登录无法使用/.test(all)) return { status: "pass", evidence: [] };
      return /游客|免登录|无需登录/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: snippets(all, /必须登录|注册后才能使用|登录后才能使用|不登录无法使用/g) };
    }
  },
  {
    id: "C8", cat: "隐私与权限", title: "面向儿童不含第三方广告与分析",
    guideline: "1.3、5.1.4(a)", fix: "面向儿童的 App 别接第三方广告和分析,儿童类 App 收集数据还有 COPPA 等额外法律要求。",
    test: function (inp) {
      var all = inp.description + " " + inp.permissions;
      if (!/儿童|孩子|少儿|Kids|未成年/.test(all)) return { status: "pass", evidence: [] };
      var ev = snippets(all, /第三方广告|广告|第三方分析|第三方统计/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "C9", cat: "隐私与权限", title: "有账号就要在 App 内提供注销入口",
    guideline: "5.1.1(v)", fix: "支持注册就要在 App 内提供注销并删除账号的入口,光在网页上提供注销不够。",
    test: function (inp) {
      var all = inp.description + " " + inp.permissions;
      if (!/注册|创建账号|账号/.test(all)) return { status: "pass", evidence: [] };
      return /注销|删除账号|注销账号/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["提到账号或注册,但没写 App 内注销入口"] };
    }
  },
  // ---- D. 内容与设计(1.x、4.2、5.2) ----
  {
    id: "D1", cat: "内容与设计", title: "不提供第三方平台内容下载",
    guideline: "5.2.3", fix: "删掉下载 YouTube、抖音、B 站视频、视频解析、去水印下载这类功能,未经授权保存第三方媒体会被打回。",
    test: function (inp) {
      var all = inp.description + " " + inp.subtitle;
      var ev = snippets(all, /下载.*(YouTube|抖音|快手|B站|哔哩|音乐|视频)|视频解析|去水印.*下载|保存.*(Instagram|TikTok).*视频/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "D2", cat: "内容与设计", title: "不只是网站套壳",
    guideline: "4.2", fix: "App 要有超出网页的原生功能与体验,只套个网站壳会被以功能不足打回,至少补上原生交互或离线能力。",
    test: function (inp) {
      var ev = snippets(inp.description, /网页版|官网版|套壳|仅展示网站|打开网站|套个壳/g);
      return ev.length ? { status: "warn", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "D3", cat: "内容与设计", title: "不借用他人商标与苹果背书",
    guideline: "5.2.1、5.2.4(a)", fix: "删掉微信官方、抖音正版、ChatGPT 合作、Apple 推荐这类说法,没授权别蹭商标,更别暗示苹果为你背书。",
    test: function (inp) {
      var all = inp.name + " " + inp.subtitle + " " + inp.description;
      var ev = snippets(all, /(微信|抖音|ChatGPT|支付宝|淘宝|京东)(官方|正版|合作|授权)|Apple.*(推荐|代言|认可|官方合作)/g);
      return ev.length ? { status: "warn", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "D4", cat: "内容与设计", title: "不含低俗、赌博等违规内容",
    guideline: "1.1", fix: "删掉色情、约炮、裸聊、赌博、博彩相关内容与功能,这类内容直接出局。",
    test: function (inp) {
      var all = inp.description + " " + inp.subtitle;
      var ev = snippets(all, /色情|约炮|一夜情|裸聊|赌博|博彩/g);
      return ev.length ? { status: "fail", evidence: ev } : { status: "pass", evidence: [] };
    }
  },
  {
    id: "D5", cat: "内容与设计", title: "用户发内容要有过滤、举报、拉黑",
    guideline: "1.2", fix: "带发帖、聊天、评论、社区功能就要补齐四件套:过滤违规内容、举报入口、拉黑用户、公开联系方式,缺了会被打回。",
    test: function (inp) {
      var all = inp.description + " " + inp.permissions;
      if (!/用户发布|发帖|聊天|交友|社区|评论/.test(all)) return { status: "pass", evidence: [] };
      return /举报|拉黑|屏蔽|审核|过滤/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["提到用户发内容或社交功能,但没写过滤、举报、拉黑机制"] };
    }
  },
  {
    id: "D6", cat: "内容与设计", title: "描述或权限说明里留了联系方式",
    guideline: "1.5", fix: "在描述或 App 内留一个能联系到你的方式(邮箱、客服),用户找不到你,审核也会找你麻烦。",
    test: function (inp) {
      var all = inp.description + " " + inp.permissions;
      if (/[\w.]+@[\w.]+/.test(all)) return { status: "pass", evidence: [] };
      return /联系|客服|支持|反馈/.test(all)
        ? { status: "pass", evidence: [] }
        : { status: "warn", evidence: ["没找到邮箱或联系、客服、支持等表述"] };
    }
  }
];

// 需人工核对的项:静态页判断不了,只列清单、不给结论。
var HUMAN_CHECKS = [
  { id: "H1", title: "真机测试无崩溃、无明显 bug", guideline: "2.1", note: "在真机上把核心流程完整走一遍,崩溃是最常见的打回原因。" },
  { id: "H2", title: "已准备演示账号,后端服务在线", guideline: "2.1(a)", note: "带登录的 App 必须给审核提供演示账号,后端要在审核期间保持在线。" },
  { id: "H3", title: "内购商品在 App 内可见、可购买", guideline: "2.1(b)", note: "每个内购项都要能在 App 里找到并完成购买,找不到的要在审核备注里解释。" },
  { id: "H4", title: "截图展示 App 实际使用界面", guideline: "2.3.3", note: "别只放标题图、登录页、启动页,截图要展示 App 在用起来的样子。" },
  { id: "H5", title: "预览视频为真实录屏", guideline: "2.3.4", note: "预览只能用 App 本身的录屏,可以加旁白和文字说明。" },
  { id: "H6", title: "年龄分级如实填写", guideline: "2.3.6", note: "按 App Store Connect 里的分级问卷如实作答,错填会触发监管问询。" },
  { id: "H7", title: "隐私标签与实际收集一致,含全部第三方 SDK", guideline: "5.1.1", note: "隐私标签要与运行时实际行为一致,包括每一个第三方 SDK,这是近年最常见的打回原因。" },
  { id: "H8", title: "App 内提供恢复购买入口", guideline: "3.1.1", note: "非消耗型内购与自动续订须有恢复购买入口。" },
  { id: "H9", title: "账号注销入口在 App 内", guideline: "5.1.1(v)", note: "支持注册就要在 App 内提供注销并删除账号的入口。" },
  { id: "H10", title: "用户生成内容有过滤、举报、拉黑与联系方式", guideline: "1.2", note: "带 UGC 功能的 App 四件套缺一不可。" },
  { id: "H11", title: "联系方式在 App 与支持网址中可找到", guideline: "1.5", note: "App 内与支持网址都要有能联系到你的方式。" }
];

function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

function runChecks(raw) {
  var inp = {
    name: norm(raw.name).trim(),
    subtitle: norm(raw.subtitle).trim(),
    description: norm(raw.description).trim(),
    subscription: norm(raw.subscription).trim(),
    permissions: norm(raw.permissions).trim(),
    privacyUrl: norm(raw.privacyUrl).trim()
  };
  var checks = RULES.map(function (r) {
    var res = r.test(inp);
    return {
      id: r.id, cat: r.cat, title: r.title, guideline: r.guideline,
      status: res.status, evidence: res.evidence || [], fix: r.fix
    };
  });
  var fails = checks.filter(function (c) { return c.status === "fail"; }).length;
  var warns = checks.filter(function (c) { return c.status === "warn"; }).length;
  var passes = checks.length - fails - warns;
  var score = Math.max(0, 100 - fails * 10 - warns * 4);
  var permFound = [];
  var permRe = /相册|相机|麦克风|位置|通讯录|通知|照片|语音|健康|运动|日历|提醒事项|蓝牙|本地网络/g;
  var m;
  while ((m = permRe.exec(inp.permissions)) !== null) {
    if (permFound.indexOf(m[0]) === -1) permFound.push(m[0]);
  }
  return {
    input: inp,
    checks: checks,
    score: score,
    grade: gradeFor(score),
    counts: { total: checks.length, pass: passes, warn: warns, fail: fails },
    metrics: {
      nameLength: inp.name.length,
      descLength: inp.description.length,
      pricesInDesc: extractPrices(inp.description),
      pricesInSub: extractPrices(inp.subscription),
      permissionsFound: permFound
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runChecks: runChecks, RULES: RULES, HUMAN_CHECKS: HUMAN_CHECKS, gradeFor: gradeFor };
}
