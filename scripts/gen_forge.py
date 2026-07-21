#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""融合坊背景圖 fusion-forge-bg：潑墨國風「神獸融合丹爐／爐坊」場景（單張）。
沿用 gen_pets/gen_cubs 產線：codex OAuth、per-image 逾時、落盤驗證、magick 轉 560² web jpg。
用法：python3 scripts/gen_forge.py
"""
import os, glob, time, shutil, signal, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
WEB = os.path.join(ASSETS, 'web')
CODEX_HOME = os.path.expanduser('~/.codex-zzj-cub-lane1')  # 沿用已暖機的 home，避免冷啟動失敗
GEN = os.path.join(CODEX_HOME, 'generated_images')
WORKDIR = os.path.join(CODEX_HOME, 'work')
LOG = os.path.join(ROOT, 'scripts', 'gen_forge.log')
DL = os.path.expanduser('~/Downloads/zizizhuji_assets')
RUN_TIMEOUT = 230
MIN_BYTES = 100 * 1024

for d in (ASSETS, WEB, WORKDIR, DL):
    os.makedirs(d, exist_ok=True)
shutil.copy(os.path.expanduser('~/.codex/auth.json'), os.path.join(CODEX_HOME, 'auth.json'))

STYLE = ("【風格｜最重要】酒精潑墨（alcohol ink art）× 中國國風水墨：鮮豔流動的墨彩暈染、"
         "顏料在宣紙上自然暈開的有機邊緣、大膽的潑濺與飛白，主色為青碧、黛藍、胭脂紅與鎏金，"
         "配溫潤的宣紙米白底，大量留白、構圖透氣。整體像高級的現代水墨藝術海報，色彩鮮活流動但不髒不濁。"
         "alcohol ink splash, flowing vibrant pigment blooms on rice paper, Chinese ink wash aesthetic, "
         "cyan-teal indigo crimson and gold accents, elegant negative space.")

SUBJECT = ("【主體】一座國風「神獸融合丹爐／爐坊」場景：一尊古樸的青銅丹爐居中，爐口升起交纏的雙色靈焰"
           "（青碧與胭脂紅），焰中隱約浮現神獸血脈光紋、爐身有雲雷紋與鎏金裝飾，四周飄散墨彩靈氣與飛白，"
           "神秘、莊重又帶奇幻煉化感。無人物、無神獸主體特寫，是一個場景／背景氛圍圖。")

NEG = ("【禁止】任何文字、字母、logo、浮水印、簽名；3D渲染、寫實照片、賽博龐克霓虹、暗黑恐怖、"
       "日系賽璐珞動畫風（要國風水墨不要日漫）。")

FMT = "正方形 1:1（約 1024x1024），爐坊場景居中，構圖適合當縮圖。"
PROMPT = "\n\n".join(["請生成一張圖片。", f"【格式】{FMT}", STYLE, SUBJECT, NEG])


def newest_mtime():
    return max((os.path.getmtime(f) for f in glob.glob(GEN + '/*/*.png')), default=0.0)


def newest_file():
    files = glob.glob(GEN + '/*/*.png')
    return max(files, key=os.path.getmtime) if files else None


def log(m):
    line = time.strftime('%H:%M:%S ') + '[forge] ' + m
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')


web_jpg = os.path.join(WEB, 'fusion-forge-bg.jpg')
if os.path.exists(web_jpg) and os.path.getsize(web_jpg) > 40 * 1024:
    log('SKIP fusion-forge-bg.jpg 已存在')
    raise SystemExit(0)

before = newest_mtime()
env = dict(os.environ, CODEX_HOME=CODEX_HOME)
cmd = ['codex', 'exec', '--skip-git-repo-check', '-c', 'features.code_mode_host=false', '-']
errlog = open(os.path.join(ROOT, 'scripts', 'gen_forge_stderr.log'), 'a')
p = subprocess.Popen(cmd, cwd=WORKDIR, env=env, stdin=subprocess.PIPE,
                     stdout=errlog, stderr=errlog, start_new_session=True)
try:
    p.stdin.write(PROMPT.encode('utf-8'))
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
    png = os.path.join(ASSETS, 'fusion-forge-bg.png')
    shutil.copy(got, png)
    shutil.copy(got, os.path.join(DL, 'fusion-forge-bg.png'))
    subprocess.run(['magick', png, '-resize', '560x560', '-quality', '82', web_jpg], check=True)
    log(f'OK fusion-forge-bg.jpg (png {os.path.getsize(got)//1024}KB → jpg {os.path.getsize(web_jpg)//1024}KB)')
else:
    log('FAIL（逾時或未產出，可重跑）')
    raise SystemExit(1)
