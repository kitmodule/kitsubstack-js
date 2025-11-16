// ------------------------
// Example usage
/*
const kit = new KitSubStack("https://huynhnhanquoc.substack.com");
kit.offset(0)
   .limit(5)
   .numbering()
   .front("hashnode")
   .progress(info => {
       if(info.success) console.log("✅ Fetched:", info.post.slug);
       else console.log("❌ Failed:", info.slug, info.error);
   });

await kit.zip(); // ZIP tất cả bài với front matter và báo tiến trình
*/
// Load external scripts (CDN)
async function loadScript(url) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

await loadScript('https://cdn.jsdelivr.net/gh/kitmodule/kitzip-js@v1.0.4/src/index.js');
await loadScript('https://cdn.jsdelivr.net/gh/kitmodule/kitmarkdown-js@v1.0.8/src/index.js');
await loadScript('https://cdn.jsdelivr.net/gh/kitmodule/kityaml-js@v1.0.6/src/index.js');

const kit = new KitSubStack("https://huynhnhanquoc.substack.com");
kit.offset(0).limit(2).numbering().progress(fetch => { console.log("✅ Fetched:", fetch.post.slug) });
kit.zip();