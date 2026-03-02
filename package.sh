#!/usr/bin/env bash
# Packages the extension into a clean .zip for distribution or Chrome Web Store upload.
# Only includes files referenced by manifest.json — no dev files, examples, or docs.
#
# Usage: bash package.sh

set -e

NAME="skool-transcript-extractor"
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
OUTFILE="${NAME}-v${VERSION}.zip"

# Remove old build if it exists
rm -f "$OUTFILE"

# Zip only the files the extension needs
zip -r "$OUTFILE" \
  manifest.json \
  content.js \
  content.css \
  popup.html \
  popup.js \
  popup.css \
  icons/

echo ""
echo "Packaged: $OUTFILE"
echo "Size: $(du -h "$OUTFILE" | cut -f1)"
echo ""
echo "This zip can be:"
echo "  - Shared with others (they unzip and Load Unpacked)"
echo "  - Uploaded to the Chrome Web Store"
