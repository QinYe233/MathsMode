"""Maple Mono CN 子集化：西文全量 + GB2312（一级汉字+符号）+ 数学符号。"""
import subprocess, sys
from pathlib import Path

SRC = Path(r"G:/ProgramFiles/Downloads/字体/MapleMonoNormalNL-CN-Regular.ttf")
OUT = Path("src/assets/fonts/MapleMono-CN-Regular.ttf")
OUT.parent.mkdir(parents=True, exist_ok=True)

chars: set[str] = set()
# 西文与基础标点
for cp in range(0x20, 0x7F):
    chars.add(chr(cp))
# Latin-1 补充（含 × ÷ ½ 等）
for cp in range(0xA0, 0x100):
    chars.add(chr(cp))
# 通用标点 / 货币 / 类字母 / 箭头 / 数学运算符 / 几何 / CJK 标点
for lo, hi in [(0x2000, 0x2070), (0x20A0, 0x20CF), (0x2100, 0x214F),
               (0x2190, 0x2200), (0x2200, 0x2300), (0x25A0, 0x25FF),
               (0x3000, 0x3040)]:
    for cp in range(lo, hi):
        chars.add(chr(cp))
# GB2312 符号区 + 汉字区（一级 3755 + 二级常用）
for b1 in range(0xA1, 0xF8):
    for b2 in range(0xA1, 0xFF):
        try:
            chars.add(bytes([b1, b2]).decode("gb2312"))
        except UnicodeDecodeError:
            pass

text = "".join(sorted(chars))
txtf = Path("scripts/font_chars.txt")
txtf.write_text(text, encoding="utf-8")
cmd = [
    sys.executable, "-m", "fontTools.subset", str(SRC),
    f"--text-file={txtf}",
    f"--output-file={OUT}",
    "--layout-features=*",
    "--name-IDs=*",
    "--name-legacy",
    "--notdef-outline",
    "--recommended-glyphs",
]
subprocess.run(cmd, check=True)
print(f"OK -> {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
