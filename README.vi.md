# 📝 KitSubStack by Kitmodule

**Lấy bài viết từ Substack, chuyển sang Markdown kèm front matter, thay thế nội dung, và xuất ra ZIP — nhẹ, không phụ thuộc, dễ sử dụng.**

[English](https://github.com/kitmodule/kitsubstack-js/blob/master/README.md) | [Tiếng Việt](#)

[![npm version](https://img.shields.io/npm/v/kitsubstack.svg)](https://www.npmjs.com/package/kitsubstack)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kitmodule/kitsubstack-js/blob/master/LICENSE)

---

## ✨ Tính năng

* 📬 Lấy bài viết từ bất kỳ người dùng Substack nào.
* 🏷️ Tạo Markdown kèm front matter cho **Hashnode, Hugo, Jekyll, Astro**, hoặc định dạng tùy chỉnh.
* 🔄 Thay thế nhiều chuỗi trong nội dung Markdown (`replaces` giống Golang `strings.NewReplacer`).
* ⚡ Hỗ trợ lấy bài viết **tuần tự** hoặc **đồng thời** với giới hạn tùy chọn.
* 💨 API **chainable**: offset, limit, đánh số file, callback tiến trình, callback hoàn thành.
* 📦 Xuất nhiều bài viết ra file **ZIP** tự động.

---

## 🚀 Cài đặt

### Sử dụng npm

```bash
npm install @kitmodule/kitsubstack
```

### Sử dụng CDN

```html
<script src="https://unpkg.com/@kitmodule/kitsubstack/dist/kitsubstack.min.js"></script>
```

hoặc

```html
<script src="https://cdn.jsdelivr.net/npm/kitsubstack/dist/kitsubstack.min.js"></script>
```

---

## 💡 Cách dùng

### Trình duyệt (CDN)

```html
<script src="https://unpkg.com/@kitmodule/kitsubstack-js/dist/kitsubstack.min.js"></script>
<script>
  const kit = new KitSubStack("example.substack.com");

  kit.offset(0)
     .limit(5)
     .numbering(true)
     .frontMatter("hashnode")
     .replaces("Substack", "Hashnode")
     .progress(fetch => {
         if (fetch.success) console.log("✅ Đã lấy:", fetch.post.slug);
         else console.error("❌ Lỗi:", fetch.slug ?? "unknown");
     })
     .completed(filename => console.log("✅ ZIP sẵn sàng:", filename))
     .zip();
</script>
```

### Node.js / CommonJS

```js
const { KitSubStack, zipSubstackToHashnode } = require("kitsubstack-js");

// Sử dụng cơ bản
const kit = new KitSubStack("example.substack.com");

await kit.offset(0)
         .limit(10)
         .frontMatter("hashnode")
         .zip();

// Shortcut helper
await zipSubstackToHashnode("example.substack.com", 0, 5, true);
```

---

## 🧩 Tham khảo API

### `new KitSubStack(input)`

| Tham số | Loại            | Mô tả                                |
| ------- | --------------- | ------------------------------------ |
| input   | string | object | Username, hostname hoặc URL Substack |

### Các phương thức chainable

| Phương thức            | Mô tả                                                                   |                                                  |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `.offset(n)`           | Bắt đầu từ bài viết thứ `n`                                             |                                                  |
| `.limit(n)`            | Lấy tối đa `n` bài viết                                                 |                                                  |
| `.numbering(true       | false)`                                                                 | Thêm số thứ tự vào tên file                      |
| `.progress(callback)`  | Callback khi mỗi bài được lấy                                           |                                                  |
| `.completed(callback)` | Callback khi ZIP đã tạo xong                                            |                                                  |
| `.concurrent(n)`       | Lấy nhiều bài cùng lúc, tối đa `n`                                      |                                                  |
| `.replaces(...args)`   | Thay thế nhiều chuỗi trong nội dung, ví dụ `.replaces("0","1","2","3")` |                                                  |
| `.frontMatter(type     | callback)`                                                              | Chọn preset front matter hoặc function tùy chỉnh |
| `.zip()`               | Lấy bài, tạo Markdown + front matter, và xuất ZIP                       |                                                  |

---

### Preset Front Matter

| Preset   | Trường dữ liệu                                            |
| -------- | --------------------------------------------------------- |
| hashnode | title, slug, tags, date, image                            |
| hugo     | title, slug, date, draft, tags, description, cover        |
| jekyll   | layout, title, slug, date, categories, description, image |
| astro    | title, pubDate, description, tags, heroImage              |
| default  | title, slug, date, description, image                     |

Hỗ trợ **async custom function**:

```js
kit.frontMatter(async post => ({
    title: post.title.toUpperCase(),
    date: post.post_date,
    tags: post.postTags?.map(t => t.name) ?? [],
}));
```

---

### Thay thế nhiều chuỗi

```js
kit.replaces(
    "Substack", "Hashnode",
    "2025", "2026"
);
```

* Hoạt động giống `strings.NewReplacer` trong Golang.
* Thay thế tất cả các xuất hiện trong nội dung bài viết.

---

## 📦 Các gói đã tích hợp / gợi ý sử dụng

KitSubStack là **không phụ thuộc vào thư viện ngoài** và đã **tích hợp sẵn** các gói Kit sau:

| Gói                                                           | Mục đích                                                            | Tích hợp trong KitSubStack? |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------- |
| [KitZip JS](https://github.com/kitmodule/kitzip-js)           | Tạo file ZIP từ Markdown hoặc các tệp khác; nhẹ, chuỗi (chainable). | ✅ Đã tích hợp sẵn           |
| [KitYAML JS](https://github.com/kitmodule/kityaml-js)         | Chuyển đổi JavaScript object thành YAML front matter cho Markdown.  | ✅ Đã tích hợp sẵn           |
| [KitMarkdown JS](https://github.com/kitmodule/kitmarkdown-js) | Chuyển HTML sang Markdown, nhẹ và không phụ thuộc thư viện ngoài.   | ✅ Đã tích hợp sẵn           |

> ⚡ Lưu ý: Bạn **không cần cài thêm gì** để sử dụng KitSubStack. Các gói này được tích hợp sẵn và hoạt động trực tiếp.
> Tuy nhiên, nếu muốn, bạn vẫn có thể **sử dụng riêng từng module** trong các dự án khác, hoặc tích hợp vào workflow tùy chỉnh như: fetch bài → chuyển HTML sang Markdown → tạo YAML front matter → xuất ZIP.



## ☕ Ủng hộ tác giả

Nếu bạn thấy thư viện hữu ích, bạn có thể ủng hộ:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge\&logo=ko-fi\&logoColor=white)](https://ko-fi.com/huynhnhanquoc)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=for-the-badge\&logo=buy-me-a-coffee\&logoColor=black)](https://buymeacoffee.com/huynhnhanquoc)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-f7f7f7?style=for-the-badge\&logo=githubsponsors\&logoColor=ff69b4\&color=f7f7f7)](https://github.com/sponsors/huynhnhanquoc)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge\&logo=patreon\&logoColor=white)](https://patreon.com/huynhnhanquoc)
[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge\&logo=paypal\&logoColor=white)](https://paypal.me/huynhnhanquoc)

---

## 🧾 License

Phát hành theo [MIT License](https://github.com/kitmodule/kitsubstack-js/blob/master/LICENSE)
© 2025 [Huỳnh Nhân Quốc](https://github.com/huynhnhanquoc) · Open Source [@Kit Module](https://github.com/kitmodule)
