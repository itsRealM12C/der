#!/usr/bin/env python3
"""Generate a set of small test files (PNG, WAV, MP3 stub, PDF, ZIP, BMP) for browser verification."""
import os
import struct
import zlib
import math

OUT = "/home/z/my-project/download/test-files"
os.makedirs(OUT, exist_ok=True)

# 1. Minimal valid PNG (32x32 red square)
def make_png():
    width, height = 32, 32
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(typ, data):
        c = typ + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += b'\xff\x00\x00'
    idat = zlib.compress(raw)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

with open(f"{OUT}/test.png", "wb") as f:
    f.write(make_png())

# 2. WAV file - 1 second of 440Hz sine wave at 8kHz mono
def make_wav():
    sample_rate = 8000
    duration = 1.0
    freq = 440.0
    n = int(sample_rate * duration)
    samples = []
    for i in range(n):
        v = int(32767 * 0.5 * math.sin(2 * math.pi * freq * i / sample_rate))
        samples.append(struct.pack('<h', v))
    pcm = b''.join(samples)
    data_len = len(pcm)
    header = (
        b'RIFF' + struct.pack('<I', 36 + data_len) + b'WAVE' +
        b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) +
        struct.pack('<H', 1) + struct.pack('<I', sample_rate) +
        struct.pack('<I', sample_rate * 1 * 2) + struct.pack('<H', 2) +
        struct.pack('<H', 16) +
        b'data' + struct.pack('<I', data_len)
    )
    return header + pcm

with open(f"{OUT}/test.wav", "wb") as f:
    f.write(make_wav())

# 3. MP3 stub (ID3 + fake frame)
def make_mp3_stub():
    id3 = b'ID3\x03\x00\x00'
    body = b'\x00' * 100
    size_bytes = bytes([(100 >> 21) & 0x7f, (100 >> 14) & 0x7f, (100 >> 7) & 0x7f, 100 & 0x7f])
    frame_hdr = b'\xff\xfb\x90\x00'
    frame_body = b'\x00' * 100
    return id3 + size_bytes + body + frame_hdr + frame_body

with open(f"{OUT}/test.mp3", "wb") as f:
    f.write(make_mp3_stub())

# 4. Small PDF file
pdf = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF"""
with open(f"{OUT}/test.pdf", "wb") as f:
    f.write(pdf)

# 5. ZIP file (empty)
with open(f"{OUT}/test.zip", "wb") as f:
    f.write(b'PK\x05\x06' + b'\x00' * 18)

# 6. BMP file
def make_bmp():
    width, height = 4, 2
    pixel_data = b''
    for y in range(height):
        for x in range(width):
            pixel_data += b'\x00\xff\x00'
        pixel_data += b'\x00' * ((4 - width*3 % 4) % 4)
    file_size = 14 + 40 + len(pixel_data)
    return (
        b'BM' +
        struct.pack('<I', file_size) +
        b'\x00\x00\x00\x00' +
        struct.pack('<I', 14 + 40) +
        struct.pack('<I', 40) +
        struct.pack('<i', width) +
        struct.pack('<i', height) +
        struct.pack('<H', 1) +
        struct.pack('<H', 24) +
        struct.pack('<I', 0) +
        struct.pack('<I', len(pixel_data)) +
        b'\x00\x00\x00\x00' * 4 +
        pixel_data
    )

with open(f"{OUT}/test.bmp", "wb") as f:
    f.write(make_bmp())

print("Test files created in", OUT)
for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f"  {f}: {os.path.getsize(p)} bytes")
