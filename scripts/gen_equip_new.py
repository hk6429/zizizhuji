#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字字珠璣 — 4 件高段寵物設備圖示 批次生圖（沿用 gen_pets 產線與酒精潑墨風格）
用法：python3 scripts/gen_equip_new.py <laneIndex> <laneCount>
      例：2 線 → `gen_equip_new.py 1 2` 與 `gen_equip_new.py 2 2`
raw PNG 寫 assets/，生完自動 magick 縮成 assets/web/pet-equip-{id}.jpg（560x560 q82，對齊既有 4 張）。
已存在（web jpg >20KB）即 SKIP，可安全重跑補齊。
"""
import os, sys, glob, time, shutil, signal, subprocess

LANE = sys.argv[1] if len(sys.argv) > 1 else '1'
LANE_COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 2
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
WEB = os.path.join(ASSETS, 'web')
CODEX_HOME = os.path.expanduser(f'~/.codex-zzj-lane{LANE}')
GEN = os.path.join(CODEX_HOME, 'generated_images')
WORKDIR = os.path.join(CODEX_HOME, 'work')
LOG = os.path.join(ROOT, 'scripts', f'gen_equip_lane{LANE}.log')
DL = os.path.expanduser('~/Downloads/zizizhuji_assets')
RUN_TIMEOUT = 230
MIN_BYTES = 100 * 1024
WEB_MIN = 20 * 1024

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
NEG = ("【禁止】任何文字、字母、logo、浮水印、簽名；3D渲染、寫實照片、賽博龐克霓虹、暗黑恐怖、"
       "日系賽璐珞動畫風（要國風水墨不要日漫）。")
ICON_FMT = "正方形 1:1（約 1024x1024），居中單一物件圖示，背景乾淨宣紙米白。"

# (id, 主體描述)
EQUIP = [
    ("panhu",   "一副國風靈獸戰鎧／護體甲片：以五色神犬盤瓠紋樣裝飾的鎧甲，青碧與鎏金甲片層疊、繫紅繩，"
                "邊緣潑墨暈染，威武華貴，簡潔如發光法寶 app 圖示。"),
    ("bifang",  "一把國風火羽扇：以青紅相間的火鳥羽毛（畢方羽）製成的華麗扇面、鎏金扇骨，"
                "扇周胭脂紅火氣以潑墨暈染，靈動高雅，簡潔醒目的圖示。"),
    ("taowu",   "一支發光的兇獸犄角法器（檮杌之角）：黛藍與胭脂色的螺旋獸角、鎏金裂紋流光、飛白墨紋環繞，"
                "凜然而萌，如發光法寶圖示。"),
    ("zhuyin",  "一面國風神幡／招魂幡（燭陰神幡）：繫著流蘇的長條幡旗，幡面繪抽象的龍目與雲紋（不可有真實文字），"
                "黛藍鎏金、幡邊潑墨暈染、微微發光，神祕而華麗的法寶圖示。"),
]
ITEMS = EQUIP[int(LANE) - 1::LANE_COUNT]


def build_prompt(subject):
    return "\n\n".join(["請生成一張圖片。", f"【格式】{ICON_FMT}", STYLE, f"【主體】{subject}", NEG])


def newest_file():
    files = glob.glob(GEN + '/*/*.png')
    return max(files, key=os.path.getmtime) if files else None


def newest_mtime():
    files = glob.glob(GEN + '/*/*.png')
    return max((os.path.getmtime(f) for f in files), default=0.0)


def log(msg):
    line = time.strftime('%H:%M:%S ') + f"[equip-lane{LANE}] " + msg
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')


def to_web(png, web_jpg):
    subprocess.run(['magick', png, '-resize', '560x560^', '-gravity', 'center',
                    '-extent', '560x560', '-quality', '82', web_jpg], check=True)


def gen_one(eid, subject):
    web_jpg = os.path.join(WEB, f'pet-equip-{eid}.jpg')
    if os.path.exists(web_jpg) and os.path.getsize(web_jpg) > WEB_MIN:
        log(f"SKIP pet-equip-{eid}.jpg")
        return True
    out_png = os.path.join(ASSETS, f'pet-equip-{eid}.png')
    before = newest_mtime()
    env = dict(os.environ, CODEX_HOME=CODEX_HOME)
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-c', 'features.code_mode_host=false', '-']
    errlog = open(os.path.join(ROOT, 'scripts', f'gen_equip_lane{LANE}_stderr.log'), 'a')
    p = subprocess.Popen(cmd, cwd=WORKDIR, env=env, stdin=subprocess.PIPE,
                         stdout=errlog, stderr=errlog, start_new_session=True)
    try:
        p.stdin.write(build_prompt(subject).encode('utf-8'))
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
        shutil.copy(got, os.path.join(DL, f'pet-equip-{eid}.png'))
        to_web(out_png, web_jpg)
        log(f"OK   pet-equip-{eid}.jpg  (web {os.path.getsize(web_jpg)//1024}KB)")
        return True
    log(f"FAIL pet-equip-{eid}（逾時或未產出，可重跑補齊）")
    return False


def main():
    log(f"=== equip lane{LANE} 開始：{len(ITEMS)} 張 ===")
    fails = [eid for (eid, s) in ITEMS if not gen_one(eid, s)]
    for (eid, _) in ITEMS:
        web_jpg = os.path.join(WEB, f'pet-equip-{eid}.jpg')
        st = 'OK' if os.path.exists(web_jpg) and os.path.getsize(web_jpg) > WEB_MIN else 'MISSING'
        log(f"verify pet-equip-{eid}.jpg: {st}")
    log(f"=== equip lane{LANE} 結束，失敗 {len(fails)} 張: {fails} ===")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
