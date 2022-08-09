export class CommonUtils {
  static downloadJSON(json, filename) {
    const str =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(json));
    let a = document.createElement("a");
    a.setAttribute("href", str);
    a.setAttribute("download", filename);
    a.click();
    a = null;
  }

  static readTextFile(onLoad, onError) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.addEventListener("change", function () {
      const reader = new FileReader();
      if (onLoad) {
        reader.addEventListener("load", function () {
          onLoad(reader.result);
        });
      }
      if (onError) {
        reader.addEventListener("error", onError);
      }
      reader.readAsText(input.files[0]);
    });
    input.click();
  }

  static bind(object, { prefix = "", suffix = "Listener" } = {}) {
    const methods = Object.getOwnPropertyNames(object.constructor.prototype);
    for (const method of methods) {
      if (method.startsWith(prefix) && method.endsWith(suffix)) {
        object[method] = object[method].bind(object);
      }
    }
  }

  static hex2rgb(str) {
    return [
      parseInt(str.substring(1, 3), 16) / 255,
      parseInt(str.substring(3, 5), 16) / 255,
      parseInt(str.substring(5, 7), 16) / 255,
    ];
  }

  static rgb2hex(rgb) {
    const strings = rgb
      .map((x) => Math.floor(x * 255).toString(16))
      .map((x) => (x.length < 2 ? `0${x}` : x));
    return `#${strings.join("")}`;
  }

  static toposort(graph) {
    let sorted = [];
    let visited = {};
    let processing = {};

    Object.keys(graph).forEach(function visit(next) {
      if (visited[next]) return;
      if (processing[next]) throw new Error("Cyclic dependencies");

      processing[next] = true;
      graph[next].forEach((d) => visit(d));
      processing[next] = false;

      visited[next] = true;
      sorted.push(next);
    });

    return sorted;
  }

  static makeGraph(blocks) {
    const graph = {};
    var blockIndex = 0;
    for (const block of blocks) {
      const dependencies = [];
      if (block.placements) {
        for (const placement of block.placements) {
          dependencies.push(placement.block);
        }
      }
      graph[blockIndex] = dependencies;
      blockIndex++;
    }
    return graph;
  }
}
