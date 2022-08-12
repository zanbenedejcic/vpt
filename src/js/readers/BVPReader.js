import { AbstractReader } from "./AbstractReader.js";
import { ZIPReader } from "./ZIPReader.js";
import { Block } from "../Block.js";
import { CommonUtils } from "../utils/CommonUtils.js";

export class BVPReader extends AbstractReader {
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
        data = CommonUtils.decompress(new Uint8Array(data));
      if (blockMeta.encoding === "s3dc") {
        const MMVblock = this._metadata.blocks[blockIndex - 1];
        const MMVdata = await this._zipReader.readFile(MMVblock.data);
        data = CommonUtils.decompressS3DC(
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
