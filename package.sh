#!/usr/bin/env bash
# Packages the extension into a clean .zip for distribution or Chrome Web Store upload.
# Only includes files referenced by manifest.json — no dev files, examples, or docs.
#
# Usage: bash package.sh

set -e

NAME="skool-transcript-extractor"
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
OUTDIR="releases"
OUTFILE="$(pwd)/${OUTDIR}/${NAME}-v${VERSION}.zip"

# Ensure releases directory exists
mkdir -p "$OUTDIR"

# Remove old build if it exists
rm -f "$OUTFILE"

# Stage a clean copy so the zip contains a self-contained folder
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

mkdir "$STAGING/$NAME"
cp manifest.json content.js content.css popup.html popup.js popup.css "$STAGING/$NAME/"
cp -r icons "$STAGING/$NAME/"

# Zip from the staging dir so paths start with skool-transcript-extractor/
(cd "$STAGING" && zip -r "$OUTFILE" "$NAME")

DISPLAY_PATH="${OUTDIR}/${NAME}-v${VERSION}.zip"
echo ""
echo "Packaged: $DISPLAY_PATH"
echo "Size: $(du -h "$OUTFILE" | cut -f1)"
echo ""
echo "This zip can be:"
echo "  - Shared with others (they unzip and Load Unpacked)"
echo "  - Uploaded to the Chrome Web Store"
