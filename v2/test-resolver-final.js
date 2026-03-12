function toS3Scheme(url) {
  if (!url) return '';
  const cleanUrl = url.split('?')[0];
  const AUTHORITATIVE_DOMAINS = ['bdsmlr.com', 'reblogme.com'];
  for (const domain of AUTHORITATIVE_DOMAINS) {
    if (cleanUrl.includes(domain)) {
      const parts = cleanUrl.split(domain);
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
  { in: "https://cdn012.bdsmlr.com/uploads/1.jpg?e=123", out: "s3://ocdn012.bdsmlr.com/uploads/1.jpg" },
  { in: "https://ocdn012.bdsmlr.com/uploads/2.jpg", out: "s3://ocdn012.bdsmlr.com/uploads/2.jpg" },
  { in: "https://cdn101.bdsmlr.com/path", out: "s3://cdn101.bdsmlr.com/path" },
  { in: "cdn002.reblogme.com/path", out: "s3://cdn002.reblogme.com/path" }
];

tests.forEach(t => {
  const res = toS3Scheme(t.in);
  console.log(`TEST: ${t.in} -> ${res}`);
  if (res !== t.out) {
    console.error(`❌ FAILED! Expected ${t.out}`);
    process.exit(1);
  }
});
console.log("✅ All Frontend Logic Tests Passed!");
