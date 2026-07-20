#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字字珠璣 — 神獸融合 6 稚靈立繪 批次生圖（沿用 gen_pets 產線與畫風）
用法：python3 scripts/gen_cubs.py <laneIndex> <laneCount>
      例：2 線 → `gen_cubs.py 1 2` 與 `gen_cubs.py 2 2` 各跑一半
產物：assets/cub-<id>.png（1:1 大圖）→ 自動轉 assets/web/cub-<id>.jpg（560², q82）
已存在（web/jpg >40KB）即 SKIP，可安全重跑補齊。
"""
import os, sys, glob, time, shutil, signal, subprocess

LANE = sys.argv[1] if len(sys.argv) > 1 else '1'
LANE_COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 2
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
WEB = os.path.join(ASSETS, 'web')
CODEX_HOME = os.path.expanduser(f'~/.codex-zzj-cub-lane{LANE}')
GEN = os.path.join(CODEX_HOME, 'generated_images')
WORKDIR = os.path.join(CODEX_HOME, 'work')
LOG = os.path.join(ROOT, 'scripts', f'gen_cubs_lane{LANE}.log')
DL = os.path.expanduser('~/Downloads/zizizhuji_assets')
RUN_TIMEOUT = 230
MIN_BYTES = 100 * 1024        # 原始 png 落盤門檻
WEB_MIN_BYTES = 40 * 1024     # web/jpg 存在判定（SKIP 用）

os.makedirs(ASSETS, exist_ok=True)
os.makedirs(WEB, exist_ok=True)
os.makedirs(WORKDIR, exist_ok=True)
os.makedirs(DL, exist_ok=True)
shutil.copy(os.path.expanduser('~/.codex/auth.json'), os.path.join(CODEX_HOME, 'auth.json'))

STYLE = ("【風格｜最重要】酒精潑墨（alcohol ink art）× 中國國風水墨：鮮豔流動的墨彩暈染、"
         "顏料在宣紙上自然暈開的有機邊緣、大膽的潑濺與飛白，主色為青碧、黛藍、胭脂紅與鎏金，"
         "配溫潤的宣紙米白底，大量留白、構圖透氣。整體像高級的現代水墨藝術海報，色彩鮮活流動但不髒不濁。"
         "alcohol ink splash, flowing vibrant pigment blooms on rice paper, Chinese ink wash aesthetic, "
         "cyan-teal indigo crimson and gold accents, elegant negative space.")

# 稚靈＝比成獸更幼更萌：頭更大、身更圓、眼更水汪汪，像剛出生的神獸寶寶
CHIBI = ("【造型｜最重要】超幼態神獸寶寶（baby cub）Q版1:1頭身比（頭與身體一樣大，約2頭身）："
         "頭巨大圓潤、身體短圓、四肢短短肉肉，水汪汪的大眼睛、天真討喜，像剛破殼／初生的神獸幼崽，比成獸更軟萌。"
         "extreme chibi BABY creature, newborn cub, 1:1 head-to-body ratio, giant round head, tiny plump body, big watery eyes, innocent adorable. "
         "神獸本身用乾淨細膩的國風插畫線條上色，但邊緣、鬃毛、尾羽與腳下要暈染出酒精潑墨的流動墨彩效果，"
         "神獸與潑墨融為一體。單一主體居中，背景乾淨宣紙米白＋角色周圍暈開的潑墨彩雲。")

NEG = ("【禁止】任何文字、字母、logo、浮水印、簽名；3D渲染、寫實照片、賽博龐克霓虹、暗黑恐怖、"
       "日系賽璐珞動畫風（要國風水墨不要日漫）。")

FMT = "正方形 1:1（約 1024x1024），單一幼獸居中全身。"

# (id, 主體描述)
CUBS = [
    ("tiangou", "山海經守夜幼獸「天狗（幼）」：狀如狸貓而雪白頭首的小獸寶寶，圓耳短尾、豎耳仰頭似在吠月辨音，"
                "白首配青碧鎏金身，天真靈動。"),
    ("zhujian", "山海經聽風幼獸「諸犍（幼）」：小豹身軀、擬人化的可愛圓臉（非恐怖人臉，柔化成萌娃臉），"
                "大耳朵豎起專注聆聽、長尾捲起，黛藍胭脂潑墨斑紋，善聽善記的機靈小獸。"),
    ("hundun", "山海經渾沌幼獸「混沌（幼）」：渾圓無五官（無面目）的毛絨絨小圓球神獸，短短四足與一對小翅，"
               "體表流轉青碧鎏金光暈，神秘卻溫暖討喜，像會歌舞的初生混沌之靈（不可陰森恐怖）。"),
    ("xiezhi", "山海經辨正幼獸「獬豸（幼）」：獨角神羊寶寶，額生一支短小獨角、卷卷羊毛、圓蹄短腿，"
               "眼神清正純真，青碧鎏金潑墨，能辨是非的正義小羊獸。"),
    ("zhuyin", "山海經燭龍幼獸「燭陰（幼）」：燭九陰之幼龍寶寶，短圓的中國龍身、大頭小角、圓滾身軀，"
               "一眼明亮如晝一眼柔閉如夜（晝夜雙眼），黛藍鎏金鱗光，周身潑墨如晨昏光暈。"),
    ("jingwei", "山海經填海幼鳥「精衛（幼）」：花腦袋的小神鳥寶寶，圓圓身子短翅膀，嘴裡銜著一根小樹枝或小石子，"
                "胭脂紅與鎏金羽色，堅定又萌，永不言棄的填海小鳥。"),
]

ITEMS = CUBS[int(LANE) - 1::LANE_COUNT]


def build_prompt(subject):
    return "\n\n".join(["請生成一張圖片。", f"【格式】{FMT}", STYLE, CHIBI, f"【主體】{subject}", NEG])


def newest_mtime():
    files = glob.glob(GEN + '/*/*.png')
    return max((os.path.getmtime(f) for f in files), default=0.0)


def newest_file():
    files = glob.glob(GEN + '/*/*.png')
    return max(files, key=os.path.getmtime) if files else None


def log(msg):
    line = time.strftime('%H:%M:%S ') + f"[cubs-lane{LANE}] " + msg
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')


def to_web(png_path, web_jpg):
    subprocess.run(['magick', png_path, '-resize', '560x560', '-quality', '82', web_jpg], check=True)


def gen_one(cub_id, prompt):
    web_jpg = os.path.join(WEB, f'cub-{cub_id}.jpg')
    if os.path.exists(web_jpg) and os.path.getsize(web_jpg) > WEB_MIN_BYTES:
        log(f"SKIP cub-{cub_id}.jpg")
        return True
    out_png = os.path.join(ASSETS, f'cub-{cub_id}.png')
    before = newest_mtime()
    env = dict(os.environ, CODEX_HOME=CODEX_HOME)
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-c', 'features.code_mode_host=false', '-']
    errlog = open(os.path.join(ROOT, 'scripts', f'gen_cubs_lane{LANE}_stderr.log'), 'a')
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
        shutil.copy(got, out_png)
        shutil.copy(got, os.path.join(DL, f'cub-{cub_id}.png'))
        to_web(out_png, web_jpg)
        log(f"OK   cub-{cub_id}.jpg  (png {os.path.getsize(got)//1024}KB → jpg {os.path.getsize(web_jpg)//1024}KB)")
        return True
    log(f"FAIL cub-{cub_id}（逾時或未產出，可重跑補齊）")
    return False


def main():
    log(f"=== cubs lane{LANE} 開始：{len(ITEMS)} 張 ===")
    fails = []
    for (cub_id, subject) in ITEMS:
        if not gen_one(cub_id, build_prompt(subject)):
            fails.append(cub_id)
    log(f"=== cubs lane{LANE} 結束，失敗 {len(fails)} 張: {fails} ===")
    for (cub_id, _) in ITEMS:
        web_jpg = os.path.join(WEB, f'cub-{cub_id}.jpg')
        st = 'OK' if os.path.exists(web_jpg) and os.path.getsize(web_jpg) > WEB_MIN_BYTES else 'MISSING'
        log(f"verify cub-{cub_id}.jpg: {st}")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
