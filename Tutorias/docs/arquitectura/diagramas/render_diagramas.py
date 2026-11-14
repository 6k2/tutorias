#!/usr/bin/env python3
"""Regenera los dos PNG académicos con Mermaid CLI."""
from pathlib import Path
from shutil import which
from subprocess import run


def main():
    carpeta = Path(__file__).resolve().parent
    ejecutable = which("mmdc.cmd") or which("mmdc")
    if not ejecutable:
        raise SystemExit("Instala Mermaid CLI y agrega mmdc al PATH.")

    for nombre in ("fig2_vpc_base", "fig1_arquitectura"):
        run(
            [ejecutable, "-i", f"{nombre}.mmd", "-o", f"{nombre}.png",
             "-c", "mermaid.json", "-w", "1600", "-s", "2", "-b", "white"],
            cwd=carpeta,
            check=True,
        )


if __name__ == "__main__":
    main()
