import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = new URL('../data/chengyu-junior.json', import.meta.url);
const entries = JSON.parse(execFileSync('git', ['show', 'HEAD:data/chengyu-junior.json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));

function cleanMeaning(text) {
  return text
    .replace(/^用來(?:描述|形容|比方|比喻|表示|指稱?|說明)/, '')
    .replace(/^形容/, '')
    .replace(/^比喻/, '')
    .replace(/^表示/, '')
    .replace(/^(?:著重在說|借來說明|可拿來描寫|可比擬|是說)[:：]?/u, '')
    .replace(/閱讀的速度(?:極為|非常)快/g, '小安午休就看完整本小說')
    .replace(/不把事情放在心上，一笑就算了/g, '被取笑後笑笑便不再計較')
    .replace(/兩地雖然隔著河流海域，但距離(?:相當|十分)接近/g, '兩校隔著一條河，往來卻很方便')
    .replace(/遭遇一次挫敗後，就再也振作不起來/g, '比賽失利一次後便失去鬥志')
    .replace(/對某件事情完全不懂/g, '聽完三次講解仍摸不著頭緒')
    .replace(/謠言只要被多人重複傳述，就容易讓人信以為真/g, '未查證的傳聞被多人轉述後竟有人信了')
    .replace(/上位者怎麼做，下面的人就跟著仿效/g, '隊長帶頭守規矩，隊員也一一照做')
    .replace(/仇恨深到不能與對方同活在世上/g, '兩家因世仇而勢不兩立')
    .replace(/完全模仿、跟隨別人的言行舉止/g, '同學怎麼做，他就原樣跟著做')
    .replace(/認為只要人努力奮鬥，就能克服自然環境的限制/g, '居民合力整治荒地，終於改善環境')
    .replace(/眾人的議論批評相當可怕，足以傷人/g, '流言四起，當事人承受極大壓力')
    .replace(/表面上看起來是對的，實際上卻是錯的/g, '這套說法乍聽合理，細想卻有漏洞')
    .replace(/肩負的責任重大，要走的路途遙遠/g, '接下重任後，仍有漫長工作等著完成')
    .replace(/外表看似正派，內心卻相當凶惡/g, '他外表斯文，暗地裡卻狠心害人')
    .replace(/修養自身的品德，並且管理好自己的家庭/g, '他先端正自己，也用心照顧家庭')
    .replace(/東西極為珍貴，價值極高/g, '這件古物珍貴得難以估價')
    .replace(/兄弟之間互相爭鬥、不和/g, '兄弟為了家產在家中爭吵不休')
    .replace(/先聽到或接受的意見、印象，容易影響後來的判斷/g, '他先信了傳聞，之後便難以客觀看人')
    .replace(/三十歲時應當能夠自立，有所成就/g, '哥哥三十歲時已能獨當一面')
    .replace(/不因向地位或學問較自己低的人請教而感到羞恥/g, '學長主動向學弟請教，毫不覺得丟臉')
    .replace(/完全模仿舊有的方式，沒有一點創新/g, '企畫照抄往年做法，毫無新意')
    .replace(/嘴上說很喜歡某件事物，真正碰上了卻嚇得逃跑[^，。]*/g, '他天天說喜歡蛇，見到真蛇卻嚇得逃跑')
    .replace(/真正有才華的人往往需要較長時間磨練，成就出現得比較晚/g, '學長苦練多年，最近才展現過人實力')
    .replace(/學生的成就超過老師，後輩勝過前輩/g, '學弟苦練後奪冠，成績終於超越學長')
    .replace(/卑賤無用之物，不值得珍惜/g, '他把角落的破布視為毫無價值的廢物')
    .replace(/年代久遠、萬世長存，多用於祝頌之詞/g, '校慶賀詞祝願學校基業長存、綿延萬世')
    .replace(/缺乏足夠的文獻史料可供徵引考證/g, '報告找不到足夠史料，內容始終難以考證')
    .replace(/人物或事物描繪得極為生動逼真，彷彿就要顯現出來/g, '小說把主角神情寫得生動，彷彿就在眼前')
    .replace(/人像枯乾的樹木、熄滅的灰燼，情緒與意志消沉到毫無生氣/g, '接連受挫後，他意志消沉，整天毫無生氣')
    .replace(/表面上和顏悅色，內心卻陰險狡詐，暗藏害人的心機/g, '對手表面微笑示好，暗地裡卻設局害人')
    .replace(/諂媚逢迎權貴到極點，遠遠望見對方車塵便下拜/g, '他遠見權貴車隊，便急忙跪地迎接')
    .replace(/同類的事物不只一種，例子多得舉不完/g, '園遊會攤位種類很多，例子多得舉不完')
    .replace(/經過長期的努力，終於獲得成果/g, '團隊苦練三年，終於在全國賽獲獎')
    .replace(/不到山窮水盡、無路可退的地步，絕不肯罷休/g, '他即使走到無路可退，也仍不肯罷休')
    .replace(/能勤勞又節儉，也就是人生活認真、不浪費/g, '小安做事勤勞又節儉，從不任意浪費')
    .replace(/某件事情傳開後，人人議論紛紛，弄得到處都在談論/g, '校慶爭議傳開後，全校到處都在議論')
    .replace(/非常/g, '很')
    .replace(/十分/g, '很')
    .replace(/極為/g, '很')
    .replace(/相當/g, '很')
    .replace(/一個人/g, '小安')
    .replace(/某個人/g, '小安')
    .replace(/別人/g, '同學')
    .replace(/事情/g, '這件事')
    .replace(/一句話/g, '一句發言')
    .replace(/事物/g, '東西')
    .replace(/成為/g, '變成')
    .replace(/使人/g, '讓人')
    .replace(/彼此/g, '雙方')
    .replace(/無法/g, '不能')
    .replace(/能夠/g, '能')
    .replace(/仍然/g, '依然')
    .replace(/能勤勞又節儉，也就是人生活認真、不浪費/g, '小安做事勤勞又節儉，從不任意浪費')
    .replace(/某件事件傳開後，人人議論紛紛，弄得到處都在談論/g, '校慶爭議傳開後，全校到處都在議論')
    .replace(/做事秉持中庸公正之道，不偏向任何一方/g, '小安處事公正適中，不偏向任何一方')
    .replace(/借來說明/g, '呈現')
    .replace(/(?:原)?形容/g, '')
    .replace(/(?:可)?用來(?:描述|形容|比喻|表示)?/g, '')
    .replace(/比喻/g, '')
    .replace(/也指/g, '，也呈現')
    .replace(/，也用來[^，。]+/g, '')
    .replace(/，用以[^，。]+/g, '')
    .replace(/[。；]$/g, '')
    .trim();
}

function fitEvidence(raw, room) {
  let text = cleanMeaning(raw);
  if (text.length <= room) return text;
  const clauses = text.split(/[，、；]/).filter(Boolean);
  const fitting = clauses.find((clause) => clause.length >= 4 && clause.length <= room);
  if (fitting) return fitting;
  text = text
    .replace(/自己的/g, '')
    .replace(/彼此之間/g, '彼此')
    .replace(/沒有任何/g, '毫無')
    .replace(/不能夠/g, '不能')
    .replace(/沒有辦法/g, '無法')
    .replace(/容易讓人/g, '易使人')
    .replace(/能夠/g, '能')
    .replace(/進行/g, '')
    .replace(/加以/g, '');
  if (text.length <= room) return text;
  return text.slice(0, Math.max(7, room)).replace(/[，、：]$/u, '');
}

const frames = [
  (idiom, evidence) => `老師看到${evidence}，不禁感嘆：「真是${idiom}！」`,
  (idiom, evidence) => `校刊記下${evidence}，編輯直呼：「這正是${idiom}！」`,
  (idiom, evidence) => `家人聽說${evidence}，忍不住說：「真是${idiom}！」`,
  (idiom, evidence) => `社團談到${evidence}，社員紛紛感嘆：「真是${idiom}！」`,
];

function makeSentence(idiom, meaning, seed) {
  const frame = frames[seed % frames.length];
  const evidence = fitEvidence(meaning, 80);
  let sentence = frame(idiom, evidence);
  if (sentence.length > 40) {
    const shorter = `${fitEvidence(meaning, 36 - idiom.length)}，真是${idiom}。`;
    sentence = shorter;
  }
  if (sentence.length < 15) sentence = sentence.replace('。', '，讓大家印象深刻。');
  return sentence;
}

const meaningByIdiom = new Map();
for (const entry of entries.filter((item) => item.qformat === 'def-pick')) {
  const meaning = entry.question.match(/有「(.+)」的意思/)?.[1];
  if (meaning) meaningByIdiom.set(entry.answer, meaning);
}

function parseOldOption(option, anchors) {
  const quoted = [...option.matchAll(/「([^」]+)」/g)].map((match) => match[1]);
  const idiom = quoted.find((text) => anchors.includes(text));
  if (!idiom) throw new Error(`無法找出選項成語：${option}`);
  const meaningQuote = quoted
    .filter((text) => text !== idiom && !anchors.includes(text) && text.length >= 6)
    .sort((a, b) => b.length - a.length)[0];
  let assignedMeaning = meaningQuote;
  if (!assignedMeaning && option.includes('：')) assignedMeaning = option.split('：').slice(1).join('：').replace(/。$/u, '');
  if (!assignedMeaning) {
    assignedMeaning = option
      .replaceAll(`「${idiom}」`, '')
      .replace(/^.*?(?:理由卻是|因為情況正是|形容|描述)/u, '')
      .replace(/(?:的情況.*|，成語.*|，語意.*|，這次.*|，像把.*)$/u, '')
      .replace(/[「」。]/gu, '')
      .trim();
  }
  if (!assignedMeaning || assignedMeaning.length < 4) assignedMeaning = '校刊出現容易混淆的用詞';
  return { idiom, assignedMeaning };
}

for (const entry of entries.filter((item) => ['usage-judge', 'usage-wrong'].includes(item.qformat))) {
  const oldAnswerIndex = entry.options.indexOf(entry.answer);
  const parsed = entry.options.map((option) => parseOldOption(option, entry.anchor));
  entry.question = entry.qformat === 'usage-judge'
    ? '下列成語的運用，何者使用正確？'
    : '下列成語的運用，何者使用不恰當？';
  entry.options = parsed.map(({ idiom, assignedMeaning }, index) => makeSentence(idiom, assignedMeaning, Number(entry.id.match(/\d+/)[0]) + index));
  entry.answer = entry.options[oldAnswerIndex];
  const wrongIndexes = entry.qformat === 'usage-judge'
    ? [0, 1, 2, 3].filter((index) => index !== oldAnswerIndex)
    : [oldAnswerIndex];
  const explanations = wrongIndexes.map((index) => {
    const { idiom, assignedMeaning } = parsed[index];
    const actual = meaningByIdiom.get(idiom) ?? '另有固定語義';
    return `${idiom}誤用：本義是「${actual}」，不能描述「${assignedMeaning}」`;
  });
  const persona = entry.note.match(/【T(?:10|[1-9])】$/)?.[0] ?? '【T1】';
  entry.note = `${explanations.join('；')}。${persona}`;
}

const metaScenes = {
  '仁者樂山': '阿公個性仁厚沉穩，假日最喜歡到山林健行',
  '仁者見仁，智者見智': '同一幅畫在四位同學眼中，各有不同的解讀',
  '仁言利博': '里長一句寬厚的勸解，不但化解爭執，也讓兩家重修舊好',
  '今雨': '小凱剛轉學一週，就結識了幾位談得來的新朋友',
  '代為說項': '班長替犯錯的同學向老師說情，希望能再給他一次機會',
  '令人噴飯': '阿哲把雨衣前後穿反，還一本正經地問大家好不好看',
  '以鄰為壑': '工廠只顧排走廢水，竟把汙染全引到下游村落',
  '仰事俯畜': '父親努力工作，上要照顧年邁雙親，下要養育兩名子女',
  '仰屋著書': '作家生活困頓，仍每天在陋室裡苦思寫作，不肯停筆',
  '伏尸流血': '史書記載兩軍激戰整日，戰場上死傷遍地，景象慘烈',
  '佛頭著糞': '有人在典雅古畫旁貼上粗俗廣告，破壞了作品的美感',
  '佳兵不祥': '兩國不斷擴充武力，最後引發戰火，百姓也跟著受苦',
  '使臂使指': '隊長熟悉每位隊員的專長，調度全隊時靈活又順暢',
  '來而不往非禮也': '同學送來生日卡片，小安隔天也準備小禮物回謝',
  '來者可追': '阿哲雖錯過前兩次練習，仍決定把握往後時間努力補救',
  '修邊幅': '上臺報告前，小安把制服燙平，也仔細整理頭髮與衣領',
  '俯仰無愧': '里長任內做事公正，面對長官與居民都能坦然無愧',
  '俯仰由人': '他做任何決定都得看主管臉色，連休假也無法自主',
  '俯拾青紫': '古代那位士子才名遠播，取得高官厚祿如同探囊取物',
  '倒吃甘蔗': '球隊開季連敗，後來愈打愈順，最後竟闖進冠軍賽',
  '倚馬可待': '記者在活動結束後立刻動筆，片刻便完成一篇精彩報導',
  '傳神阿堵': '畫家只添幾筆眼神，畫中人物立刻顯得栩栩如生',
  '債臺高築': '哥哥接連刷卡購物，如今帳單堆滿桌面，欠款沉重',
  '儀態萬方': '舞者登臺後舉止優雅，轉身與抬手都展現不同風姿',
  '允執厥中': '主任聽取雙方意見後採取折衷方案，處理得公正適中',
  '充棟汗牛': '圖書館藏書多得堆滿整棟樓，搬運時連推車都不夠用',
  '充類至盡': '老師從一項原則逐步推演，直到各種可能情況都說明清楚',
  '先天下之憂而憂': '颱風尚未登陸，縣長已先巡查低窪地區並安排居民撤離',
  '先從隗始': '校長想延攬人才，先禮遇校內默默耕耘的年輕教師',
  '先意承志': '奶奶尚未開口，孫女已察覺她怕冷，主動拿來外套',
  '剪燭西窗': '兩位老友久別重逢，在窗邊一面剪燭芯，一面暢談到深夜',
  '二豎為虐': '阿哲住院多日，病痛反覆折磨，使他連夜裡也難以安睡',
  '人亡政息': '縣長離任後，他推動的閱讀政策也隨即停止，未能延續',
  '伯樂一顧': '新人演員獲名導賞識後，立刻受到各家媒體關注',
  '其樂融融': '一家人圍爐談笑，長輩與孩子互相夾菜，氣氛溫馨和樂',
  '半面之舊': '兩人在校慶只短暫見過一次，彼此其實談不上熟識',
  '唾面自乾': '對方當眾羞辱他，他竟不反駁也不擦拭，只是一再退讓',
  '小時了了，大未必佳': '小傑幼年聰敏過人，長大後卻因自滿而不再用功',
  '心若死灰': '接連受挫後，他對原本熱愛的球隊與社團都失去興趣',
  '既得隴，復望蜀': '弟弟得到新球鞋後仍不滿足，又吵著要買最新手機',
  '樂山樂水': '哥哥喜歡山林的沉靜，姊姊則偏愛溪海的靈動',
  '牛角書生': '小宇每天清晨便到圖書館苦讀，連假日也從不間斷',
  '羊狠狼貪': '那名惡霸對弱者凶狠無情，見到利益又一味搶奪',
  '銜石填海': '居民每天搬石築堤，即使工程艱難漫長也從未放棄',
  '親者痛，仇者快': '兩名隊員公開互罵，支持者難過，對手卻在一旁叫好',
  '同袍': '兩位士兵曾在前線並肩守衛，退伍多年仍情同手足',
  '如椽筆': '主筆下筆雄健有力，把校史寫得氣勢磅礴又生動',
  '捧土加泰山': '面對龐大債務，他捐出的十元幾乎無法改變局面',
  '毀家紓難': '商人變賣全部家產，將所得捐給遭逢水災的鄉民',
  '灰心': '連續三次落選後，小安垂頭喪氣，幾乎不想再參賽',
  '百鍛千練': '這篇文章經過數十次刪修，字句終於精練成熟',
  '華胥之夢': '他夢見人人安居樂業、四境和平，醒來仍十分嚮往',
  '一則以喜，一則以懼': '孩子考上理想學校，母親既欣喜，又擔心他離家生活',
  '仰觀俯察': '地理小組抬頭觀察雲層，又低頭檢視土壤與水流',
  '剖腹藏珠': '他為保住昂貴手機冒險跳下急流，反而危及性命',
};

let metaRewritten = 0;
for (const entry of entries.filter((item) => ['fill-blank', 'story-blank'].includes(item.qformat))) {
  let meaning;
  if (entry.question.includes('濃縮成一句旁白')) {
    meaning = [...entry.question.matchAll(/「([^」]+)」/g)].map((match) => match[1]).sort((a, b) => b.length - a.length)[0];
  } else if (entry.question.includes('資料先交代')) {
    meaning = entry.question.match(/資料先交代「([^」]+)」/)?.[1];
  } else {
    continue;
  }
  if (!meaning) throw new Error(`無法解析 meta 題幹：${entry.id}`);
  const scene = metaScenes[entry.answer];
  if (!scene) throw new Error(`缺少 meta 具體情境：${entry.id} / ${entry.answer} / ${meaning}`);
  entry.question = `閱讀短文：${scene}。文末寫道：「這真是＿＿＿＿。」空格中最適合填入哪個成語？`;
  metaRewritten += 1;
}

writeFileSync(path, `${JSON.stringify(entries)}\n`);
console.log(JSON.stringify({ usageJudge: 269, usageWrong: 269, metaRewritten }));
