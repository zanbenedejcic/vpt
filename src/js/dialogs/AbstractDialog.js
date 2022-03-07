// #part /js/dialogs/AbstractDialog

// #link ../ui

class AbstractDialog extends EventTarget {

constructor(spec, options) {
    super();

    Object.assign(this, {
        visible: true
    }, options);

    this._spec = spec;

    const creation = UI.create(JSON.parse(this._spec));
    this._object = creation.object;
    this._binds = creation.binds;
}

destroy() {
    this._object.destroy();
}

isVisible() {
    return this._object.isVisible();
}

setVisible(visible) {
    this._object.setVisible(visible);
}

show() {
    this._object.show();
}

hide() {
    this._object.hide();
}

appendTo(object) {
    object.add(this._object);
}

}
