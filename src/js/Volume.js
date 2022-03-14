// #part /js/Volume

// #link WebGL

class Volume {
    constructor(gl, reader, options) {
        Object.assign(
            this,
            {
                ready: false,
            },
            options
        );

        this._gl = gl;
        this._reader = reader;

        this.asset = null;
        this.modalities = null;
        this.blocks = null;
        this._texture = null;
        this.formats = null;
        this.type = null;
        this.format = null;
        this.internalFormat = null;
    }

    destroy() {
        const gl = this._gl;
        if (this._texture) {
            gl.deleteTexture(this._texture);
        }
    }

    async readMetadata() {
        if (!this._reader) {
            return;
        }

        this.ready = false;
        const data = await this._reader.readMetadata();
        this.modalities = data.modalities;
        this.blocks = data.blocks;
        // bvp stuff
        this.asset = data.asset;
        this.formats = data.formats;
    }

    async readModality(modalityName) {
        if (!this._reader) {
            throw new Error("No reader");
        }

        if (!this.modalities) {
            throw new Error("No modalities");
        }

        this.ready = false;
        const modality = this.modalities.find(
            (modality) => modality.name === modalityName
        );
        if (!modality) {
            throw new Error("Modality does not exist");
        }

        if (!this.formats) {
            throw new Error("Found no format");
        }

        const blocks = this.blocks;
        const topLevelBlock = blocks[modality.block];
        const topLevelBlockDimensions = topLevelBlock.dimensions;

        this._processFormat(
            this.formats[topLevelBlock.format].count,
            this.formats[topLevelBlock.format].type,
            this.formats[topLevelBlock.format].size
        );

        const gl = this._gl;
        if (this._texture) {
            gl.deleteTexture(this._texture);
        }
        this._texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this._texture);

        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texStorage3D(
            gl.TEXTURE_3D,
            1,
            this.internalFormat,
            topLevelBlockDimensions[0],
            topLevelBlockDimensions[1],
            topLevelBlockDimensions[2]
        );

        // for (const placement of modality.placements) {
        //     const data = await this._reader.readBlock(placement.index);
        //     const position = placement.position;
        //     const block = blocks[placement.index];
        //     const blockdim = block.dimensions;
        //     gl.bindTexture(gl.TEXTURE_3D, this._texture);
        //     gl.texSubImage3D(
        //         gl.TEXTURE_3D,
        //         0,
        //         position.x,
        //         position.y,
        //         position.z,
        //         blockdim.width,
        //         blockdim.height,
        //         blockdim.depth,
        //         modality.format,
        //         modality.type,
        //         this._typize(data, modality.type)
        //     );
        // }

        // draw BVP data
        // First we draw the top level block
        // If it has data we draw the data and end here as it has no further sub blocks
        if (topLevelBlock.data) {
            const data = await this._reader.readBlock(modality.block);
            const blockdim = topLevelBlock.dimensions;
            gl.bindTexture(gl.TEXTURE_3D, this._texture);
            gl.texSubImage3D(
                gl.TEXTURE_3D,
                0,
                0, // position.x we set this to 0 since it's only 1 block
                0, // position.y
                0, // position.z
                blockdim[0], // width
                blockdim[1], // depth
                blockdim[2], // height
                this.format,
                this.type,
                this._typize_newSpecs(
                    data,
                    this.formats[topLevelBlock.format].type,
                    this.formats[topLevelBlock.format].size
                )
            );
            this.ready = true;
            return;
        }

        // loop over all placements of top level block
        let remainingBlocks = topLevelBlock.blocks.length;
        topLevelBlock.blocks.forEach(async (currBlock) => {
            const data = await this._reader.readBlock(currBlock.block); // current placement
            console.log("volumeData:", data);
            const block = blocks[currBlock.block];
            const position = currBlock.position;
            const blockdim = block.dimensions;
            gl.bindTexture(gl.TEXTURE_3D, this._texture);
            gl.texSubImage3D(
                gl.TEXTURE_3D,
                0,
                position[0], // x
                position[1], // y
                position[2], // z
                blockdim[0], // width
                blockdim[1], // depth
                blockdim[2], // height
                this.format,
                this.type,
                this._typize_newSpecs(
                    data,
                    this.formats[block.format].type,
                    this.formats[block.format].size
                )
            );
            remainingBlocks--; // TODO check if this is even needed
            if (remainingBlocks === 0) {
                console.log("ready");
                this.ready = true;
            }
        });
        // this.ready = true;
    }

    _processFormat(count, type, size) {
        const gl = this._gl;
        if (count === 1 && type === "u" && size === 1) {
            this.internalFormat = gl.R8;
            this.format = gl.RED;
            this.type = gl.UNSIGNED_BYTE;
            return;
        }
        if (count === 1 && type === "f" && size === 2) {
            this.internalFormat = gl.R16F;
            this.format = gl.RED;
            this.type = gl.FLOAT;
            return;
        }
        if (count === 1 && type === "f" && size === 4) {
            this.internalFormat = gl.R32F;
            this.format = gl.RED;
            this.type = gl.FLOAT;
            return;
        }
        if (count === 2 && type === "u" && size === 1) {
            this.internalFormat = gl.RG8;
            this.format = gl.RG;
            this.type = gl.UNSIGNED_BYTE;
            return;
        }
        if (count === 2 && type === "f" && size === 2) {
            this.internalFormat = gl.RG16F;
            this.format = gl.RG;
            this.type = gl.FLOAT;
            return;
        }
        if (count === 2 && type === "f" && size === 4) {
            this.internalFormat = gl.RG32F;
            this.format = gl.RG;
            this.type = gl.FLOAT;
            return;
        }
        if (count === 4 && type === "u" && size === 1) {
            this.internalFormat = gl.RGBA;
            this.format = gl.RGBA;
            this.type = gl.UNSIGNED_BYTE;
            return;
        }
        if (count === 4 && type === "f" && size === 2) {
            this.internalFormat = gl.RGBA16F;
            this.format = gl.RGBA;
            this.type = gl.FLOAT;
            return;
        }
        if (count === 4 && type === "f" && size === 4) {
            this.internalFormat = gl.RGBA32F;
            this.format = gl.RGBA;
            this.type = gl.FLOAT;
            return;
        }
        throw new Error("This format is not supported.");
    }

    _typize_newSpecs(data, type, size) {
        if (type === "i" && size == 1) {
            return new Int8Array(data);
        }
        if (type === "i" && size == 2) {
            return new Int16Array(data);
        }
        if (type === "i" && size == 4) {
            return new Int32Array(data);
        }

        if (type === "u" && size == 1) {
            return new Uint8Array(data);
        }
        if (type === "u" && size == 2) {
            return new Uint16Array(data);
        }
        if (type === "u" && size == 4) {
            return new Uint32Array(data);
        }

        if (type === "f" && size == 4) {
            return new Float32Array(data);
        }
        throw new Error("Data structure not supported.");
    }

    getTexture() {
        if (this.ready) {
            return this._texture;
        } else {
            return null;
        }
    }

    setFilter(filter) {
        if (!this._texture) {
            return;
        }

        const gl = this._gl;
        filter = filter === "linear" ? gl.LINEAR : gl.NEAREST;
        gl.bindTexture(gl.TEXTURE_3D, this._texture);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
    }
}
