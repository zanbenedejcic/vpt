// #part /js/readers/BVPReader

// #link AbstractReader
// #link ZIPReader

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

class BVPReader extends AbstractReader {
    constructor(loader) {
        super(loader);

        this._metadata = null;
        this._zipReader = new ZIPReader(this._loader);
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
        if (!this._metadata) {
            await this.readMetadata();
        }
        const blockMeta = this._metadata.blocks[blockIndex];

        if (blockMeta.data) {
            var data = await this._zipReader.readFile(blockMeta.data);
            if (blockMeta.encoding === "lz4mod")
                data = decompress(new Uint8Array(data)); // TODO it's not always Uint8array
            return data;
        } else {
            // make block and fill with 0
            const sizeOfEmptyData =
                blockMeta.dimensions[0] *
                blockMeta.dimensions[1] *
                blockMeta.dimensions[2];
            var blockFrame = new ArrayBuffer(sizeOfEmptyData);

            // recursively go over subblocks if there are any
            blockMeta.blocks.forEach((currBlock) => {
                var tempData = this.readBlock(currBlock.block);
                // TODO add tempData to the proper position in blockFrame (currBlock.position)
                blockFrame = tempData;
                return tempData;
            });
            return blockFrame;
        }
    }
}
