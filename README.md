# 📝 KitSubStack by Kitmodule

**Fetch Substack posts, convert to Markdown with front matter, replace content, and export as ZIP — lightweight, dependency-free, and easy to use.**

[English](#) | [Tiếng Việt](https://github.com/kitmodule/kitsubstack-js/blob/master/README.vi.md)

[![npm version](https://img.shields.io/npm/v/kitsubstack-js.svg)](https://www.npmjs.com/package/kitsubstack-js)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kitmodule/kitsubstack-js/blob/master/LICENSE)

---

## ✨ Features

* 📬 Fetch posts from any Substack user.
* 🏷️ Generate Markdown with front matter for **Hashnode, Hugo, Jekyll, Astro**, or custom format.
* 🔄 Replace multiple strings in Markdown content (`replaces` like Golang `strings.NewReplacer`).
* ⚡ Supports sequential or concurrent fetching with optional limit.
* 💨 Chainable API: offset, limit, numbering, progress callback, completed callback.
* 📦 Export multiple posts as a ZIP file automatically.

---

## 🚀 Installation

### Using npm

```bash
npm install @kitmodule/kitsubstack
```

### Using CDN

```html
<script src="https://unpkg.com/@kitmodule/kitsubstack/dist/kitsubstack.min.js"></script>
```

or

```html
<script src="https://cdn.jsdelivr.net/npm/kitsubstack-js/dist/kitsubstack.min.js"></script>
```

---

## 💡 Usage

### Browser (CDN)

```html
<script src="https://unpkg.com/@kitmodule/kitsubstack/dist/kitsubstack.min.js"></script>
<script>
  const kit = new KitSubStack("example.substack.com");

  kit.offset(0)
     .limit(5)
     .numbering(true)
     .frontMatter("hashnode")
     .replaces("Substack", "Hashnode")
     .progress(fetch => {
         if (fetch.success) console.log("✅ Fetched:", fetch.post.slug);
         else console.error("❌ Error:", fetch.slug ?? "unknown");
     })
     .completed(filename => console.log("✅ ZIP ready:", filename))
     .zip();
</script>
```

### Node.js / CommonJS

```js
const { KitSubStack, zipSubstackToHashnode } = require("@kitmodule/kitsubstack");

// Basic usage
const kit = new KitSubStack("example.substack.com");

await kit.offset(0)
         .limit(10)
         .frontMatter("hashnode")
         .zip();

// Shortcut helper
await zipSubstackToHashnode("example.substack.com", 0, 5, true);
```

---

## 🧩 API Reference

### `new KitSubStack(input)`

| Parameter | Type            | Description                         |
| --------- | --------------- | ----------------------------------- |
| input     | string | object | Substack username, hostname, or URL |

### Chainable Methods

| Method                 | Description                                                            |                                            |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| `.offset(n)`           | Set the starting post index                                            |                                            |
| `.limit(n)`            | Set number of posts to fetch                                           |                                            |
| `.numbering(true       | false)`                                                                | Prepend numbering to file names            |
| `.progress(callback)`  | Callback for each fetched post                                         |                                            |
| `.completed(callback)` | Callback when ZIP is ready                                             |                                            |
| `.concurrent(n)`       | Run `n` fetches concurrently                                           |                                            |
| `.replaces(...args)`   | Replace multiple strings in content, e.g. `.replaces("0","1","2","3")` |                                            |
| `.frontMatter(type     | callback)`                                                             | Set front matter preset or custom function |
| `.zip()`               | Fetch posts, generate Markdown + front matter, and export ZIP          |                                            |

---

### Front Matter Presets

| Preset   | Fields                                                    |
| -------- | --------------------------------------------------------- |
| hashnode | title, slug, tags, date, image                            |
| hugo     | title, slug, date, draft, tags, description, cover        |
| jekyll   | layout, title, slug, date, categories, description, image |
| astro    | title, pubDate, description, tags, heroImage              |
| default  | title, slug, date, description, image                     |

Supports **async custom functions**:

```js
kit.frontMatter(async post => ({
    title: post.title.toUpperCase(),
    date: post.post_date,
    tags: post.postTags?.map(t => t.name) ?? [],
}));
```

---

### Replacing Multiple Strings

```js
kit.replaces(
    "Substack", "Hashnode",
    "2025", "2026"
);
```

* Works like Golang `strings.NewReplacer`.
* Replaces all occurrences in each post body.

---

## 📦 Integrated / Optional Kit Modules

**KitSubStack** is **dependency-free** and already **integrates the following Kit modules**:

| Package                                                       | Purpose                                                                   | Integrated in KitSubStack? |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------- |
| [KitZip JS](https://github.com/kitmodule/kitzip-js)           | Create ZIP files from Markdown or other files; lightweight and chainable. | ✅ Yes                      |
| [KitYAML JS](https://github.com/kitmodule/kityaml-js)         | Convert JavaScript objects to YAML front matter for Markdown files.       | ✅ Yes                      |
| [KitMarkdown JS](https://github.com/kitmodule/kitmarkdown-js) | Convert HTML to Markdown in a lightweight, dependency-free way.           | ✅ Yes                      |

> ⚡ Note: You **don’t need to install anything extra** to use KitSubStack. These packages are included and work out of the box.
> However, you can still **use each module individually** in other projects or integrate them into a custom workflow, for example: fetch posts → convert HTML to Markdown → generate YAML front matter → export ZIP.

## ☕ Support the Author

If you find this library useful, you can support me:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge\&logo=ko-fi\&logoColor=white)](https://ko-fi.com/huynhnhanquoc)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=for-the-badge\&logo=buy-me-a-coffee\&logoColor=black)](https://buymeacoffee.com/huynhnhanquoc)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-f7f7f7?style=for-the-badge\&logo=githubsponsors\&logoColor=ff69b4\&color=f7f7f7)](https://github.com/sponsors/huynhnhanquoc)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge\&logo=patreon\&logoColor=white)](https://patreon.com/huynhnhanquoc)
[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge\&logo=paypal\&logoColor=white)](https://paypal.me/huynhnhanquoc)

---

## 🧾 License

Released under the [MIT License](https://github.com/kitmodule/kitsubstack-js/blob/master/LICENSE)
© 2025 [Huỳnh Nhân Quốc](https://github.com/huynhnhanquoc) · Open Source [@Kit Module](https://github.com/kitmodule)
