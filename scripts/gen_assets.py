#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字字珠璣 — 酒精潑墨 × Q版1:1國風 美術資產批次生圖
- 生圖工具：codex exec（ChatGPT OAuth，不走 API）
- 雙線並行：LANE=1 / LANE=2 各自乾淨 CODEX_HOME（複製最新 auth.json）
- 機制：Popen + 輪詢 generated_images，圖一出現即抓檔殺程序
- 已存在自動 SKIP；每張上限 RUN_TIMEOUT 秒；落盤驗證 >100KB 才算成功
用法：python3 scripts/gen_assets.py 1   # lane 1
      python3 scripts/gen_assets.py 2   # lane 2
"""
import os, sys, glob, time, shutil, signal, subprocess

LANE = sys.argv[1] if len(sys.argv) > 1 else '1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
CODEX_HOME = os.path.expanduser(f'~/.codex-zzj-lane{LANE}')
GEN = os.path.join(CODEX_HOME, 'generated_images')
WORKDIR = os.path.join(CODEX_HOME, 'work')  # 乾淨 cwd，無 AGENTS.md、無 repo
LOG = os.path.join(ROOT, 'scripts', f'gen_assets_lane{LANE}.log')
DL = os.path.expanduser('~/Downloads/zizizhuji_assets')
RUN_TIMEOUT = 230
MIN_BYTES = 100 * 1024

os.makedirs(ASSETS, exist_ok=True)
os.makedirs(WORKDIR, exist_ok=True)
os.makedirs(DL, exist_ok=True)
# 各 lane 複製最新 auth.json
shutil.copy(os.path.expanduser('~/.codex/auth.json'), os.path.join(CODEX_HOME, 'auth.json'))

STYLE = ("【風格｜最重要】酒精潑墨（alcohol ink art）× 中國國風水墨：鮮豔流動的墨彩暈染、"
         "顏料在宣紙上自然暈開的有機邊緣、大膽的潑濺與飛白，主色為青碧、黛藍、胭脂紅與鎏金，"
         "配溫潤的宣紙米白底，大量留白、構圖透氣。整體像高級的現代水墨藝術海報，"
         "色彩鮮活流動但不髒不濁。alcohol ink splash, flowing vibrant pigment blooms on "
         "rice paper, Chinese ink wash aesthetic, cyan-teal indigo crimson and gold accents, "
         "elegant negative space.")

CHIBI = ("【人物比例｜最重要】Q版1:1頭身比（頭與身體一樣大，約2頭身）的超變形 chibi 公仔感："
         "頭巨大圓潤、身體短小、四肢圓短可愛，像扭蛋公仔。表情生動可愛，大眼睛。"
         "extreme chibi, 1:1 head-to-body ratio, about 2 heads tall, giant round head, "
         "tiny cute body. 人物本身用乾淨細膩的國風插畫線條上色，"
         "但衣袍、髮絲邊緣與腳下要暈染出酒精潑墨的流動墨彩效果，人物與潑墨融為一體。")

NEG = ("【禁止】任何文字、字母、logo、浮水印、簽名；3D渲染、寫實照片、賽博龐克霓虹、"
       "暗黑恐怖、日系賽璐珞動畫風（要國風水墨不要日漫）。")

# (檔名, 尺寸/構圖說明, 主體描述)
ITEMS_LANE1 = [
    ("bg-ink.png",
     "橫式 16:9 landscape（約 1792x1024），作為網站主背景。",
     "一幅純景酒精潑墨山水：遠山如黛以青碧與黛藍暈染、金線勾勒山脊，胭脂紅點染霞光，"
     "下方大片宣紙米白留白（供疊放介面文字），無任何人物與文字。畫面上重下輕、四角柔和。"),
    ("char-player.png",
     "直式 2:3 portrait（約 1024x1536），角色全身居中，背景為乾淨宣紙米白＋角色周圍暈開的潑墨彩雲。",
     "一位 Q 版國風小書生（玩家主角）：漢服青衿長袍、頭戴方巾、手握大毛筆如劍般自信舉起，"
     "眼神明亮鬥志高昂、嘴角上揚，衣袍下擺暈染成青碧鎏金的潑墨。整體陽光聰慧。"),
    ("emblem.png",
     "正方形 1:1（約 1024x1024），居中構圖，背景乾淨宣紙米白。",
     "一枚圓形潑墨印章徽章：胭脂紅印泥質感的圓印，邊緣自然暈開飛白與金箔碎點，"
     "印面中央是一顆發光的珍珠（珠璣意象）被墨紋環繞，無任何文字。"),
    ("icon-mixed.png",
     "正方形 1:1（約 1024x1024），居中單一物件圖示，背景乾淨宣紙米白。",
     "圖示：一個太極般迴旋的雙色墨滴（青碧與胭脂紅交纏），象徵「混合題庫」，"
     "邊緣酒精潑墨暈染、點綴鎏金，簡潔醒目如 app 圖示。"),
]
ITEMS_LANE2 = [
    ("char-rival.png",
     "直式 2:3 portrait（約 1024x1536），角色全身居中，背景為乾淨宣紙米白＋角色周圍暈開的潑墨彩雲。",
     "一位 Q 版國風墨靈少女（對手角色）：水墨化成的精靈，黛藍漸層長髮如流動墨水飄浮，"
     "漢服裙裾暈染胭脂與黛藍潑墨，手中懸浮一顆墨珠，表情俏皮自信帶挑戰意味。神秘靈動。"),
    ("icon-ziyin.png",
     "正方形 1:1（約 1024x1024），居中單一物件圖示，背景乾淨宣紙米白。",
     "圖示：一支國風毛筆筆尖朝下滴落一滴發光的青碧墨滴，墨滴周圍有聲波般的金色漣漪圈"
     "（象徵「字音字形」的讀音），酒精潑墨暈染背景，簡潔醒目如 app 圖示，無文字。"),
    ("icon-chengyu.png",
     "正方形 1:1（約 1024x1024），居中單一物件圖示，背景乾淨宣紙米白。",
     "圖示：一卷微微展開的國風卷軸，卷軸上串著四顆發光珍珠排成一列（四字成語意象），"
     "卷軸兩端暈染胭脂與鎏金潑墨，簡潔醒目如 app 圖示，無任何文字。"),
]
ITEMS = ITEMS_LANE1 if LANE == '1' else ITEMS_LANE2


def build_prompt(fmt, subject, with_chibi):
    parts = ["請生成一張圖片。", f"【格式】{fmt}", STYLE]
    if with_chibi:
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
    line = time.strftime('%H:%M:%S ') + f"[lane{LANE}] " + msg
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
    errlog = open(os.path.join(ROOT, 'scripts', f'gen_assets_lane{LANE}_stderr.log'), 'a')
    p = subprocess.Popen(cmd, cwd=WORKDIR, env=env, stdin=subprocess.PIPE,
                         stdout=errlog, stderr=errlog,
                         start_new_session=True)
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
    log(f"=== lane{LANE} 開始：{len(ITEMS)} 張 ===")
    fails = []
    for (name, fmt, subject) in ITEMS:
        out = os.path.join(ASSETS, name)
        with_chibi = name.startswith('char-')
        ok = gen_one(build_prompt(fmt, subject, with_chibi), out)
        if not ok:
            fails.append(name)
    # 落盤驗證
    log(f"=== lane{LANE} 結束，失敗 {len(fails)} 張: {fails} ===")
    for (name, _, _) in ITEMS:
        out = os.path.join(ASSETS, name)
        st = 'OK' if os.path.exists(out) and os.path.getsize(out) > MIN_BYTES else 'MISSING'
        log(f"verify {name}: {st}")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
