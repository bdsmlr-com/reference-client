function toS3Scheme(url) {
  if (!url) return '';
  const cleanUrl = url.split('?')[0];
  const AUTHORITATIVE_DOMAINS = ['bdsmlr.com', 'reblogme.com'];
  for (const domain of AUTHORITATIVE_DOMAINS) {
    if (cleanUrl.includes(domain)) {
      const parts = cleanUrl.split(domain);
      // REGEX: Get the subdomain part
      const hostMatch = parts[0].match(/([a-z0-9]+)\.?$/);
      const hostPart = hostMatch ? hostMatch[1] : '';
      const pathPart = parts[1];
      if (hostPart) {
        const fullHost = `${hostPart}.${domain}`;
        const finalBucket = fullHost === 'cdn012.bdsmlr.com' ? 'ocdn012.bdsmlr.com' : fullHost;
        return `s3://${finalBucket}${pathPart}`;
      }
    }
  }
  return cleanUrl;
}

const tests = [
  { name: "cdn012 map", in: "https://cdn012.bdsmlr.com/u/1.jpg", out: "s3://ocdn012.bdsmlr.com/u/1.jpg" },
  { name: "ocdn012 keep", in: "https://ocdn012.bdsmlr.com/u/2.jpg", out: "s3://ocdn012.bdsmlr.com/u/2.jpg" },
  { name: "reblogme", in: "https://cdn002.reblogme.com/u/3.jpg", out: "s3://cdn002.reblogme.com/u/3.jpg" },
  { name: "no protocol", in: "cdn101.bdsmlr.com/u/4.jpg", out: "s3://cdn101.bdsmlr.com/u/4.jpg" }
];

tests.forEach(t => {
  const res = toS3Scheme(t.in);
  console.log(`[${t.name}] IN: ${t.in} -> OUT: ${res}`);
  if (res !== t.out) {
    console.error(`❌ FAILED! Expected ${t.out}`);
    process.exit(1);
  }
});
console.log("✅ TDD PASSED.");
