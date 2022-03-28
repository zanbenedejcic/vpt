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

    set(offset, block, sourceData, format) {
        const start = offset;
        const end = vec.add(offset, block.dimensions);
        const extent = vec.sub(end, start);
        const srcData = sourceData;

        if (this.format !== format) {
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
        const microblockFullExtent = vec.div(
            this.dimensions,
            microblockDimensions
        );

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

class BVPReader extends AbstractReader {
    constructor(loader) {
        super(loader);

        this._metadata = null;
        this._zipReader = new ZIPReader(this._loader);

        this.visitedBlocks = [];
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
        // check for recursive loops in placements
        if (this.visitedBlocks.includes(blockIndex)) {
            return -1;
        } else if (!blockMeta.data) {
            // if block has no data, add to visited blocks
            this.visitedBlocks.push(blockIndex);
        }

        if (!this._metadata) {
            await this.readMetadata();
        }

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
            const blockFramedata = new ArrayBuffer(sizeOfEmptyData);
            const blockFrame = new Block(
                blockMeta.dimensions,
                this._metadata.formats[blockMeta.format],
                blockFramedata
            );

            // recursively go over placements if there are any
            for (const currPlacement of blockMeta.placements) {
                const readData = await this.readBlock(currPlacement.block);
                if (readData == -1) continue; // TODO maybe there's a better way of doing this
                // copy read data to a block at the correct positions and offsets
                blockFrame.set(
                    currPlacement.position,
                    this._metadata.blocks[currPlacement.block],
                    readData,
                    this._metadata.formats[blockMeta.format]
                );
            }
            return blockFrame.data; // return only the ArrayBuffer from the frameBlock
        }
    }
}
