#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字字珠璣 — 山海經寵物 12 獸 + 4 設備圖示 批次生圖（沿用 gen_assets 產線）
用法：python3 scripts/gen_pets.py 1   # lane 1（前 8 張）
      python3 scripts/gen_pets.py 2   # lane 2（後 8 張）
"""
import os, sys, glob, time, shutil, signal, subprocess

LANE = sys.argv[1] if len(sys.argv) > 1 else '1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
CODEX_HOME = os.path.expanduser(f'~/.codex-zzj-lane{LANE}')
GEN = os.path.join(CODEX_HOME, 'generated_images')
WORKDIR = os.path.join(CODEX_HOME, 'work')
LOG = os.path.join(ROOT, 'scripts', f'gen_pets_lane{LANE}.log')
DL = os.path.expanduser('~/Downloads/zizizhuji_assets')
RUN_TIMEOUT = 230
MIN_BYTES = 100 * 1024

os.makedirs(ASSETS, exist_ok=True)
os.makedirs(WORKDIR, exist_ok=True)
os.makedirs(DL, exist_ok=True)
shutil.copy(os.path.expanduser('~/.codex/auth.json'), os.path.join(CODEX_HOME, 'auth.json'))

STYLE = ("【風格｜最重要】酒精潑墨（alcohol ink art）× 中國國風水墨：鮮豔流動的墨彩暈染、"
         "顏料在宣紙上自然暈開的有機邊緣、大膽的潑濺與飛白，主色為青碧、黛藍、胭脂紅與鎏金，"
         "配溫潤的宣紙米白底，大量留白、構圖透氣。整體像高級的現代水墨藝術海報，色彩鮮活流動但不髒不濁。"
         "alcohol ink splash, flowing vibrant pigment blooms on rice paper, Chinese ink wash aesthetic, "
         "cyan-teal indigo crimson and gold accents, elegant negative space.")

CHIBI = ("【造型｜最重要】Q版1:1頭身比（頭與身體一樣大，約2頭身）的超變形 chibi 神獸公仔感："
         "頭巨大圓潤、身體短小、四肢圓短可愛，像扭蛋公仔。表情生動、大眼睛、討喜萌趣。"
         "extreme chibi creature, 1:1 head-to-body ratio, about 2 heads tall, giant round head, tiny cute body. "
         "神獸本身用乾淨細膩的國風插畫線條上色，但邊緣、鬃毛、尾羽與腳下要暈染出酒精潑墨的流動墨彩效果，"
         "神獸與潑墨融為一體。單一主體居中，背景乾淨宣紙米白＋角色周圍暈開的潑墨彩雲。")

NEG = ("【禁止】任何文字、字母、logo、浮水印、簽名；3D渲染、寫實照片、賽博龐克霓虹、暗黑恐怖、"
       "日系賽璐珞動畫風（要國風水墨不要日漫）。")

MON_FMT = "正方形 1:1（約 1024x1024），單一神獸居中全身。"
ICON_FMT = "正方形 1:1（約 1024x1024），居中單一物件圖示，背景乾淨宣紙米白。"

# (檔名, 是否Q版神獸, 尺寸, 主體描述)
MONSTERS = [
    ("pet-baize.png",    "山海經瑞獸「白澤」：獅形祥獸、額生一角、面帶智慧鬍鬚，青碧與鎏金毛色，通曉萬物、祥和睿智。"),
    ("pet-kui.png",      "山海經雷獸「夔」：似牛無角、只有一隻腳，蒼黑帶黛藍身軀，威猛而雷氣環繞。"),
    ("pet-bifang.png",   "山海經火鳥「畢方」：青色羽毛帶紅斑的獨腳神鳥、尖喙圓眼，身周火焰以胭脂紅潑墨暈染。"),
    ("pet-jiuwei.png",   "山海經「九尾狐」：九條蓬鬆尾巴散開的小狐狸，金黃帶白毛色，靈動媚趣、大眼可愛。"),
    ("pet-fenghuang.png","山海經神鳥「鳳凰」：五色錦羽、華麗長尾，胭脂紅與鎏金彩羽，高貴優雅。"),
    ("pet-yinglong.png", "山海經神龍「應龍」：有雙翼的中國龍、鱗身長鬚，黛藍與鎏金，助禹治水的祥龍。"),
    ("pet-taotie.png",   "山海經貪食獸「饕餮」：Q版化成大嘴圓滾滾的萌獸、青銅紋角、獠牙但可愛不兇，青碧金彩。"),
    ("pet-taowu.png",    "山海經兇獸「檮杌」：似虎、人面虎足長尾，Q版萌化收斂兇氣、圓眼獠牙，黛藍胭脂潑墨。"),
    ("pet-qiongqi.png",  "山海經「窮奇」：有雙翼的猛虎/牛神獸、翅膀展開，威武又萌，青碧鎏金潑墨。"),
    ("pet-dangkang.png", "山海經豐年瑞獸「當康」：似小野豬、額生小牙，圓潤討喜、稻穗環繞，暖金與青碧。"),
    ("pet-luwu.png",     "山海經崑崙守神「陸吾」：虎身九尾、人面虎爪的守護神獸，威嚴而萌，黛藍鎏金。"),
    ("pet-kun.png",      "山海經北冥巨魚「鯤」：深黛藍的大魚神獸、化鵬意象，身周水墨波濤與飛白暈染。"),
]
EQUIP = [
    ("pet-equip-wo.png",     "一個精緻的國風靈獸窩巢：竹編／雲紋小窩，暖色調，邊緣潑墨暈染，簡潔如 app 圖示。"),
    ("pet-equip-xirang.png", "一張泛著微光的國風靈符黃符紙、朱砂符文（不可有真實文字，用抽象符紋），土金生機、潑墨暈染。"),
    ("pet-equip-ling.png",   "一枚古銅色的國風靈鈴鐺，青銅質感、繫紅繩流蘇，鎏金點綴、潑墨暈染，簡潔醒目。"),
    ("pet-equip-zhulong.png","一顆發光的龍睛寶珠（燭龍之睛）：紅金光暈的圓珠、墨紋環繞、飛白，如發光法寶。"),
]

LANE1 = [(n, True, MON_FMT, s) for (n, s) in MONSTERS[:8]]
LANE2 = ([(n, True, MON_FMT, s) for (n, s) in MONSTERS[8:]]
         + [(n, False, ICON_FMT, s) for (n, s) in EQUIP])
ITEMS = LANE1 if LANE == '1' else LANE2


def build_prompt(is_creature, fmt, subject):
    parts = ["請生成一張圖片。", f"【格式】{fmt}", STYLE]
    if is_creature:
        parts.append(CHIBI)
    parts.append(f"【主體】{subject}")
    parts.append(NEG)
    return "\n\n".join(parts)


def newest_mtime():
    files = glob.glob(GEN + '/*/*.png')
    return max((os.path.getmtime(f) for f in files), default=0.0)


def newest_file():
    files = glob.glob(GEN + '/*/*.png')
    return max(files, key=os.path.getmtime) if files else None


def log(msg):
    line = time.strftime('%H:%M:%S ') + f"[pets-lane{LANE}] " + msg
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')


def gen_one(prompt, out):
    if os.path.exists(out) and os.path.getsize(out) > MIN_BYTES:
        log(f"SKIP {os.path.basename(out)}")
        return True
    before = newest_mtime()
    env = dict(os.environ, CODEX_HOME=CODEX_HOME)
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-c', 'features.code_mode_host=false', '-']
    errlog = open(os.path.join(ROOT, 'scripts', f'gen_pets_lane{LANE}_stderr.log'), 'a')
    p = subprocess.Popen(cmd, cwd=WORKDIR, env=env, stdin=subprocess.PIPE,
                         stdout=errlog, stderr=errlog, start_new_session=True)
    try:
        p.stdin.write(prompt.encode('utf-8'))
        p.stdin.close()
    except Exception:
        pass
    got = None
    deadline = time.time() + RUN_TIMEOUT
    while time.time() < deadline:
        time.sleep(4)
        nf = newest_file()
        if nf and os.path.getmtime(nf) > before + 0.5:
            time.sleep(3)
            got = newest_file()
            break
        if p.poll() is not None:
            nf = newest_file()
            if nf and os.path.getmtime(nf) > before + 0.5:
                got = nf
            break
    try:
        os.killpg(os.getpgid(p.pid), signal.SIGKILL)
    except Exception:
        pass
    time.sleep(1)
    if got and os.path.getsize(got) > MIN_BYTES:
        shutil.copy(got, out)
        shutil.copy(got, os.path.join(DL, os.path.basename(out)))
        log(f"OK   {os.path.basename(out)}  ({os.path.getsize(got)//1024}KB)")
        return True
    log(f"FAIL {os.path.basename(out)}（逾時或未產出，可重跑補齊）")
    return False


def main():
    log(f"=== pets lane{LANE} 開始：{len(ITEMS)} 張 ===")
    fails = []
    for (name, is_creature, fmt, subject) in ITEMS:
        out = os.path.join(ASSETS, name)
        if not gen_one(build_prompt(is_creature, fmt, subject), out):
            fails.append(name)
    log(f"=== pets lane{LANE} 結束，失敗 {len(fails)} 張: {fails} ===")
    for (name, _, _, _) in ITEMS:
        out = os.path.join(ASSETS, name)
        st = 'OK' if os.path.exists(out) and os.path.getsize(out) > MIN_BYTES else 'MISSING'
        log(f"verify {name}: {st}")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
