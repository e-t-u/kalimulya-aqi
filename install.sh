#!/bin/bash
set -e

UUID="kalimulya-aqi@etu"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Kalimulya AQI GNOME Shell extension..."
mkdir -p "$DEST"
cp -f metadata.json stylesheet.css extension.js "$DEST/"

echo "Installed successfully to $DEST"
echo "Enabling extension..."
gnome-extensions enable "$UUID" 2>/dev/null || true

echo "Done! If you are on X11, press Alt+F2, type 'r', and press Enter."
echo "If on Wayland, log out and log back in (or restart session) if not immediately active."
