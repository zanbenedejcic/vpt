// #part /js/ui/Field

// #link UIObject

class Field extends UIObject {

constructor(options) {
    super(TEMPLATES.ui.Field, options);

    Object.assign(this, {
        label: ''
    }, options);

    this._content = null;
    this._binds.label.textContent = this.label;
}

destroy() {
    if (this._content) {
        this._content.destroy();
    }

    super.destroy();
}

setEnabled(enabled) {
    if (this._content) {
        this._content.setEnabled(enabled);
    }

    super.setEnabled(enabled);
}

add(object) {
    if (!this._content) {
        this._content = object;
        object.appendTo(this._binds.container);
        object.setEnabled(this.enabled);
    }
}

}
