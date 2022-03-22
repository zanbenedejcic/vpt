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
            let data = await this._zipReader.readFile(blockMeta.data);
            if (blockMeta.encoding === "lz4mod")
                data = decompress(new Uint8Array(data)); // TODO it's not always Uint8array
            return data;
        } else {
            // make block and fill with 0
            const sizeOfEmptyData =
                blockMeta.dimensions[0] *
                blockMeta.dimensions[1] *
                blockMeta.dimensions[2];
            const blockFrame = new ArrayBuffer(sizeOfEmptyData);

            // recursively go over subblocks if there are any
            for (const currBlock of blockMeta.blocks) {
                const tempData = await this.readBlock(currBlock.block);
                const arrayDataView = new DataView(tempData);
                const frameDataView = new DataView(blockFrame);
                this.copyData(
                    arrayDataView,
                    frameDataView,
                    currBlock.position,
                    blockMeta.dimensions
                );
            }

            return blockFrame;
        }
    }

    copyData(src, dest, blockPosition, blockDimensions) {
        const startIndex =
            blockPosition[0] +
            blockDimensions[0] * blockPosition[1] +
            blockDimensions[0] * blockDimensions[1] * blockPosition[2]; // x + dimX * y + dimX * dimY * z
        for (let index = 0; index < src.byteLength; index++) {
            const offset = index + startIndex;
            dest.setUint8(offset, src.getUint8(offset)); // TODO check if this is a problem (Uint8)
        }
        return dest;
    }

    sumOfArray(arr) {
        var sum = 0;
        for (let index = 0; index < arr.byteLength; index++) {
            sum += arr.getUint8(index);
        }
        console.log("sum:", sum);
    }

    isCopy(arr1, arr2) {
        for (let i = 0; i < arr1.byteLength; i++) {
            if (arr1.getUint8(i) != arr2.getUint8(i)) {
                console.log("Not the same!", i);
                return;
            }
        }
        console.log("Same");
    }
}
