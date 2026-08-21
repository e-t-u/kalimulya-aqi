UUID = kalimulya-aqi@etu
DEST = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all install symlink pack uninstall enable disable restart-gnome clean

all: install

pack:
	gnome-extensions pack --force --extra-source=stylesheet.css
	@echo "Packaged $(UUID).shell-extension.zip"

install:
	mkdir -p $(DEST)
	cp -f metadata.json stylesheet.css extension.js $(DEST)/
	@echo "Installed to $(DEST)"

symlink:
	mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	rm -rf $(DEST)
	ln -s $(PWD) $(DEST)
	@echo "Symlinked $(PWD) -> $(DEST)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

uninstall:
	rm -rf $(DEST)
	@echo "Removed $(DEST)"

clean:
	rm -f *.zip *.shell-extension.zip
