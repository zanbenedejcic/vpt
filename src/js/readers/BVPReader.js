// #part /js/readers/BVPReader

// #link AbstractReader
// #link ZIPReader

class vec {
  static const(length, x) {
    return new Array(length).fill(x);
  }
  static zeros(length) {
    return vec.const(length, 0);
  }
  static ones(length) {
    return vec.const(length, 1);
  }

  static clone(a) {
    return [...a];
  }
  static length(a) {
    return Math.hypot(...a);
  }

  static unaryOp(a, op) {
    return a.map(op);
  }

  static binaryOp(a, b, op) {
    if (a.length !== b.length) {
      throw new DimensionMismatchError();
    }
    const out = vec.zeros(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = op(a[i], b[i]);
    }
    return out;
  }

  static all(a) {
    return a.every((a) => a);
  }
  static any(a) {
    return a.some((a) => a);
  }
  static none(a) {
    return a.every((a) => !a);
  }

  static floor(a) {
    return vec.unaryOp(a, Math.floor);
  }
  static ceil(a) {
    return vec.unaryOp(a, Math.ceil);
  }
  static round(a) {
    return vec.unaryOp(a, Math.round);
  }
  static add(a, b) {
    return vec.binaryOp(a, b, (a, b) => a + b);
  }
  static sub(a, b) {
    return vec.binaryOp(a, b, (a, b) => a - b);
  }
  static mul(a, b) {
    return vec.binaryOp(a, b, (a, b) => a * b);
  }
  static div(a, b) {
    return vec.binaryOp(a, b, (a, b) => a / b);
  }
  static mod(a, b) {
    return vec.binaryOp(a, b, (a, b) => a % b);
  }
  static min(a, b) {
    return vec.binaryOp(a, b, Math.min);
  }
  static max(a, b) {
    return vec.binaryOp(a, b, Math.max);
  }

  static eq(a, b) {
    return vec.binaryOp(a, b, (a, b) => a === b);
  }
  static neq(a, b) {
    return vec.binaryOp(a, b, (a, b) => a !== b);
  }
  static approx(a, b, eps) {
    return vec.binaryOp(a, b, (a, b) => Math.abs(a - b < eps));
  }
  static lt(a, b) {
    return vec.binaryOp(a, b, (a, b) => a < b);
  }
  static gt(a, b) {
    return vec.binaryOp(a, b, (a, b) => a > b);
  }
  static leq(a, b) {
    return vec.binaryOp(a, b, (a, b) => a <= b);
  }
  static geq(a, b) {
    return vec.binaryOp(a, b, (a, b) => a >= b);
  }

  static mulElements(a) {
    return a.reduce((x, y) => x * y);
  }

  static sumElements(a) {
    return a.reduce((x, y) => x + y);
  }

  static dot(a, b) {
    return vec.sumElements(vec.mul(a, b));
  }

  static linearIndex(index, dimensions) {
    const dims = vec.clone(dimensions);
    let scale = 1;
    for (let i = 0; i < dims.length; i++) {
      dims[i] = scale;
      scale *= dimensions[i];
    }
    return vec.sumElements(vec.mul(index, dims));
  }

  static *lexi(a) {
    const b = new Array(a.length).fill(0);
    const count = a.reduce((a, b) => a * b);
    for (let j = 0; j < count; j++) {
      yield [...b];
      for (let i = 0; i < b.length; i++) {
        b[i]++;
        if (b[i] >= a[i]) {
          b[i] = 0;
        } else {
          break;
        }
      }
    }
  }
}
class Block {
  constructor(dimensions, format, data) {
    this.dimensions = dimensions;
    this.format = format;
    this.data = data;
  }

  set(offset, block) {
    const start = offset;
    const end = vec.add(offset, block.dimensions);
    const extent = vec.sub(end, start);
    const srcData = block.data;

    if (this.format !== block.format) {
      throw new Error("Format missmatch");
    }
    if (vec.any(vec.gt(start, end))) {
      throw new Error("Start greater than end");
    }
    if (vec.any(vec.lt(start, vec.zeros(start.length)))) {
      throw new Error("Start out of bounds");
    }
    if (vec.any(vec.gt(end, this.dimensions))) {
      throw new Error("End out of bounds");
    }
    if (vec.any(vec.mod(start, this.format.microblockDimensions))) {
      throw new Error("Not on microblock boundary");
    }
    if (vec.any(vec.mod(extent, this.format.microblockDimensions))) {
      throw new Error("Not an integer number of microblocks");
    }

    const { microblockSize, microblockDimensions } = this.format;
    const microblockStart = vec.div(start, microblockDimensions);
    const microblockEnd = vec.div(end, microblockDimensions);
    const microblockCropExtent = vec.div(extent, microblockDimensions);
    const microblockFullExtent = vec.div(this.dimensions, microblockDimensions);

    const srcBytes = new Uint8Array(srcData);
    const dstBytes = new Uint8Array(this.data);
    for (const localMicroblockIndex of vec.lexi(microblockCropExtent)) {
      const globalMicroblockIndex = vec.add(
        localMicroblockIndex,
        microblockStart
      );
      const srcMicroblockIndex = vec.linearIndex(
        localMicroblockIndex,
        microblockCropExtent
      );
      const dstMicroblockIndex = vec.linearIndex(
        globalMicroblockIndex,
        microblockFullExtent
      );
      for (let i = 0; i < microblockSize; i++) {
        dstBytes[i + dstMicroblockIndex * microblockSize] =
          srcBytes[i + srcMicroblockIndex * microblockSize];
      }
    }
    return this;
  }
}

function decompressSize(src) {
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

function decompress(src, size) {
  if (!size) {
    size = decompressSize(src);
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

function decompressS3DC(src, MMV, dimensions) {
  const ibits = 4;
  var bitmask = 3;
  if (ibits == 4) bitmask = 15;
  // get min and max
  const min = MMV[0];
  const max = MMV[1];
  // make buffer dim^3
  const dst = new Uint8Array(dimensions[0] * dimensions[1] * dimensions[2]);
  // loop over src
  var position = 8 / ibits;
  for (const val of src) {
    var offset = 1;
    for (let i = 0; i < 8; i += ibits) {
      const index = (val & (bitmask << i)) >>> i; // extract index from bits in byte
      const dv = min + (max - min) * (index / (Math.pow(2, ibits) - 1)); // calculate decompressed value
      dst[position - offset] = dv;
      offset++;
    }
    position += 8 / ibits;
    offset = 0;
  }
  return dst;
}

class BVPReader extends AbstractReader {
  constructor(loader) {
    super(loader);

    this._metadata = null;
    this._zipReader = new ZIPReader(this._loader);

    this.cachedBlocks = new Map(); // [key, value] = [index, block]
  }

  async readMetadata() {
    const data = await this._zipReader.readFile("manifest.json");
    const decoder = new TextDecoder("utf-8");
    const jsonString = decoder.decode(data);
    const json = JSON.parse(jsonString);
    this._metadata = json;
    return this._metadata;
  }

  async readBlock(blockIndex) {
    const blockMeta = this._metadata.blocks[blockIndex];

    if (!this._metadata) {
      await this.readMetadata();
    }

    if (blockMeta.data) {
      let data = await this._zipReader.readFile(blockMeta.data); // read data
      if (blockMeta.encoding === "lz4mod")
        data = decompress(new Uint8Array(data));
      if (blockMeta.encoding === "s3dc") {
        const MMVblock = this._metadata.blocks[blockIndex - 1];
        const MMVdata = await this._zipReader.readFile(MMVblock.data);
        // data = decompressS3DC(new Uint8Array(data));
        data = decompressS3DC(
          new Uint8Array(data),
          new Uint8Array(MMVdata),
          blockMeta.dimensions
        );
      }
      const newBlock = new Block(
        blockMeta.dimensions,
        this._metadata.formats[blockMeta.format],
        data
      );
      return newBlock;
    } else {
      // make block frame and fill with 0
      const sizeOfEmptyData =
        blockMeta.dimensions[0] *
        blockMeta.dimensions[1] *
        blockMeta.dimensions[2];
      const blockFramedata = new ArrayBuffer(sizeOfEmptyData);
      const blockFrame = new Block(
        blockMeta.dimensions,
        this._metadata.formats[blockMeta.format],
        blockFramedata
      );

      // recursively go over placements if there are any
      for (const currPlacement of blockMeta.placements) {
        // block already read
        if (this.cachedBlocks.has(currPlacement.block)) {
          console.log(currPlacement.block);
          blockFrame.set(
            currPlacement.position,
            this.cachedBlocks.get(currPlacement.block)
          );
        } else {
          const newBlock = await this.readBlock(currPlacement.block);
          // copy read data to a block at the correct positions and offsets
          blockFrame.set(currPlacement.position, newBlock);
          this.cachedBlocks.set(currPlacement.block, newBlock);
        }
      }
      return blockFrame; // returns whole block
    }
  }
}
