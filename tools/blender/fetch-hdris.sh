#!/bin/sh
# Download the CC0 studio HDRIs the render scenes use (Poly Haven, ~6 MB each).
cd "$(dirname "$0")" && mkdir -p hdri && cd hdri
for n in studio_small_08 studio_small_09 photo_studio_01 brown_photostudio_02 moonless_golf; do
  [ -f "${n}_2k.hdr" ] || curl -fsSL -o "${n}_2k.hdr" "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${n}_2k.hdr"
done
