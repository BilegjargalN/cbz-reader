import JSZip from 'jszip';

export class ComicBook {
    constructor(pages, name) {
        this.pages = pages.sort((a, b) => a.name.localeCompare(b.name));
        this.name = name;
        this.pageBlobs = new Array(this.pages.length).fill(null);
    }

    async getPageBlob(pageNumber) {
        if (pageNumber < 0 || pageNumber >= this.pages.length) return null;
        if (!this.pageBlobs[pageNumber]) {
            const blob = await this.pages[pageNumber].async('blob');
            this.pageBlobs[pageNumber] = URL.createObjectURL(blob);
        }
        return this.pageBlobs[pageNumber];
    }

    get pageCount() {
        return this.pages.length;
    }

    static async loadFromFile(file) {
        const zip = await JSZip.loadAsync(file);
        const imageFiles = [];
        zip.forEach((_, zipEntry) => {
            if (!zipEntry.dir && /\.(jpe?g|png|gif|webp)$/i.test(zipEntry.name)) {
                imageFiles.push(zipEntry);
            }
        });

        if (imageFiles.length > 0) {
            return new ComicBook(imageFiles, file.name);
        } else {
            throw new Error('No images found in the selected .cbz file.');
        }
    }
}
