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

