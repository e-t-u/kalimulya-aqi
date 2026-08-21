import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Soup from 'gi://Soup';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const LATITUDE = -6.425;
const LONGITUDE = 106.830;
const LOCATION_NAME = 'Kalimulya, Depok';
const LOCATION_SUBTITLE = 'West Java, Indonesia (-6.425°, 106.830°)';
const REFRESH_INTERVAL_SECONDS = 900; // 15 minutes

function getAqiDetails(aqi) {
    if (aqi === null || aqi === undefined || isNaN(aqi)) {
        return {
            category: 'Unknown',
            styleClass: 'aqi-color-unknown',
            advisory: 'No data available.'
        };
    }
    if (aqi <= 50) {
        return {
            category: 'Good',
            styleClass: 'aqi-color-good',
            advisory: 'Air quality is satisfactory. Air pollution poses little or no risk.'
        };
    } else if (aqi <= 100) {
        return {
            category: 'Moderate',
            styleClass: 'aqi-color-moderate',
            advisory: 'Air quality is acceptable. Sensitive individuals should consider limiting prolonged outdoor exertion.'
        };
    } else if (aqi <= 150) {
        return {
            category: 'Unhealthy for Sensitive Groups',
            styleClass: 'aqi-color-sensitive',
            advisory: 'Members of sensitive groups may experience health effects. General public is less likely to be affected.'
        };
    } else if (aqi <= 200) {
        return {
            category: 'Unhealthy',
            styleClass: 'aqi-color-unhealthy',
            advisory: 'Everyone may begin to experience health effects. Sensitive groups should avoid outdoor exertion; others should reduce outdoor activities.'
        };
    } else if (aqi <= 300) {
        return {
            category: 'Very Unhealthy',
            styleClass: 'aqi-color-very-unhealthy',
            advisory: 'Health alert: Increased health risks for everyone. Avoid strenuous outdoor activities and wear a mask.'
        };
    } else {
        return {
            category: 'Hazardous',
            styleClass: 'aqi-color-hazardous',
            advisory: 'Health warning of emergency conditions: Everyone is more likely to be severely affected. Remain indoors.'
        };
    }
}

function getPollutantStatus(type, value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'aqi-val-unknown';
    }

    switch (type) {
    case 'pm2_5':
        // WHO 2021: 15 μg/m³ 24h, EPA: 12.0 Good, 35.4 Moderate
        if (value <= 15) return 'aqi-val-good';
        if (value <= 35) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'pm10':
        // WHO 2021: 45 μg/m³ 24h, EPA: 54 Good, 154 Moderate
        if (value <= 45) return 'aqi-val-good';
        if (value <= 100) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'o3':
        // WHO 2021: 100 μg/m³ 8h, EU: 120 μg/m³ target
        if (value <= 100) return 'aqi-val-good';
        if (value <= 160) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'no2':
        // WHO 2021: 25 μg/m³ 24h, EU: 40 μg/m³ annual
        if (value <= 40) return 'aqi-val-good';
        if (value <= 100) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'so2':
        // WHO 2021: 40 μg/m³ 24h, EPA: 90 μg/m³
        if (value <= 40) return 'aqi-val-good';
        if (value <= 100) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'co':
        // WHO 2021: 4000 μg/m³ 24h, EPA: 10000 μg/m³ 8h
        if (value <= 4000) return 'aqi-val-good';
        if (value <= 10000) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'eaqi':
        // European AQI (0-20 Good, 20-40 Fair, 40-60 Moderate, 60-80 Poor, 80+ Very Poor)
        if (value <= 40) return 'aqi-val-good';
        if (value <= 60) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    case 'us_aqi':
        if (value <= 50) return 'aqi-val-good';
        if (value <= 100) return 'aqi-val-moderate';
        return 'aqi-val-unhealthy';

    default:
        return 'aqi-val-unknown';
    }
}

function getPollenDetails(type, value) {
    // Standard pollen thresholds (NAB / Weather.com allergy scale)
    if (value === null || value === undefined || isNaN(value)) {
        return {
            level: 'Low (0.0)',
            styleClass: 'aqi-val-good',
            severity: 0
        };
    }

    switch (type) {
    case 'tree':
        // Tree pollen (Alder, Birch, Olive): Low <=15, Mod <=89, High >89 grains/m³
        if (value <= 15) return {level: `Low · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-good', severity: 0};
        if (value <= 89) return {level: `Moderate · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-moderate', severity: 1};
        return {level: `High · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-unhealthy', severity: 2};

    case 'grass':
        // Grass pollen: Low <=5, Mod <=20, High >20 grains/m³
        if (value <= 5) return {level: `Low · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-good', severity: 0};
        if (value <= 20) return {level: `Moderate · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-moderate', severity: 1};
        return {level: `High · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-unhealthy', severity: 2};

    case 'weed':
        // Weed / Ragweed pollen: Low <=10, Mod <=49, High >49 grains/m³
        if (value <= 10) return {level: `Low · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-good', severity: 0};
        if (value <= 49) return {level: `Moderate · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-moderate', severity: 1};
        return {level: `High · ${value.toFixed(0)} gr/m³`, styleClass: 'aqi-val-unhealthy', severity: 2};

    case 'dust':
        // Airborne Dust particulate (μg/m³)
        if (value <= 25) return {level: `Low · ${value.toFixed(1)} μg/m³`, styleClass: 'aqi-val-good', severity: 0};
        if (value <= 50) return {level: `Moderate · ${value.toFixed(1)} μg/m³`, styleClass: 'aqi-val-moderate', severity: 1};
        return {level: `High · ${value.toFixed(1)} μg/m³`, styleClass: 'aqi-val-unhealthy', severity: 2};

    default:
        return {level: '--', styleClass: 'aqi-val-unknown', severity: 0};
    }
}

function getAllergyRisk(treeVal, grassVal, weedVal, dustVal, pm25Val) {
    const tree = getPollenDetails('tree', treeVal);
    const grass = getPollenDetails('grass', grassVal);
    const weed = getPollenDetails('weed', weedVal);
    const dust = getPollenDetails('dust', dustVal);

    let maxSev = Math.max(tree.severity, grass.severity, weed.severity, dust.severity);
    if (pm25Val && pm25Val > 35) {
        maxSev = Math.max(maxSev, 1);
    }
    if (pm25Val && pm25Val > 75) {
        maxSev = Math.max(maxSev, 2);
    }

    if (maxSev >= 2) {
        return {
            label: 'Allergy Risk: High',
            styleClass: 'aqi-val-unhealthy',
            cardClass: 'allergy-badge-unhealthy',
        };
    } else if (maxSev === 1) {
        return {
            label: 'Allergy Risk: Moderate',
            styleClass: 'aqi-val-moderate',
            cardClass: 'allergy-badge-moderate',
        };
    } else {
        return {
            label: 'Allergy Risk: Low',
            styleClass: 'aqi-val-good',
            cardClass: 'allergy-badge-good',
        };
    }
}

const KalimulyaAqiIndicator = GObject.registerClass(
class KalimulyaAqiIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Kalimulya AQI Indicator'));
        this._extension = extension;
        this._timeoutId = null;
        this._cancellable = new Gio.Cancellable();
        this._session = new Soup.Session({timeout: 15});

        // Top bar panel button layout
        this._panelBox = new St.BoxLayout({
            style_class: 'aqi-panel-box',
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            track_hover: true,
        });

        this._indicatorDot = new St.Widget({
            style_class: 'aqi-indicator-dot aqi-color-unknown',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._panelLabel = new St.Label({
            text: 'Kalimulya AQI: ...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'aqi-panel-label',
        });

        this._panelBox.add_child(this._indicatorDot);
        this._panelBox.add_child(this._panelLabel);
        this.add_child(this._panelBox);

        this._buildMenu();
        this._fetchAqi();
        this._startTimer();
    }

    _buildMenu() {
        // Container inside popup
        const container = new St.BoxLayout({
            vertical: true,
            style_class: 'aqi-popup-container',
        });

        // Header
        const headerBox = new St.BoxLayout({
            vertical: true,
            style_class: 'aqi-header-box',
        });

        const titleLabel = new St.Label({
            text: LOCATION_NAME,
            style_class: 'aqi-header-title',
        });

        const subtitleLabel = new St.Label({
            text: LOCATION_SUBTITLE,
            style_class: 'aqi-header-subtitle',
        });

        headerBox.add_child(titleLabel);
        headerBox.add_child(subtitleLabel);
        container.add_child(headerBox);

        // Main AQI Card
        this._mainCard = new St.BoxLayout({
            vertical: true,
            style_class: 'aqi-main-card aqi-color-unknown',
        });

        this._aqiValueLabel = new St.Label({
            text: '-- US AQI',
            style_class: 'aqi-main-value',
        });

        this._aqiCategoryLabel = new St.Label({
            text: 'Loading air quality data...',
            style_class: 'aqi-main-category',
        });

        this._aqiAdvisoryLabel = new St.Label({
            text: 'Please wait while fetching live observations.',
            style_class: 'aqi-advisory-text',
        });
        if (this._aqiAdvisoryLabel.clutter_text) {
            this._aqiAdvisoryLabel.clutter_text.line_wrap = true;
            this._aqiAdvisoryLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
        }

        this._mainCard.add_child(this._aqiValueLabel);
        this._mainCard.add_child(this._aqiCategoryLabel);
        this._mainCard.add_child(this._aqiAdvisoryLabel);
        container.add_child(this._mainCard);

        // Pollutants Section Title
        const sectionTitle = new St.Label({
            text: 'Pollutant Breakdown',
            style_class: 'aqi-section-title',
        });
        container.add_child(sectionTitle);

        // Grid for pollutants
        const makePollutantBox = (name) => {
            const box = new St.BoxLayout({
                vertical: true,
                style_class: 'aqi-pollutant-box',
                x_expand: true,
            });
            const nameLbl = new St.Label({
                text: name,
                style_class: 'aqi-pollutant-name',
            });
            const valLbl = new St.Label({
                text: '--',
                style_class: 'aqi-pollutant-val aqi-val-unknown',
            });
            box.add_child(nameLbl);
            box.add_child(valLbl);
            return {box, valLbl};
        };

        // Row 1: PM2.5 & PM10
        const row1 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._pm25 = makePollutantBox('PM2.5 Fine Particles');
        this._pm10 = makePollutantBox('PM10 Coarse Dust');
        row1.add_child(this._pm25.box);
        row1.add_child(this._pm10.box);
        container.add_child(row1);

        // Row 2: Ozone & NO2
        const row2 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._o3 = makePollutantBox('Ozone (O₃)');
        this._no2 = makePollutantBox('Nitrogen Dioxide (NO₂)');
        row2.add_child(this._o3.box);
        row2.add_child(this._no2.box);
        container.add_child(row2);

        // Row 3: SO2 & CO
        const row3 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._so2 = makePollutantBox('Sulphur Dioxide (SO₂)');
        this._co = makePollutantBox('Carbon Monoxide (CO)');
        row3.add_child(this._so2.box);
        row3.add_child(this._co.box);
        container.add_child(row3);

        // Row 4: European AQI
        const row4 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._eaqi = makePollutantBox('European AQI');
        row4.add_child(this._eaqi.box);
        container.add_child(row4);

        // Allergy & Pollen Forecast Section (Weather.com style)
        const pollenSectionTitle = new St.Label({
            text: 'Allergy & Pollen Outlook',
            style_class: 'aqi-section-title',
        });
        container.add_child(pollenSectionTitle);

        this._allergyRiskCard = new St.BoxLayout({
            vertical: false,
            style_class: 'aqi-allergy-card allergy-badge-good',
        });
        this._allergyRiskLabel = new St.Label({
            text: 'Allergy Risk: Low',
            style_class: 'aqi-allergy-risk-title aqi-val-good',
        });
        this._allergyRiskCard.add_child(this._allergyRiskLabel);
        container.add_child(this._allergyRiskCard);

        // Pollen Row 1: Tree & Grass
        const pRow1 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._treePollen = makePollutantBox('🌳 Tree Pollen');
        this._grassPollen = makePollutantBox('🌾 Grass Pollen');
        pRow1.add_child(this._treePollen.box);
        pRow1.add_child(this._grassPollen.box);
        container.add_child(pRow1);

        // Pollen Row 2: Weed & Dust
        const pRow2 = new St.BoxLayout({style_class: 'aqi-grid-row'});
        this._weedPollen = makePollutantBox('🌿 Weed Pollen');
        this._dustAllergen = makePollutantBox('🌪️ Airborne Dust');
        pRow2.add_child(this._weedPollen.box);
        pRow2.add_child(this._dustAllergen.box);
        container.add_child(pRow2);

        // Footer / Timestamp
        this._updatedLabel = new St.Label({
            text: 'Last updated: Never',
            style_class: 'aqi-footer-label',
            x_align: Clutter.ActorAlign.CENTER,
        });
        container.add_child(this._updatedLabel);

        const customMenuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        customMenuItem.add_child(container);
        this.menu.addMenuItem(customMenuItem);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Refresh action
        const refreshItem = new PopupMenu.PopupImageMenuItem(
            _('Refresh Now'),
            'view-refresh-symbolic'
        );
        refreshItem.connect('activate', () => {
            this._fetchAqi();
        });
        this.menu.addMenuItem(refreshItem);

        // Web detail action
        const openWebItem = new PopupMenu.PopupImageMenuItem(
            _('Open Air Quality Forecast'),
            'web-browser-symbolic'
        );
        openWebItem.connect('activate', () => {
            const url = `https://open-meteo.com/en/docs/air-quality-api#latitude=-6.425&longitude=106.83&hourly=pm2_5,pm10,us_aqi`;
            try {
                Gio.AppInfo.launch_default_for_uri(url, null);
            } catch (e) {
                console.error(`[Kalimulya AQI] Failed to open URL: ${e}`);
            }
        });
        this.menu.addMenuItem(openWebItem);
    }

    _startTimer() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL_SECONDS,
            () => {
                this._fetchAqi();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    async _fetchAqi() {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,european_aqi,dust,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=Asia%2FJakarta`;

        this._panelLabel.set_text('Kalimulya AQI: ...');

        try {
            const message = Soup.Message.new('GET', url);
            message.request_headers.append('User-Agent', 'GNOME-Shell-Kalimulya-AQI/1.0');

            const bytes = await this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                this._cancellable
            );

            if (message.status_code !== 200) {
                throw new Error(`HTTP ${message.status_code}: ${message.reason_phrase}`);
            }

            const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            this._updateUI(data);
        } catch (error) {
            if (this._cancellable && this._cancellable.is_cancelled()) {
                return;
            }
            console.error(`[Kalimulya AQI] Error fetching data: ${error.message}`);
            this._panelLabel.set_text('Kalimulya AQI: Err');
            this._indicatorDot.style_class = 'aqi-indicator-dot aqi-color-unknown';
            this._aqiCategoryLabel.set_text('Failed to fetch data');
            this._aqiAdvisoryLabel.set_text(`Network error: ${error.message}`);
            this._pm25.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._pm10.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._o3.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._no2.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._so2.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._co.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._eaqi.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._treePollen.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._grassPollen.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._weedPollen.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._dustAllergen.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
            this._allergyRiskLabel.set_text('Allergy Risk: Unknown');
            this._allergyRiskLabel.style_class = 'aqi-allergy-risk-title aqi-val-unknown';
            this._allergyRiskCard.style_class = 'aqi-allergy-card';
        }
    }

    _updateUI(data) {
        if (!data || !data.current) {
            this._panelLabel.set_text('Kalimulya AQI: N/A');
            return;
        }

        const cur = data.current;
        const usAqi = cur.us_aqi !== undefined ? Math.round(cur.us_aqi) : null;
        const details = getAqiDetails(usAqi);

        // Update Top Bar
        this._panelLabel.set_text(`Kalimulya AQI: ${usAqi !== null ? usAqi : 'N/A'}`);
        this._indicatorDot.style_class = `aqi-indicator-dot ${details.styleClass}`;

        // Update Main Card in Popup
        this._mainCard.style_class = `aqi-main-card ${details.styleClass}`;
        this._aqiValueLabel.set_text(usAqi !== null ? `${usAqi} US AQI` : '-- US AQI');
        this._aqiCategoryLabel.set_text(details.category);
        this._aqiAdvisoryLabel.set_text(details.advisory);

        // Update Pollutants with color coding based on recommended thresholds
        const updatePollutant = (item, type, val, unit) => {
            const formatted = val !== undefined && val !== null ? `${val.toFixed(1)} ${unit}` : '--';
            item.valLbl.set_text(formatted);
            const statusClass = getPollutantStatus(type, val);
            item.valLbl.style_class = `aqi-pollutant-val ${statusClass}`;
        };

        updatePollutant(this._pm25, 'pm2_5', cur.pm2_5, 'μg/m³');
        updatePollutant(this._pm10, 'pm10', cur.pm10, 'μg/m³');
        updatePollutant(this._o3, 'o3', cur.ozone, 'μg/m³');
        updatePollutant(this._no2, 'no2', cur.nitrogen_dioxide, 'μg/m³');
        updatePollutant(this._so2, 'so2', cur.sulphur_dioxide, 'μg/m³');
        updatePollutant(this._co, 'co', cur.carbon_monoxide, 'μg/m³');

        if (cur.european_aqi !== undefined && cur.european_aqi !== null) {
            const eaqiVal = Math.round(cur.european_aqi);
            this._eaqi.valLbl.set_text(`${eaqiVal} EAQI`);
            const eaqiStatus = getPollutantStatus('eaqi', eaqiVal);
            this._eaqi.valLbl.style_class = `aqi-pollutant-val ${eaqiStatus}`;
        } else {
            this._eaqi.valLbl.set_text('--');
            this._eaqi.valLbl.style_class = 'aqi-pollutant-val aqi-val-unknown';
        }

        // Update Pollen & Allergy Report
        const hasTreeData = cur.alder_pollen !== null || cur.birch_pollen !== null || cur.olive_pollen !== null;
        const treePollenVal = hasTreeData ? ((cur.alder_pollen || 0) + (cur.birch_pollen || 0) + (cur.olive_pollen || 0)) : null;

        const grassPollenVal = cur.grass_pollen !== undefined && cur.grass_pollen !== null ? cur.grass_pollen : null;

        const hasWeedData = cur.ragweed_pollen !== null || cur.mugwort_pollen !== null;
        const weedPollenVal = hasWeedData ? ((cur.ragweed_pollen || 0) + (cur.mugwort_pollen || 0)) : null;

        const dustVal = cur.dust !== undefined && cur.dust !== null ? cur.dust : null;

        const treeDetails = getPollenDetails('tree', treePollenVal);
        const grassDetails = getPollenDetails('grass', grassPollenVal);
        const weedDetails = getPollenDetails('weed', weedPollenVal);
        const dustDetails = getPollenDetails('dust', dustVal);

        this._treePollen.valLbl.set_text(treeDetails.level);
        this._treePollen.valLbl.style_class = `aqi-pollutant-val ${treeDetails.styleClass}`;

        this._grassPollen.valLbl.set_text(grassDetails.level);
        this._grassPollen.valLbl.style_class = `aqi-pollutant-val ${grassDetails.styleClass}`;

        this._weedPollen.valLbl.set_text(weedDetails.level);
        this._weedPollen.valLbl.style_class = `aqi-pollutant-val ${weedDetails.styleClass}`;

        this._dustAllergen.valLbl.set_text(dustDetails.level);
        this._dustAllergen.valLbl.style_class = `aqi-pollutant-val ${dustDetails.styleClass}`;

        const allergyRisk = getAllergyRisk(
            treePollenVal,
            grassPollenVal,
            weedPollenVal,
            dustVal,
            cur.pm2_5
        );
        this._allergyRiskLabel.set_text(allergyRisk.label);
        this._allergyRiskLabel.style_class = `aqi-allergy-risk-title ${allergyRisk.styleClass}`;
        this._allergyRiskCard.style_class = `aqi-allergy-card ${allergyRisk.cardClass}`;

        // Update Timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
        this._updatedLabel.set_text(`Last updated: ${timeStr} (Auto every 15m)`);
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }

        if (this._session) {
            this._session.abort();
            this._session = null;
        }

        super.destroy();
    }
});

export default class KalimulyaAqiExtension extends Extension {
    enable() {
        this._indicator = new KalimulyaAqiIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
