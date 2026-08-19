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
                style_class: 'aqi-pollutant-val',
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
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,european_aqi&timezone=Asia%2FJakarta`;

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

        // Update Pollutants
        const formatVal = (val, unit) => {
            return val !== undefined && val !== null ? `${val.toFixed(1)} ${unit}` : '--';
        };

        this._pm25.valLbl.set_text(formatVal(cur.pm2_5, 'μg/m³'));
        this._pm10.valLbl.set_text(formatVal(cur.pm10, 'μg/m³'));
        this._o3.valLbl.set_text(formatVal(cur.ozone, 'μg/m³'));
        this._no2.valLbl.set_text(formatVal(cur.nitrogen_dioxide, 'μg/m³'));
        this._so2.valLbl.set_text(formatVal(cur.sulphur_dioxide, 'μg/m³'));
        this._co.valLbl.set_text(formatVal(cur.carbon_monoxide, 'μg/m³'));

        if (cur.european_aqi !== undefined && cur.european_aqi !== null) {
            this._eaqi.valLbl.set_text(`${Math.round(cur.european_aqi)} EAQI`);
        } else {
            this._eaqi.valLbl.set_text('--');
        }

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
