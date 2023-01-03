import { Vec } from "./math/Vec.js";

export class Block {
  constructor(dimensions, format, data) {
    this.dimensions = dimensions;
    this.format = format;
    this.data = data;
  }

  get(start, end) {
    const extent = Vec.sub(end, start);

    if (Vec.any(Vec.gt(start, end))) {
      throw new Error("Start greater than end");
    }
    if (Vec.any(Vec.lt(start, Vec.zeros(start.length)))) {
      throw new Error("Start out of bounds");
    }
    if (Vec.any(Vec.gt(end, this.dimensions))) {
      throw new Error("End out of bounds");
    }
    if (Vec.any(Vec.mod(start, this.format.microblockDimensions))) {
      throw new Error("Not on microblock boundary");
    }
    if (Vec.any(Vec.mod(extent, this.format.microblockDimensions))) {
      throw new Error("Not an integer number of microblocks");
    }

    const { microblockSize, microblockDimensions } = this.format;
    const microblockStart = Vec.div(start, microblockDimensions);
    const microblockEnd = Vec.div(end, microblockDimensions);
    const microblockCropExtent = Vec.div(extent, microblockDimensions);
    const microblockFullExtent = Vec.div(this.dimensions, microblockDimensions);

    const block = new Block(
      extent,
      this.format,
      new Uint8Array(Vec.mulElements(extent))
    );
    const srcBytes = new Uint8Array(this.data);
    const dstBytes = new Uint8Array(block.data);
    for (const localMicroblockIndex of Vec.lexi(microblockCropExtent)) {
      const globalMicroblockIndex = Vec.add(
        localMicroblockIndex,
        microblockStart
      );
      const srcMicroblockIndex = Vec.linearIndex(
        globalMicroblockIndex,
        microblockFullExtent
      );
      const dstMicroblockIndex = Vec.linearIndex(
        localMicroblockIndex,
        microblockCropExtent
      );
      for (let i = 0; i < microblockSize; i++) {
        dstBytes[i + dstMicroblockIndex * microblockSize] =
          srcBytes[i + srcMicroblockIndex * microblockSize];
      }
    }
    block.data = dstBytes;
    return block;
  }

  set(offset, block) {
    const start = offset;
    const end = Vec.add(offset, block.dimensions);
    const extent = Vec.sub(end, start);

    if (this.format !== block.format) {
      throw new Error("Format missmatch");
    }
    if (Vec.any(Vec.gt(start, end))) {
      throw new Error("Start greater than end");
    }
    if (Vec.any(Vec.lt(start, Vec.zeros(start.length)))) {
      throw new Error("Start out of bounds");
    }
    if (Vec.any(Vec.gt(end, this.dimensions))) {
      throw new Error("End out of bounds");
    }
    if (Vec.any(Vec.mod(start, this.format.microblockDimensions))) {
      throw new Error("Not on microblock boundary");
    }
    if (Vec.any(Vec.mod(extent, this.format.microblockDimensions))) {
      throw new Error("Not an integer number of microblocks");
    }

    const { microblockSize, microblockDimensions } = this.format;
    const microblockStart = Vec.div(start, microblockDimensions);
    const microblockEnd = Vec.div(end, microblockDimensions);
    const microblockCropExtent = Vec.div(extent, microblockDimensions);
    const microblockFullExtent = Vec.div(this.dimensions, microblockDimensions);

    const srcBytes = new Uint8Array(block.data);
    const dstBytes = new Uint8Array(this.data);
    for (const localMicroblockIndex of Vec.lexi(microblockCropExtent)) {
      const globalMicroblockIndex = Vec.add(
        localMicroblockIndex,
        microblockStart
      );
      const srcMicroblockIndex = Vec.linearIndex(
        localMicroblockIndex,
        microblockCropExtent
      );
      const dstMicroblockIndex = Vec.linearIndex(
        globalMicroblockIndex,
        microblockFullExtent
      );
      for (let i = 0; i < microblockSize; i++) {
        dstBytes[i + dstMicroblockIndex * microblockSize] =
          srcBytes[i + srcMicroblockIndex * microblockSize];
      }
    }
    this.data = dstBytes;
    return this;
  }
}
