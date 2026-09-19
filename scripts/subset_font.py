"""Maple Mono CN 子集化 + woff2 转换。

用法：
    python scripts/subset_font.py --src <原始字体路径> [--out-ttf <路径>] [--out-woff2 <路径>]

若不传 `--src`，则只做**已有 TTF → woff2** 的转换（不需要原始全量字体），
这是日常最常用的场景。

缺陷 N2 修复：
- 旧脚本把源字体路径**硬编码为本机绝对路径**
  （`G:/ProgramFiles/Downloads/字体/...`），换机器必然失败。
  现改为命令行参数 / 环境变量，缺失时给出清晰提示。
- 旧脚本不产出 woff2。实测 TTF 5,320,976 B → woff2 1,736,508 B（**省 67%**），
  而该字体是首屏必然加载的资源，因此 woff2 是必需的。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# 仓库内路径（相对本文件定位，避免依赖当前工作目录）
REPO = Path(__file__).resolve().parent.parent
FONT_DIR = REPO / "src" / "assets" / "fonts"
DEFAULT_TTF = FONT_DIR / "MapleMono-CN-Regular.ttf"
DEFAULT_WOFF2 = FONT_DIR / "MapleMono-CN-Regular.woff2"


def build_charset() -> str:
    """构建子集字符集：西文全量 + GB2312（一级汉字+符号）+ 数学符号。"""
    chars: set[str] = set()
    # 西文与基础标点
    for cp in range(0x20, 0x7F):
        chars.add(chr(cp))
    # Latin-1 补充（含 × ÷ ½ 等）
    for cp in range(0xA0, 0x100):
        chars.add(chr(cp))
    # 通用标点 / 货币 / 类字母 / 箭头 / 数学运算符 / 几何 / CJK 标点
    for lo, hi in [
        (0x2000, 0x2070),
        (0x20A0, 0x20CF),
        (0x2100, 0x214F),
        (0x2190, 0x2200),
        (0x2200, 0x2300),
        (0x25A0, 0x25FF),
        (0x3000, 0x3040),
    ]:
        for cp in range(lo, hi):
            chars.add(chr(cp))
    # GB2312 符号区 + 汉字区
    for b1 in range(0xA1, 0xF8):
        for b2 in range(0xA1, 0xFF):
            try:
                chars.add(bytes([b1, b2]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return "".join(sorted(chars))


def subset(src: Path, out_ttf: Path) -> None:
    """从原始字体生成子集 TTF。

    字符集清单写入**临时文件**而非仓库（清理冗余：该清单由 `build_charset()`
    完全确定性地生成，提交进仓库属可再生产物，且 24 KB 的清单并无独立价值）。
    """
    out_ttf.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", suffix=".txt", encoding="utf-8", delete=False
    ) as fh:
        chars_file = Path(fh.name)
        fh.write(build_charset())
    try:
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", str(src),
                f"--text-file={chars_file}",
                f"--output-file={out_ttf}",
                "--layout-features=*",
                "--name-IDs=*",
                "--name-legacy",
                "--notdef-outline",
                "--recommended-glyphs",
            ],
            check=True,
        )
    finally:
        chars_file.unlink(missing_ok=True)
    print(f"TTF   -> {out_ttf} ({out_ttf.stat().st_size / 1e6:.2f} MB)")


def to_woff2(src_ttf: Path, out_woff2: Path) -> None:
    """把（已子集化的）TTF 转成 woff2。

    注意 `--unicodes=*`：不加它 fontTools 会按空字符集子集化，
    产物只有几百字节（实测踩过该坑）。
    """
    out_woff2.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(src_ttf),
            "--flavor=woff2",
            "--unicodes=*",
            "--layout-features=*",
            f"--output-file={out_woff2}",
        ],
        check=True,
    )
    before = src_ttf.stat().st_size
    after = out_woff2.stat().st_size
    print(
        f"woff2 -> {out_woff2} ({after / 1e6:.2f} MB, "
        f"省 {(1 - after / before) * 100:.1f}%)"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Maple Mono CN 子集化 / woff2 转换")
    ap.add_argument(
        "--src",
        type=Path,
        default=os.environ.get("MAPLE_MONO_SRC"),
        help="原始全量字体路径（也可用环境变量 MAPLE_MONO_SRC）。"
             "省略时只做 TTF → woff2 转换。",
    )
    ap.add_argument("--out-ttf", type=Path, default=DEFAULT_TTF)
    ap.add_argument("--out-woff2", type=Path, default=DEFAULT_WOFF2)
    args = ap.parse_args()

    if args.src is not None:
        src = Path(args.src)
        if not src.exists():
            print(f"错误：找不到原始字体 {src}", file=sys.stderr)
            print(
                "请用 --src 指定路径，或设置环境变量 MAPLE_MONO_SRC。\n"
                "若只想由现有 TTF 生成 woff2，省略 --src 即可。",
                file=sys.stderr,
            )
            return 2
        subset(src, args.out_ttf)
    elif not args.out_ttf.exists():
        print(f"错误：找不到 {args.out_ttf}，请用 --src 提供原始字体。", file=sys.stderr)
        return 2
    else:
        print(f"跳过子集化，直接转换现有 {args.out_ttf}")

    to_woff2(args.out_ttf, args.out_woff2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
