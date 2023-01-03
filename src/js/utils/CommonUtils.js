import { Vec } from "../math/Vec.js";
import { Block } from "../Block.js";

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

  static decompressSize(src) {
    let [srcIndex, dstIndex] = [0, 0];

    while (srcIndex < src.length) {
      const token = src[srcIndex++];
      if (token === 0) break;

      // literal copy
      let literalCount = token >>> 4;
      if (literalCount === 0x0f) {
        do {
          literalCount += src[srcIndex];
        } while (src[srcIndex++] === 0xff);
      }
      srcIndex += literalCount;
      dstIndex += literalCount;

      // match copy
      srcIndex += 2;
      let matchLength = token & 0x0f;
      if (matchLength === 0x0f) {
        do {
          matchLength += src[srcIndex];
        } while (src[srcIndex++] === 0xff);
      }
      dstIndex += matchLength;
    }

    return dstIndex;
  }

  static decompress(src, size) {
    if (!size) {
      size = CommonUtils.decompressSize(src);
    }
    const dst = new Uint8Array(size);
    let [srcIndex, dstIndex] = [0, 0];

    while (srcIndex < src.length) {
      const token = src[srcIndex++];
      if (token === 0) break;

      // literal copy
      let literalCount = token >>> 4;
      if (literalCount === 0x0f) {
        do {
          literalCount += src[srcIndex];
        } while (src[srcIndex++] === 0xff);
      }
      for (let i = 0; i < literalCount; i++) {
        dst[dstIndex++] = src[srcIndex++];
      }

      // match copy
      const offset = (src[srcIndex + 0] << 0) | (src[srcIndex + 1] << 8);
      srcIndex += 2;
      let matchIndex = dstIndex - offset;
      let matchLength = token & 0x0f;
      if (matchLength === 0x0f) {
        do {
          matchLength += src[srcIndex];
        } while (src[srcIndex++] === 0xff);
      }
      for (let i = 0; i < matchLength; i++) {
        dst[dstIndex++] = dst[matchIndex++];
      }
    }

    return dstIndex === dst.length ? dst : dst.slice(0, dstIndex);
  }

  static calculateIbits(srcLength, dimensions) {
    const ratio = (dimensions[0] * dimensions[1] * dimensions[2]) / srcLength;
    if (ratio == 2) return [4, ratio];
    else if (ratio == 4) return [2, ratio];
    else throw new Error("Error when calculating iBits");
  }

  static decompressS3DC(src, MMV, dimensions, format) {
    // get indexBits and ratio
    // TODO get indexBits and valueSize from metadata
    // const [ibits, ratio] = CommonUtils.calculateIbits(src.length, dimensions);
    // console.log("ibits", ibits);
    // var bitmask = 3; // 00000011
    // if (ibits == 4) bitmask = 15; // 00001111

    const ibits = format.indexBits;
    var bitmask = 3; // 00000011
    if (ibits == 4) bitmask = 15; // 00001111

    // prepare data array and uncompressedBlock
    const finalData = new Uint8Array(Vec.mulElements(dimensions));
    const finalBlock = new Block(dimensions, format, finalData);

    const numberOfMicroBlocks = MMV.length / 2; // MMV consists of min max pairs for each microblock
    console.log("numberOfMicroBlocks", numberOfMicroBlocks);

    const tempRatio = Vec.mulElements(dimensions) / numberOfMicroBlocks;

    const MBsideDim = Math.cbrt(tempRatio);
    console.log("MBsideDim", MBsideDim);

    const uncompressedMicroblockDimensions = [MBsideDim, MBsideDim, MBsideDim];
    console.log(
      "uncompressedMicroblockDimensions",
      uncompressedMicroblockDimensions
    );

    const microBlockLength = src.length / numberOfMicroBlocks;
    console.log("microBlockLength", microBlockLength);

    const numberOfMicroBlocksVec = Vec.ceil(
      Vec.div(dimensions, uncompressedMicroblockDimensions) // [2,2,2] = 8
    );
    console.log("numberOfMicroBlocksVec", numberOfMicroBlocksVec);

    var mmvCount = 0;
    var mb = 0;
    for (const ijkArray of Vec.lexi(numberOfMicroBlocksVec)) {
      const compressedMicroBlockData = src.slice(
        microBlockLength * mb,
        microBlockLength * (mb + 1)
      );

      if (compressedMicroBlockData.every((val) => val === 0)) {
        mmvCount += 2;
        mb++;
        continue; // if it's all zeros, read next microblock
      }

      var uncompressedMicroBlockData = new Uint8Array(64 * 64 * 64); // 262144

      // decompress and write to uncompressedMicroBlockData
      const min = MMV[mmvCount];
      const max = MMV[mmvCount + 1];
      var position = 8 / ibits; // 4
      for (const val of compressedMicroBlockData) {
        var offset = 1;
        for (let i = 0; i < 8; i += ibits) {
          // 4x
          const index = (val & (bitmask << i)) >>> i; // extract index from bits in byte
          const dv = min + (max - min) * (index / (Math.pow(2, ibits) - 1)); // calculate decompressed value
          uncompressedMicroBlockData[position - offset] = dv; // 4 - 1 = 3 > 2 > 1 > 0
          offset++;
        }
        position += 8 / ibits;
      }

      // make block from uncompressed data
      const uncompressedMicroBlock = new Block(
        uncompressedMicroblockDimensions,
        format,
        uncompressedMicroBlockData
      );

      const pos = Vec.mul(ijkArray, uncompressedMicroblockDimensions);

      finalBlock.set(pos, uncompressedMicroBlock);

      mmvCount += 2;
      mb++;
    }

    return finalBlock;
  }
}
