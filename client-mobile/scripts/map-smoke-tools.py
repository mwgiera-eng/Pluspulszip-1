#!/usr/bin/env python3
"""Dependency-free UI and PNG assertions for the Android map smoke test."""

from __future__ import annotations

import argparse
import math
import re
import struct
import sys
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    left_distance = abs(estimate - left)
    above_distance = abs(estimate - above)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= above_distance and left_distance <= upper_left_distance:
        return left
    if above_distance <= upper_left_distance:
        return above
    return upper_left


def read_png(path: Path) -> tuple[int, int, int, list[bytes]]:
    raw = path.read_bytes()
    if not raw.startswith(PNG_SIGNATURE):
        raise ValueError(f"{path} is not a PNG screenshot")

    offset = len(PNG_SIGNATURE)
    width = height = color_type = bit_depth = interlace = None
    compressed = bytearray()
    while offset + 12 <= len(raw):
        length = struct.unpack(">I", raw[offset : offset + 4])[0]
        chunk_type = raw[offset + 4 : offset + 8]
        chunk = raw[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
        elif chunk_type == b"IDAT":
            compressed.extend(chunk)
        elif chunk_type == b"IEND":
            break

    if None in (width, height, bit_depth, color_type, interlace):
        raise ValueError("PNG is missing IHDR")
    if bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
        raise ValueError(f"unsupported screenshot PNG format: depth={bit_depth}, color={color_type}, interlace={interlace}")

    channels = 3 if color_type == 2 else 4
    stride = width * channels
    decoded = zlib.decompress(bytes(compressed))
    expected = height * (stride + 1)
    if len(decoded) != expected:
        raise ValueError(f"unexpected PNG data length: {len(decoded)} != {expected}")

    rows: list[bytes] = []
    previous = bytearray(stride)
    cursor = 0
    for _ in range(height):
        filter_type = decoded[cursor]
        source = decoded[cursor + 1 : cursor + 1 + stride]
        cursor += stride + 1
        row = bytearray(stride)
        for index, value in enumerate(source):
            left = row[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                prediction = 0
            elif filter_type == 1:
                prediction = left
            elif filter_type == 2:
                prediction = above
            elif filter_type == 3:
                prediction = (left + above) // 2
            elif filter_type == 4:
                prediction = paeth(left, above, upper_left)
            else:
                raise ValueError(f"unsupported PNG filter {filter_type}")
            row[index] = (value + prediction) & 0xFF
        rows.append(bytes(row))
        previous = row
    return width, height, channels, rows


def crop_pixels(image: tuple[int, int, int, list[bytes]]) -> list[tuple[int, int, int]]:
    width, height, channels, rows = image
    left, right = int(width * 0.06), int(width * 0.94)
    top, bottom = int(height * 0.18), int(height * 0.72)
    pixels: list[tuple[int, int, int]] = []
    for row in rows[top:bottom]:
        for x in range(left, right):
            offset = x * channels
            pixels.append((row[offset], row[offset + 1], row[offset + 2]))
    if not pixels:
        raise ValueError("map screenshot crop is empty")
    return pixels


def analyze(path: Path, min_mean: float, max_mean: float, min_stdev: float, min_bins: int, min_textured_blocks: float) -> None:
    image = read_png(path)
    pixels = crop_pixels(image)
    luminance = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
    mean = sum(luminance) / len(luminance)
    variance = sum((value - mean) ** 2 for value in luminance) / len(luminance)
    stdev = math.sqrt(variance)
    color_bins = len({(red // 16, green // 16, blue // 16) for red, green, blue in pixels})
    width, height, channels, rows = image
    left, right = int(width * 0.06), int(width * 0.94)
    top, bottom = int(height * 0.18), int(height * 0.72)
    textured_blocks = 0
    total_blocks = 0
    for row_index in range(6):
        block_top = top + ((bottom - top) * row_index) // 6
        block_bottom = top + ((bottom - top) * (row_index + 1)) // 6
        for column_index in range(6):
            block_left = left + ((right - left) * column_index) // 6
            block_right = left + ((right - left) * (column_index + 1)) // 6
            block_luminance = []
            for row in rows[block_top:block_bottom]:
                for x in range(block_left, block_right):
                    offset = x * channels
                    block_luminance.append(0.2126 * row[offset] + 0.7152 * row[offset + 1] + 0.0722 * row[offset + 2])
            block_mean = sum(block_luminance) / len(block_luminance)
            block_variance = sum((value - block_mean) ** 2 for value in block_luminance) / len(block_luminance)
            if 45 <= block_mean <= 245 and math.sqrt(block_variance) >= 4:
                textured_blocks += 1
            total_blocks += 1
    textured_ratio = textured_blocks / total_blocks
    print(
        f"map pixels: mean={mean:.2f}, stdev={stdev:.2f}, color_bins={color_bins}, "
        f"textured_blocks={textured_blocks}/{total_blocks}"
    )
    if not min_mean <= mean <= max_mean:
        raise AssertionError(f"map brightness {mean:.2f} is outside [{min_mean}, {max_mean}]")
    if stdev < min_stdev:
        raise AssertionError(f"map contrast {stdev:.2f} is below {min_stdev}")
    if color_bins < min_bins:
        raise AssertionError(f"map color diversity {color_bins} is below {min_bins}")
    if textured_ratio < min_textured_blocks:
        raise AssertionError(
            f"map textured-block ratio {textured_ratio:.2%} is below {min_textured_blocks:.2%}; tiles may be blank or clipped"
        )


def compare(base_path: Path, overlay_path: Path, minimum_ratio: float) -> None:
    base_image = read_png(base_path)
    overlay_image = read_png(overlay_path)
    if base_image[:2] != overlay_image[:2]:
        raise AssertionError("screenshots have different dimensions")
    base = crop_pixels(base_image)
    overlay = crop_pixels(overlay_image)
    changed = sum(
        1
        for first, second in zip(base, overlay)
        if sum(abs(left - right) for left, right in zip(first, second)) >= 36
    )
    ratio = changed / len(base)
    print(f"overlay pixels changed={changed}/{len(base)} ({ratio:.5%})")
    if ratio < minimum_ratio:
        raise AssertionError(f"overlay changed ratio {ratio:.5%} is below {minimum_ratio:.5%}")


def assert_stable(first_path: Path, second_path: Path, maximum_ratio: float) -> None:
    first_image = read_png(first_path)
    second_image = read_png(second_path)
    if first_image[:2] != second_image[:2]:
        raise AssertionError("screenshots have different dimensions")
    first = crop_pixels(first_image)
    second = crop_pixels(second_image)
    changed = sum(
        1
        for left_pixel, right_pixel in zip(first, second)
        if sum(abs(left - right) for left, right in zip(left_pixel, right_pixel)) >= 36
    )
    ratio = changed / len(first)
    print(f"stable-map pixels changed={changed}/{len(first)} ({ratio:.5%})")
    if ratio > maximum_ratio:
        raise AssertionError(f"stable-map changed ratio {ratio:.5%} exceeds {maximum_ratio:.5%}")


def parse_color(value: str) -> tuple[int, int, int]:
    normalized = value.removeprefix("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", normalized):
        raise ValueError(f"invalid RGB color: {value}")
    return tuple(int(normalized[index : index + 2], 16) for index in (0, 2, 4))


def color_delta(base_path: Path, overlay_path: Path, colors: list[str], tolerance: int, minimum_delta: int) -> None:
    base_image = read_png(base_path)
    overlay_image = read_png(overlay_path)
    if base_image[:2] != overlay_image[:2]:
        raise AssertionError("screenshots have different dimensions")
    targets = [parse_color(value) for value in colors]

    def count(pixels: list[tuple[int, int, int]]) -> int:
        return sum(
            1
            for pixel in pixels
            if any(max(abs(channel - target_channel) for channel, target_channel in zip(pixel, target)) <= tolerance for target in targets)
        )

    base_count = count(crop_pixels(base_image))
    overlay_count = count(crop_pixels(overlay_image))
    delta = overlay_count - base_count
    print(f"overlay target colors: base={base_count}, overlay={overlay_count}, delta={delta}")
    if delta < minimum_delta:
        raise AssertionError(f"overlay target-color delta {delta} is below {minimum_delta}")


def color_count(path: Path, colors: list[str], tolerance: int, minimum_count: int) -> None:
    targets = [parse_color(value) for value in colors]
    pixels = crop_pixels(read_png(path))
    count = sum(
        1
        for pixel in pixels
        if any(max(abs(channel - target_channel) for channel, target_channel in zip(pixel, target)) <= tolerance for target in targets)
    )
    print(f"target-color pixels={count}")
    if count < minimum_count:
        raise AssertionError(f"target-color pixel count {count} is below {minimum_count}")


def tap_coordinates(xml_path: Path, label: str) -> None:
    root = ET.parse(xml_path).getroot()
    for node in root.iter("node"):
        if node.attrib.get("text") != label and node.attrib.get("content-desc") != label:
            continue
        match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
        if not match:
            continue
        left, top, right, bottom = map(int, match.groups())
        print((left + right) // 2, (top + bottom) // 2)
        return
    raise AssertionError(f"UI label not found: {label}")


def assert_checked(xml_path: Path, label: str, expected: str) -> None:
    root = ET.parse(xml_path).getroot()
    for node in root.iter("node"):
        if node.attrib.get("text") != label and node.attrib.get("content-desc") != label:
            continue
        actual = node.attrib.get("checked", "false")
        if actual != expected:
            raise AssertionError(f"{label} checked={actual}, expected {expected}")
        print(f"{label} checked={actual}")
        return
    raise AssertionError(f"UI label not found: {label}")


def main() -> None:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)

    tap_parser = subcommands.add_parser("tap")
    tap_parser.add_argument("xml", type=Path)
    tap_parser.add_argument("label")

    checked_parser = subcommands.add_parser("checked")
    checked_parser.add_argument("xml", type=Path)
    checked_parser.add_argument("label")
    checked_parser.add_argument("expected", choices=("true", "false"))

    analyze_parser = subcommands.add_parser("analyze")
    analyze_parser.add_argument("png", type=Path)
    analyze_parser.add_argument("--min-mean", type=float, default=55)
    analyze_parser.add_argument("--max-mean", type=float, default=235)
    analyze_parser.add_argument("--min-stdev", type=float, default=12)
    analyze_parser.add_argument("--min-bins", type=int, default=28)
    analyze_parser.add_argument("--min-textured-blocks", type=float, default=0.60)

    compare_parser = subcommands.add_parser("compare")
    compare_parser.add_argument("base", type=Path)
    compare_parser.add_argument("overlay", type=Path)
    compare_parser.add_argument("--min-ratio", type=float, required=True)

    stable_parser = subcommands.add_parser("stable")
    stable_parser.add_argument("first", type=Path)
    stable_parser.add_argument("second", type=Path)
    stable_parser.add_argument("--max-ratio", type=float, default=0.04)

    colors_parser = subcommands.add_parser("colors")
    colors_parser.add_argument("base", type=Path)
    colors_parser.add_argument("overlay", type=Path)
    colors_parser.add_argument("--color", action="append", required=True)
    colors_parser.add_argument("--tolerance", type=int, default=35)
    colors_parser.add_argument("--min-delta", type=int, required=True)

    count_parser = subcommands.add_parser("count-colors")
    count_parser.add_argument("png", type=Path)
    count_parser.add_argument("--color", action="append", required=True)
    count_parser.add_argument("--tolerance", type=int, default=35)
    count_parser.add_argument("--min-count", type=int, required=True)

    args = parser.parse_args()
    if args.command == "tap":
        tap_coordinates(args.xml, args.label)
    elif args.command == "checked":
        assert_checked(args.xml, args.label, args.expected)
    elif args.command == "analyze":
        analyze(args.png, args.min_mean, args.max_mean, args.min_stdev, args.min_bins, args.min_textured_blocks)
    elif args.command == "compare":
        compare(args.base, args.overlay, args.min_ratio)
    elif args.command == "stable":
        assert_stable(args.first, args.second, args.max_ratio)
    elif args.command == "colors":
        color_delta(args.base, args.overlay, args.color, args.tolerance, args.min_delta)
    elif args.command == "count-colors":
        color_count(args.png, args.color, args.tolerance, args.min_count)


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, ET.ParseError, ValueError, zlib.error) as error:
        print(f"map smoke assertion failed: {error}", file=sys.stderr)
        raise SystemExit(1)
