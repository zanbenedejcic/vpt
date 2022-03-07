// #part /js/ui/ProgressBar

// #link UIObject

class ProgressBar extends UIObject {

constructor(options) {
    super(TEMPLATES.ui.ProgressBar, options);

    Object.assign(this, {
        progress: 0
    }, options);

    this.setProgress(this.progress);
}

setProgress(progress) {
    const clamped = Math.min(Math.max(progress, 0), 100);
    this.progress = Math.round(clamped);
    this._binds.progress.style.width = this.progress + '%';
    this._binds.label.textContent = this.progress + '%';
}

getProgress() {
    return this.progress;
}

}
