/**
 * MIT License
 * Copyright (c) 2025-present, Huỳnh Nhân Quốc
 * Open source @ github.com/kitmodule
 * Dependents: 
 *  - https://github.com/kitmodule/kitzip-js
 *  - https://github.com/kitmodule/kitmarkdown-js
 *  - https://github.com/kitmodule/kityaml-js
 */

(function (global) {
    const kitmodule = global.kitmodule || (global.kitmodule = {});

    // ------------------------
    // CRC32 Table for zip integrity
    // ------------------------
    const CRC_TABLE = (() => {
        const t = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(data) {
        let crc = -1;
        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
        }
        return (crc ^ -1) >>> 0;
    }

    // ------------------------
    // Encoding helpers
    // ------------------------
    function toUint8Array(input) {
        if (typeof input === 'string') return new TextEncoder().encode(input);
        if (input instanceof Uint8Array) return input;
        if (input instanceof ArrayBuffer) return new Uint8Array(input);
        if (input && input.base64) return base64ToUint8Array(input.base64);
        return new Uint8Array(0);
    }

    function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    // ------------------------
    // Date → DOS format for zip headers
    // ------------------------
    function dateToDos(date = new Date()) {
        const dosTime =
            ((date.getHours() & 0x1F) << 11) |
            ((date.getMinutes() & 0x3F) << 5) |
            ((Math.floor(date.getSeconds() / 2)) & 0x1F);
        const dosDate =
            (((date.getFullYear() - 1980) & 0x7F) << 9) |
            ((date.getMonth() + 1) << 5) |
            (date.getDate() & 0x1F);
        return { dosTime, dosDate };
    }

    // ------------------------
    // Deflate helper (CompressionStream / Node.js fallback)
    // ------------------------
    async function deflateRaw(data) {
        // Node.js fallback
        if (typeof CompressionStream === 'undefined') {
            if (typeof require === 'function') {
                const zlib = require('zlib');
                return zlib.deflateRawSync(data);
            }
            // Fallback: store without compression
            return data;
        }

        const cs = new CompressionStream('deflate-raw');
        const writer = cs.writable.getWriter();
        writer.write(data);
        writer.close();
        const compressed = await new Response(cs.readable).arrayBuffer();
        return new Uint8Array(compressed);
    }

    // ------------------------
    // Core KitZip class
    // ------------------------
    function KitZip(input = [], opts = {}) {
        // Nếu input là object nhưng không phải array → coi là opts
        if (input && !Array.isArray(input) && typeof input === 'object') {
            opts = input;
            input = [];
        }

        this.files = Array.isArray(input) ? input.slice() : [];
        this.compress = opts.compress !== false;
        this.onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    }

    // ------------------------
    // Add single file
    // ------------------------
    KitZip.prototype.add = function (name, content, options = {}) {
        this.files.push({
            name,
            content,
            date: options.date || new Date(),
            compress: options.compress !== undefined ? options.compress : this.compress
        });
        return this;
    };

    // ------------------------
    // Add multiple files at once
    // ------------------------
    KitZip.prototype.addFiles = function (filesArray = []) {
        if (!Array.isArray(filesArray)) return this;
        filesArray.forEach(f => this.add(f.name, f.content, { compress: f.compress }));
        return this;
    };

    // ------------------------
    // Add file from URL
    // ------------------------
    KitZip.prototype.addURL = async function (url, name, options = {}) {
        const resp = await fetch(url);
        const reader = resp.body.getReader();
        const chunks = [];
        let loaded = 0;
        const total = +resp.headers.get('Content-Length') || 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (options.onProgress) options.onProgress(loaded, total);
        }

        const size = chunks.reduce((acc, c) => acc + c.length, 0);
        const data = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
            data.set(c, offset);
            offset += c.length;
        }

        this.add(name || url.split('/').pop(), data, options);
        return this;
    };

    // ------------------------
    // Enable/disable compression for following files
    // ------------------------
    KitZip.prototype.setCompression = function (enabled) {
        this.compress = !!enabled;
        return this;
    };

    // ------------------------
    // Compress all existing files
    // ------------------------
    KitZip.prototype.compressAll = function (enabled) {
        this.files.forEach(f => f.compress = !!enabled);
        return this;
    };

    // ------------------------
    // Progress callback
    // ------------------------
    KitZip.prototype.setProgressHandler = function (fn) {
        if (typeof fn === 'function') this.onProgress = fn;
        return this;
    };

    // ------------------------
    // Drag & Drop support in browser
    // ------------------------
    KitZip.prototype.enableDragDrop = function (element) {
        if (!(element instanceof HTMLElement)) return this;
        element.addEventListener('dragover', e => e.preventDefault());
        element.addEventListener('drop', e => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            files.forEach(f => {
                const reader = new FileReader();
                reader.onload = ev => this.add(f.name, ev.target.result);
                reader.readAsArrayBuffer(f);
            });
        });
        return this;
    };

    // ------------------------
    // Create zip stream (internal or for upload)
    // ------------------------
    KitZip.prototype.createStream = async function (writer) {
        const fileEntries = [];
        let offset = 0;

        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            const data = toUint8Array(file.content);
            const compressed = file.compress ? await deflateRaw(data) : data;
            const nameBytes = new TextEncoder().encode(file.name);
            const { dosTime, dosDate } = dateToDos(file.date);

            // Local file header
            const header = new Uint8Array(30 + nameBytes.length);
            const dv = new DataView(header.buffer);
            dv.setUint32(0, 0x04034b50, true);   // local file header signature
            dv.setUint16(4, 20, true);           // version needed to extract
            dv.setUint16(8, file.compress ? 8 : 0, true); // compression method
            dv.setUint16(10, dosTime, true);
            dv.setUint16(12, dosDate, true);
            dv.setUint32(14, crc32(data), true);
            dv.setUint32(18, compressed.length, true);
            dv.setUint32(22, data.length, true);
            dv.setUint16(26, nameBytes.length, true);
            header.set(nameBytes, 30);

            // write header + compressed data
            await writer.write(header);
            await writer.write(compressed);

            if (this.onProgress) this.onProgress(Math.round((i + 1) / this.files.length * 100), {
                fileIndex: i,
                fileName: file.name,
                status: 'processed'
            });

            fileEntries.push({ file, header, compressed, offset, nameBytes });
            offset += header.length + compressed.length;
        }

        // Central directory
        let cdSize = 0;
        const centralDir = [];
        for (const f of fileEntries) {
            const cd = new Uint8Array(46 + f.nameBytes.length);
            const dv = new DataView(cd.buffer);
            dv.setUint32(0, 0x02014b50, true);
            dv.setUint16(4, 20, true);
            dv.setUint16(6, 20, true);
            dv.setUint16(10, f.file.compress ? 8 : 0, true);
            const { dosTime, dosDate } = dateToDos(f.file.date);
            dv.setUint16(12, dosTime, true);
            dv.setUint16(14, dosDate, true);
            dv.setUint32(16, crc32(toUint8Array(f.file.content)), true);
            dv.setUint32(20, f.compressed.length, true);
            dv.setUint32(24, toUint8Array(f.file.content).length, true);
            dv.setUint16(28, f.nameBytes.length, true);
            dv.setUint32(42, f.offset, true);
            cd.set(f.nameBytes, 46);
            centralDir.push(cd);
            cdSize += cd.length;
        }

        // End of central directory
        const end = new Uint8Array(22);
        const dvEnd = new DataView(end.buffer);
        dvEnd.setUint32(0, 0x06054b50, true);
        dvEnd.setUint16(8, centralDir.length, true);
        dvEnd.setUint16(10, centralDir.length, true);
        dvEnd.setUint32(12, cdSize, true);
        dvEnd.setUint32(16, offset, true);

        // write central dir + end
        for (const cd of centralDir) await writer.write(cd);
        await writer.write(end);
    };

    // ------------------------
    // Download zip as file (browser)
    // ------------------------
    KitZip.prototype.download = async function (filename = 'kitzip.zip') {
        const chunks = [];
        const writer = { write(chunk) { chunks.push(chunk); }, close() { } };
        await this.createStream(writer);
        const blob = new Blob(chunks, { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ------------------------
    // Download zip WITHOUT await (helper save)
    // ------------------------
    KitZip.prototype.save = function (filename = 'kitzip.zip') {
        this.download(filename); // Không cần await
        return this;
    };

    // ------------------------
    // Shortcut helper
    // ------------------------
    async function kitZip(files = [], filename = 'kitzip.zip') {
        const zip = new KitZip(files);
        await zip.download(filename);
    }

    // ------------------------
    // Exports
    // ------------------------
    global.KitZip = KitZip;
    global.kitZip = kitZip;
    kitmodule.Zip = KitZip;
    kitmodule.zip = (files, ops) => new KitZip(files, ops);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { KitZip, kitZip };
    }

})(typeof window !== 'undefined' ? window : globalThis);


(function (global) {
    const kitmodule = global.kitmodule || (global.kitmodule = {});
    // ------------------------
    // Helper functions
    // ------------------------
    function cleanText(str) {
        return (str || '').replace(/\s+/g, ' ');
    }

    // ------------------------
    // Core: KitMarkdown class
    // ------------------------
    function KitMarkdown(html) {
        this.html = html || '';
    }

    KitMarkdown.prototype.convert = function () {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.html, 'text/html');
        const root = doc.body;

        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) return cleanText(node.textContent);
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const content = Array.from(node.childNodes).map(traverse).join('');

            switch (tag) {
                // Headings
                case 'h1': return `# ${content.trim()}\n\n`;
                case 'h2': return `## ${content.trim()}\n\n`;
                case 'h3': return `### ${content.trim()}\n\n`;
                case 'h4': return `#### ${content.trim()}\n\n`;
                case 'h5': return `##### ${content.trim()}\n\n`;
                case 'h6': return `###### ${content.trim()}\n\n`;

                // Text styles
                case 'strong':
                case 'b': return `**${content.trim()}**`;
                case 'em':
                case 'i': return `*${content.trim()}*`;
                case 'u': return `<u>${content.trim()}</u>`;
                case 'del':
                case 's': return `~~${content.trim()}~~`;
                case 'mark': return `==${content.trim()}==`;
                case 'code': return '`' + content.trim() + '`';
                case 'pre': return '\n```\n' + content.trim() + '\n```\n';

                // Links & media
                case 'a': return `[${content.trim()}](${node.getAttribute('href') || ''})`;
                case 'img': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
                case 'video': return node.getAttribute('src') ? `[Video](${node.getAttribute('src')})` : '';
                case 'audio': return node.getAttribute('src') ? `[Audio](${node.getAttribute('src')})` : '';

                // Lists
                case 'ul': return '\n' + Array.from(node.children).map(li => '- ' + traverse(li)).join('\n') + '\n';
                case 'ol': return '\n' + Array.from(node.children).map((li, i) => `${i + 1}. ${traverse(li)}`).join('\n') + '\n';
                case 'li': return content.trim();

                // Tables
                case 'table': {
                    const rows = Array.from(node.querySelectorAll('tr'));
                    const mdRows = rows.map((tr, idx) => {
                        const cells = Array.from(tr.children).map(td => traverse(td).trim());
                        const line = '| ' + cells.join(' | ') + ' |';
                        if (idx === 0) {
                            const separator = '| ' + cells.map(() => '---').join(' | ') + ' |';
                            return `${line}\n${separator}`;
                        }
                        return line;
                    });
                    return '\n' + mdRows.join('\n') + '\n\n';
                }

                // Quotes & separators
                case 'blockquote': return '\n> ' + content.trim().replace(/\n/g, '\n> ') + '\n';
                case 'hr': return '\n---\n';

                // Figures
                case 'figure': return '\n' + content.trim() + '\n';
                case 'figcaption': return `\n*${content.trim()}*\n`;

                // Paragraphs & line breaks
                case 'p': return `${content.trim()}\n\n`;
                case 'br': return '  \n';

                // Inline / block containers
                case 'span': return content;
                case 'div': return content + '\n';

                default: return content;
            }
        }

        return traverse(root).trim();
    };

    // ------------------------
    // Shortcut function
    // ------------------------
    function HTML2Markdown(html) {
        return new KitMarkdown(html).convert();
    }

    // ------------------------
    // Export
    // ------------------------
    global.KitMarkdown = KitMarkdown;       // class
    global.kitMarkdown = HTML2Markdown;     // quick convert function
    global.HTML2Markdown = HTML2Markdown;       // quick convert function

    kitmodule.Markdown = KitMarkdown;
    kitmodule.markdown = function (html) { return new KitMarkdown(html) };

    // Node.js / CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { KitMarkdown, HTML2Markdown };
    }

})(typeof window !== 'undefined' ? window : globalThis);


(function (global) {
    const kitmodule = global.kitmodule || (global.kitmodule = {});
    const $ = Symbol("$");

    // --------------------------------
    // Class: KitYAML
    // Convert JS Object → YAML or Front Matter

    function KitYAML(obj = {}) {
        if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
            throw new Error("KitYAML: input must be a plain object.");
        }

        this[$] = { obj, inline: true }; // default: inline array mode
    }

    // --------------------------------
    // Enable inline array mode
    // Example: tags: ["a", "b"]
    KitYAML.prototype.inline = function (enable = true) {
        this[$].inline = enable;
        return this;
    };

    // Enable block array mode
    // Example:
    // tags:
    //   - a
    //   - b
    KitYAML.prototype.block = function (enable = true) {
        this[$].inline = !enable;
        return this;
    };

    // --------------------------------
    // Convert JS object to YAML string
    KitYAML.prototype.convert = function () {
        const { obj, inline } = this[$];
        return encodeYAML(obj, 0, inline);
    };

    // --------------------------------
    // Convert to Markdown Front Matter
    KitYAML.prototype.frontMatter = function (body = "") {
        return `---\n${this.convert()}\n---\n\n${body}`;
    };

    // --------------------------------
    // Internal recursive YAML encoder

    function encodeYAML(value, indent = 0, inline = false) {
        const space = "  ".repeat(indent);

        if (value === null || value === undefined) return '""';
        if (typeof value === "boolean" || typeof value === "number") return value;
        if (typeof value === "string") return JSON.stringify(value);

        // ---------- Array ----------
        if (Array.isArray(value)) {
            if (inline) {
                return `[${value.map(v => encodeYAML(v, indent, inline)).join(", ")}]`;
            } else {
                return value
                    .map(v => {
                        if (typeof v === "object" && v !== null) {
                            return `\n${space}- ${encodeYAML(v, indent + 1, inline).replace(/^\s+/, "")}`;
                        } else {
                            return `${space}- ${encodeYAML(v, indent + 1, inline)}`;
                        }
                    })
                    .join("\n");
            }
        }

        // ---------- Object ----------
        if (typeof value === "object") {
            return Object.entries(value)
                .map(([key, val]) => {
                    if (Array.isArray(val)) {
                        if (inline) {
                            return `${space}${key}: [${val.map(i => encodeYAML(i, indent, inline)).join(", ")}]`;
                        } else {
                            return `${space}${key}:\n${encodeYAML(val, indent + 1, inline)}`;
                        }
                    }

                    if (typeof val === "object" && val !== null) {
                        return `${space}${key}:\n${encodeYAML(val, indent + 1, inline)}`;
                    }

                    return `${space}${key}: ${encodeYAML(val, indent + 1, inline)}`;
                })
                .join("\n");
        }

        return JSON.stringify(value);
    }

    // --------------------------------
    // Export module

    global.KitYAML = KitYAML;
    global.yamlFrontMatter = (obj, body) => new KitYAML(obj).frontMatter(body);
    
    kitmodule.YAML = KitYAML;
    kitmodule.yaml = (obj) => new KitYAML(obj);

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { KitYAML };
    }

})(typeof window !== "undefined" ? window : globalThis);

(function (global) {
    const kitmodule = global.kitmodule || (global.kitmodule = {});
    const $ = Symbol("$");

    // ------------------------
    // Constructor
    function KitSubStack(input = location.origin) {
        this[$] = {
            offset: 0,
            limit: 50,
            numbering: false,
            frontMatter: null,
            progress: null,
            concurrent: null,
            completed: null,
        };

        if (typeof input === "string") {
            const parsed = parseSubstack(input);
            if (parsed) {
                this[$].url = parsed.url;
                this[$].hostname = parsed.hostname;
                this[$].username = parsed.username;
            }
        } else if (typeof input === "object") {
            if (input.username) {
                this[$].username = input.username;
                this[$].hostname = `${input.username}.substack.com`;
                this[$].url = `https://${input.username}.substack.com`;
            } else if (input.hostname) {
                this[$].hostname = input.hostname;
                this[$].username = getUsername(input.hostname);
                this[$].url = `https://${input.hostname}`;
            }
            this[$].offset = input.offset ?? this[$].offset;
            this[$].limit = input.limit ?? this[$].limit;
        }
    }

    // ------------------------
    // Chainable setters
    KitSubStack.prototype.offset = function (val) { this[$].offset = val; return this; };
    KitSubStack.prototype.limit = function (val) { this[$].limit = val; return this; };
    KitSubStack.prototype.numbering = function (val = true) { this[$].numbering = val; return this; };
    KitSubStack.prototype.progress = function (callback) { this[$].progress = callback; return this; };
    KitSubStack.prototype.completed = function (callback) { this[$].completed = callback; return this; };
    KitSubStack.prototype.concurrent = function (val) { this[$].concurrent = val; return this; };
    KitSubStack.prototype.replaces = function (...val) { this[$].replaces = val; return this; };

    // ------------------------
    // Front matter 
    KitSubStack.prototype.frontMatter = function (type) {
        if (typeof type === "function") {
            this[$].frontMatter = type;
            return this;
        }

        switch (type) {
            case "hashnode":
                this[$].frontMatter = post => ({
                    title: post.title,
                    slug: post.slug,
                    tags: post.postTags?.map(t => t.name) ?? [],
                    date: post.post_date,
                    image: post.cover_image
                });
                break;
            case "hugo":
                this[$].frontMatter = post => ({
                    title: post.title,
                    slug: post.slug,
                    date: post.post_date,
                    draft: false,
                    tags: post.postTags?.map(t => t.name) ?? [],
                    description: post.description,
                    cover: post.cover_image
                });
                break;
            case "jekyll":
                this[$].frontMatter = post => ({
                    layout: "post",
                    title: post.title,
                    slug: post.slug,
                    date: post.post_date,
                    categories: post.postTags?.map(t => t.name) ?? [],
                    description: post.description,
                    image: post.cover_image
                });
                break;
            case "astro":
                this[$].frontMatter = post => ({
                    title: post.title,
                    pubDate: post.post_date,
                    description: post.description ?? "",
                    tags: post.postTags?.map(t => t.name) ?? [],
                    heroImage: post.cover_image
                });
                break;
            default:
                this[$].frontMatter = post => ({
                    title: post.title,
                    slug: post.slug,
                    date: post.post_date,
                    description: post.description,
                    image: post.cover_image
                });
        }

        return this;
    };


    KitSubStack.prototype.frontMatterHashnode = function () {
        return this.frontMatter("hashnode");
    };

    // ------------------------
    // Utility
    function getUsername(hostname) { return hostname.split(".substack.com")[0]; }

    function parseSubstack(input) {
        if (!input) return null;
        if (!input.includes(".substack.com")) input += ".substack.com";
        if (!/^https?:\/\//i.test(input)) input = "https://" + input;

        try {
            const urlObj = new URL(input);
            if (!urlObj.hostname.endsWith(".substack.com")) throw new Error("URL không phải Substack");
            const hostname = urlObj.hostname;
            const username = getUsername(hostname);

            urlObj.protocol = "https:";
            urlObj.pathname = "/";
            urlObj.search = "";
            urlObj.hash = "";

            return { url: urlObj.toString().replace(/\/$/, ""), hostname, username };
        } catch (err) {
            console.error("Error parseSubstack:", err);
            return null;
        }
    }

    // ------------------------
    // Fetch posts with progress & concurrency limit
    KitSubStack.prototype.getPosts = async function () {
        try {
            const { url, offset, limit, progress, concurrent } = this[$];
            const archiveApi = `${url}/api/v1/archive?sort=new&search=&offset=${offset}&limit=${limit}`;
            const res = await fetch(archiveApi);
            const posts = await res.json();

            const fetchPost = async (post) => {
                try {
                    const data = await fetch(`${url}/api/v1/posts/${post.slug}`).then(r => r.json());
                    if (progress) progress({ success: true, post: data });
                    return data;
                } catch (err) {
                    if (progress) progress({ success: false, slug: post?.slug ?? "unknown", error: err });
                    console.error(`❌ Failed: ${post?.slug ?? "unknown"}`, err);
                    return null;
                }
            };

            if (concurrent != null && concurrent > 0) {
                // run with concurrency limit
                const results = [];
                const executing = [];
                for (const post of posts) {
                    const p = fetchPost(post).then(r => { results.push(r); });
                    executing.push(p);
                    if (executing.length >= concurrent) {
                        await Promise.race(executing);
                        executing.splice(executing.findIndex(e => e === p), 1);
                    }
                }
                await Promise.all(executing);
                return results.filter(Boolean).reverse();
            } else {
                // sequential
                const results = [];
                for (const post of posts) {
                    const data = await fetchPost(post);
                    if (data) results.push(data);
                }
                return results.reverse();
            }
        } catch (err) {
            console.error("Error in getPosts:", err);
            return [];
        }
    };

    // ------------------------
    // ZIP posts
    KitSubStack.prototype.zipPosts = async function (callbackOrPreset) {
        this.frontMatter(callbackOrPreset)
        const callback = this[$].frontMatter

        if (typeof callback !== "function") throw new Error("Front matter callback not set.");

        const posts = await this.getPosts();
        if (!posts.length) {
            console.warn("No posts found to zip.");
            return;
        }

        const { username, offset, numbering } = this[$];
        const files = [];

        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            let body = kitmodule.markdown(post.body_html).convert();
            const replaces = this[$].replaces;
            if (replaces?.length) {
                // expects replaces = ["0","1","2","3",...]
                for (let i = 0; i < replaces.length; i += 2) {
                    const search = replaces[i];
                    const replace = replaces[i + 1] ?? "";
                    body = body.split(search).join(replace); // replace all occurrences
                }
            }

            const frontMatter = await callback(post); // support async
            const name = numbering ? `${offset + i + 1}.${post.slug}.md` : `${post.slug}.md`;
            files.push({ name, content: kitmodule.yaml(frontMatter).frontMatter(body) });
        }

        const to = offset + posts.length;
        const filename = `${username || "substack"}-posts-${offset}-${to}-${Date.now()}.zip`;
        await kitmodule.zip(files).download(filename);
        const completed = this[$].completed
        if (completed) { completed(filename) }
        return filename;
    };

    KitSubStack.prototype.zip = async function () {
        return this.zipPosts();
    };

    // ------------------------
    // Export
    global.KitSubStack = KitSubStack;
    global.zipSubstackToHashnode = async function (input = location.origin, offset = 0, limit = 50, numbering = false) {
        const kit = new KitSubStack(input);
        kit.offset(offset)
            .limit(limit)
            .numbering(numbering)
            .frontMatter("hashnode")
            .replaces("Substack", "Hashnode")
            .progress(fetch => {
                if (fetch.success) console.log("✅ Fetched:", fetch.post.slug);
                else console.error("❌ Error:", fetch.slug ?? "unknown");
            })
            .completed(filename => console.log("✅ Zip Ready:", filename))
            ;
        await kit.zip();
    };

    kitmodule.SubStack = KitSubStack;
    kitmodule.subStack = input => new KitSubStack(input);
    if (typeof module !== "undefined" && module.exports) module.exports = { KitSubStack };

})(typeof window !== "undefined" ? window : globalThis);

