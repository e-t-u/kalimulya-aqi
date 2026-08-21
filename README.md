# Kalimulya AQI GNOME Shell Extension

A GNOME Shell extension for GNOME 45+ (including GNOME 46, 47, 48, 49, and 50) that displays live Air Quality Index (AQI) and comprehensive pollutant metrics for **Kalimulya, Depok, West Java, Indonesia** (`-6.425°`, `106.830°`) in the top panel.

## Features

- **Top Bar Indicator**: Displays the current US AQI value with a color-coded status indicator dot.
- **Detailed Popup Card**:
  - Main AQI status card with category (`Good`, `Moderate`, `Unhealthy for Sensitive Groups`, `Unhealthy`, `Very Unhealthy`, `Hazardous`).
  - Actionable health recommendations & outdoor exertion advisories.
- **Pollutant Breakdown (Color-Coded: Green / Orange / Red based on WHO & international guidelines)**:
  - PM2.5 Fine Particulate Matter ($\mu\text{g/m}^3$) — Green $\le 15$, Orange $\le 35$, Red $> 35$
  - PM10 Coarse Particulate Matter ($\mu\text{g/m}^3$) — Green $\le 45$, Orange $\le 100$, Red $> 100$
  - Ozone ($O_3$) ($\mu\text{g/m}^3$) — Green $\le 100$, Orange $\le 160$, Red $> 160$
  - Nitrogen Dioxide ($NO_2$) ($\mu\text{g/m}^3$) — Green $\le 40$, Orange $\le 100$, Red $> 100$
  - Sulphur Dioxide ($SO_2$) ($\mu\text{g/m}^3$) — Green $\le 40$, Orange $\le 100$, Red $> 100$
  - Carbon Monoxide ($CO$) ($\mu\text{g/m}^3$) — Green $\le 4000$, Orange $\le 10000$, Red $> 10000$
  - European AQI (EAQI) — Green $\le 40$, Orange $\le 60$, Red $> 60$
- **Allergy & Pollen Outlook (Weather.com / NAB style)**:
  - Dynamic **Allergy Risk Level** banner (`Low`, `Moderate`, `High`) based on allergen concentration and particulate triggers.
  - 🌳 **Tree Pollen** (Alder, Birch, Olive) severity & grains/m³
  - 🌾 **Grass Pollen** severity & grains/m³
  - 🌿 **Weed Pollen** (Ragweed, Mugwort) severity & grains/m³
  - 🌪️ **Airborne Dust & Particulate Allergens** severity & $\mu\text{g/m}^3$
- **Zero Configuration**: Uses the Open-Meteo Air Quality API with no API key or subscription needed.
- **Auto-Refresh**: Automatically updates every 15 minutes in the background, with a manual "Refresh Now" option in the dropdown.

## Location Coordinates

- **Location**: Kalimulya, Cilodong, Depok, Jawa Barat, Indonesia
- **Latitude**: `-6.425`
- **Longitude**: `106.830`
- **Timezone**: `Asia/Jakarta` (WIB / UTC+7)

## Installation

Run the installation script:

```bash
cd ~/git/kalimulya-aqi
./install.sh
```

Or using `make`:

```bash
cd ~/git/kalimulya-aqi
make install
```

### Enabling the Extension

Enable the extension via `gnome-extensions`:

```bash
gnome-extensions enable kalimulya-aqi@etu
```

> **Note for Wayland / GNOME Shell**:
> If this is the first time installing the extension, restart your GNOME session (log out and log back in) so GNOME Shell discovers the new extension directory in `~/.local/share/gnome-shell/extensions/`. On X11, press `Alt+F2`, type `r`, and press Enter.

## Project Structure

- `metadata.json` — Extension metadata, UUID (`kalimulya-aqi@etu`), and supported GNOME Shell versions (45-50).
- `extension.js` — ESM GNOME Shell extension logic, panel button, popup menu layout, Soup HTTP client, and timer.
- `stylesheet.css` — Custom CSS classes, color themes, badges, and layout rules for the panel and popup.
- `install.sh` / `Makefile` — Build and deployment targets.
