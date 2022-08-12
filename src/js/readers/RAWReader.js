import { AbstractReader } from "./AbstractReader.js";
import { Block } from "../Block.js";

export class RAWReader extends AbstractReader {
  constructor(loader, options) {
    super(loader);

    Object.assign(
      this,
      {
        width: 0,
        height: 0,
        depth: 0,
      },
      options
    );
  }

  async readMetadata() {
    let metadata = {
      asset: {
        version: "1.0",
      },
      modalities: [
        {
          name: "default",
          scale: [1, 1, 1],
          block: 0,
        },
      ],
      blocks: [
        {
          dimensions: [this.width, this.height, this.depth],
          format: 0,
          placements: [],
        },
      ],
      formats: [
        {
          family: "mono",
          count: 1,
          type: "u",
          size: 1,
          microblockDimensions: [1, 1, 1],
          microblockSize: 1,
        },
      ],
    };

    for (let i = 0; i < this.depth; i++) {
      metadata.blocks[0].placements.push({
        block: i + 1,
        position: [0, 0, i],
      });

      metadata.blocks.push({
        data: "default",
        format: 0,
        dimensions: [this.width, this.height, 1],
        encoding: "raw",
      });
    }

    return metadata;
  }

  async readBlock(block) {
    const sliceBytes = this.width * this.height;
    const start = (block - 1) * sliceBytes;
    const end = block * sliceBytes;
    const data = await this._loader.readData(start, end);
    return new Block(
      [this.width, this.height, 1],
      {
        family: "mono",
        count: 1,
        type: "u",
        size: 1,
        microblockDimensions: [1, 1, 1],
        microblockSize: 1,
      },
      data
    );
  }
}
