from PIL import Image, ImageDraw
from pathlib import Path

pub = Path(r"D:\NextCloud\Git\MyComponentDatabase\bnab\public")
brand = pub / "brand"


def make_icon(size: int, pad_ratio: float | None = None) -> Image.Image:
    # Small favicons need more dark canvas so they aren't a solid green tile.
    if pad_ratio is None:
        pad_ratio = 0.28 if size <= 32 else 0.16
    img = Image.new("RGBA", (size, size), (9, 10, 12, 255))
    draw = ImageDraw.Draw(img)
    pad = max(1, int(size * pad_ratio))

    # Back sheet
    bx0, by0 = pad + max(1, size // 20), pad + max(2, size // 8)
    bx1, by1 = size - pad - max(1, size // 14), size - pad
    draw.rounded_rectangle(
        [bx0, by0, bx1, by1],
        radius=max(1, size // 18),
        fill=(16, 120, 88, 200),
    )

    # Front sheet (mint) — leave dark ring around it
    fx0, fy0 = pad + max(2, size // 10), pad
    fx1, fy1 = size - pad, size - pad - max(1, size // 12)
    draw.rounded_rectangle(
        [fx0, fy0, fx1, fy1],
        radius=max(1, size // 16),
        fill=(52, 211, 153, 255),
    )

    mid_x = (fx0 + fx1) // 2
    flap_y = fy0 + max(2, int((fy1 - fy0) * 0.42))
    # Dark V flap so silhouette reads at 16px
    draw.line(
        [(fx0 + 1, fy0 + max(1, size // 16)), (mid_x, flap_y)],
        fill=(6, 50, 35, 255),
        width=max(1, size // 18),
    )
    draw.line(
        [(mid_x, flap_y), (fx1 - 1, fy0 + max(1, size // 16))],
        fill=(6, 50, 35, 255),
        width=max(1, size // 18),
    )
    # Light flap fill
    if size >= 32:
        draw.polygon(
            [
                (fx0 + 2, fy0 + 2),
                (fx1 - 2, fy0 + 2),
                (mid_x, flap_y - 1),
            ],
            fill=(255, 255, 255, 50),
        )
    return img


def write_all() -> None:
    specs = [
        ("favicon-16.png", 16, 0.30),
        ("favicon-32.png", 32, 0.26),
        ("apple-touch-icon.png", 180, 0.16),
        ("icon-192.png", 192, 0.16),
        ("icon-512.png", 512, 0.16),
        ("icon-192-maskable.png", 192, 0.22),
        ("icon-512-maskable.png", 512, 0.22),
    ]
    for name, sz, pad in specs:
        make_icon(sz, pad).save(pub / name, optimize=True)
        print("wrote", name)

    make_icon(512, 0.16).save(brand / "icon-master.png", optimize=True)
    make_icon(16, 0.30).save(brand / "favicon-16.png", optimize=True)
    make_icon(32, 0.26).save(brand / "favicon-32.png", optimize=True)

    imgs = [make_icon(s, 0.28 if s <= 32 else 0.2) for s in (16, 32, 48)]
    imgs[0].save(
        pub / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=imgs[1:],
    )
    print("wrote favicon.ico")


if __name__ == "__main__":
    write_all()
