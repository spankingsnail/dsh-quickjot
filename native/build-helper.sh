#!/bin/sh
# Compile only. This script NEVER starts capture or asks for recording permission.
set -eu
NATIVE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SDK=$(xcrun --sdk macosx --show-sdk-path)
ARCH=${RECORDER_ARCH:-$(uname -m)}
case "$ARCH" in arm64|x86_64) ;; *) printf '%s\n' "Unsupported recorder architecture: $ARCH" >&2; exit 1 ;; esac
mkdir -p "$NATIVE_DIR/.build/module-cache"
xcrun --sdk macosx swiftc \
  -swift-version 5 -O -whole-module-optimization \
  -target "$ARCH-apple-macosx15.0" -sdk "$SDK" \
  -module-cache-path "$NATIVE_DIR/.build/module-cache" \
  -framework ScreenCaptureKit -framework AVFoundation -framework CoreMedia -framework AudioToolbox \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$NATIVE_DIR/Recorder-Info.plist" \
  "$NATIVE_DIR/Recorder.swift" -o "$NATIVE_DIR/recorder"
printf '%s\n' "Built $NATIVE_DIR/recorder ($ARCH, macOS 15+) — not started"
